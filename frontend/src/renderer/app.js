/**
 * Main Adjutant renderer application.
 * Connects to Ruby backend via WebSocket and drives the UI.
 */
(function () {
  // Components
  const statusBar = new StatusBar();
  const transcript = new Transcript();
  const voiceIndicator = new VoiceIndicator();

  // Three.js scene
  const canvas = document.getElementById('face-canvas');
  const adjutantScene = new AdjutantScene(canvas);
  const head = new AdjutantHead(adjutantScene);
  const animController = new AnimationController(head, adjutantScene);
  const lipSync = new LipSync(head, animController);

  // Wire up animation loop
  adjutantScene.onUpdate = (delta) => {
    animController.update(delta);
    head.update(delta, animController.state);
  };
  adjutantScene.start();

  // WebSocket connection
  let ws = null;
  let isRecording = false;
  let wsUrl = 'ws://127.0.0.1:9247';

  function connect() {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Connected to Adjutant backend');
      statusBar.setText('ADJUTANT ONLINE // LINK ESTABLISHED // AWAITING ORDERS');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleMessage(data);
    };

    ws.onclose = () => {
      console.log('Disconnected from backend, reconnecting...');
      statusBar.setText('ADJUTANT // CONNECTION LOST // RECONNECTING...');
      animController.setState('alert');
      setTimeout(connect, 3000);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }

  function send(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  function handleMessage(data) {
    switch (data.type) {
      case 'state':
        animController.setState(data.state);
        voiceIndicator.setState(data.state);
        if (data.state === 'idle') {
          adjutantScene.setDormant(true);
        } else {
          adjutantScene.setDormant(false);
        }
        break;

      case 'transcript':
        if (data.source === 'user') {
          transcript.addUserText(data.text);
        }
        // Adjutant's final text is already shown via stream
        break;

      case 'stream_chunk':
        if (!transcript.streamEl) {
          transcript.startStream();
        }
        transcript.appendChunk(data.text);
        break;

      case 'speak':
        transcript.endStream();
        if (data.audio_path) {
          lipSync.playAndSync(data.audio_path);
        }
        break;

      case 'feed_items':
        statusBar.addItems(data.items);
        break;

      case 'error':
        console.error('Backend error:', data.message);
        transcript.addUserText(`[ERROR] ${data.message}`);
        break;

      case 'pong':
        break;
    }
  }

  // Push-to-talk via Electron IPC
  if (window.adjutant) {
    window.adjutant.onInit((data) => {
      if (data.wsUrl) wsUrl = data.wsUrl;
      connect();
    });

    window.adjutant.onPushToTalk(() => {
      if (isRecording) {
        isRecording = false;
        send({ type: 'stop_recording' });
      } else {
        isRecording = true;
        send({ type: 'start_recording' });
      }
    });
  } else {
    // Fallback: connect directly (for dev/testing)
    connect();
  }

  // Keepalive ping
  setInterval(() => {
    send({ type: 'ping' });
  }, 30000);

  // Go dormant after 30 seconds of idle
  let idleTimer = null;
  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      adjutantScene.setDormant(true);
    }, 30000);
  }
  resetIdleTimer();
})();
