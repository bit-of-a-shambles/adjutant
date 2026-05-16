/**
 * Adjutant — All-in-one renderer bundle.
 * Three.js is loaded via require() in Electron's renderer (nodeIntegration-free,
 * so we use the preload to pass it, or load the CJS build directly).
 */

// --- Load Three.js from CJS build ---
const THREE = require('three');

// =====================================================================
// THREE.JS SCENE
// =====================================================================
class AdjutantScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.width = 280;
    this.height = 280;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 100);
    this.camera.position.set(0, 0, 3);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);

    this.clock = new THREE.Clock();
    this.targetFPS = 30;
    this.frameInterval = 1000 / this.targetFPS;
    this.lastFrameTime = 0;
  }

  setDormant(dormant) {
    this.targetFPS = dormant ? 10 : 30;
    this.frameInterval = 1000 / this.targetFPS;
  }

  start() {
    const animate = (currentTime) => {
      requestAnimationFrame(animate);
      const elapsed = currentTime - this.lastFrameTime;
      if (elapsed < this.frameInterval) return;
      this.lastFrameTime = currentTime - (elapsed % this.frameInterval);
      const delta = this.clock.getDelta();
      if (this.onUpdate) this.onUpdate(delta);
      this.renderer.render(this.scene, this.camera);
    };
    requestAnimationFrame(animate);
  }
}

// =====================================================================
// ADJUTANT HEAD — procedural wireframe
// =====================================================================
class AdjutantHead {
  constructor(scene) {
    this.sceneObj = scene;
    this.group = new THREE.Group();

    this.material = new THREE.MeshBasicMaterial({
      color: 0x00ff41,
      wireframe: true,
      transparent: true,
      opacity: 0.85,
    });

    this.glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff41,
      wireframe: true,
      transparent: true,
      opacity: 0.15,
    });

    this.buildHead();
    scene.scene.add(this.group);

    this.morphState = { jawOpen: 0, mouthWidth: 0, browUp: 0, eyesClosed: 0 };
  }

  buildHead() {
    // Cranium
    const craniumGeo = new THREE.SphereGeometry(0.7, 16, 12);
    craniumGeo.scale(1, 1.15, 0.95);
    this.cranium = new THREE.Mesh(craniumGeo, this.material);
    this.cranium.position.y = 0.15;
    this.group.add(this.cranium);

    // Inner glow
    const innerGeo = new THREE.SphereGeometry(0.65, 12, 10);
    innerGeo.scale(1, 1.15, 0.95);
    this.group.add(new THREE.Mesh(innerGeo, this.glowMaterial));
    this.group.children[this.group.children.length - 1].position.y = 0.15;

    // Jaw (opens for speaking)
    const jawGeo = new THREE.SphereGeometry(0.45, 12, 6, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5);
    jawGeo.scale(1.1, 0.5, 0.9);
    this.jaw = new THREE.Mesh(jawGeo, this.material);
    this.jaw.position.y = -0.45;
    this.jawPivot = new THREE.Group();
    this.jawPivot.position.y = -0.15;
    this.jawPivot.add(this.jaw);
    this.group.add(this.jawPivot);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.12, 8, 6);
    this.leftEye = new THREE.Mesh(eyeGeo, this.material);
    this.leftEye.position.set(-0.25, 0.25, 0.6);
    this.group.add(this.leftEye);

    this.rightEye = new THREE.Mesh(eyeGeo, this.material);
    this.rightEye.position.set(0.25, 0.25, 0.6);
    this.group.add(this.rightEye);

    // Pupils
    const pupilGeo = new THREE.SphereGeometry(0.04, 6, 4);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x00ff41 });
    this.leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
    this.leftPupil.position.set(-0.25, 0.25, 0.72);
    this.group.add(this.leftPupil);

    this.rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
    this.rightPupil.position.set(0.25, 0.25, 0.72);
    this.group.add(this.rightPupil);

    // Brow ridges
    const browGeo = new THREE.TorusGeometry(0.15, 0.02, 4, 8, Math.PI);
    this.leftBrow = new THREE.Mesh(browGeo, this.material);
    this.leftBrow.position.set(-0.25, 0.42, 0.58);
    this.leftBrow.rotation.z = Math.PI;
    this.group.add(this.leftBrow);

    this.rightBrow = new THREE.Mesh(browGeo, this.material);
    this.rightBrow.position.set(0.25, 0.42, 0.58);
    this.rightBrow.rotation.z = Math.PI;
    this.group.add(this.rightBrow);

    // Nose
    const noseGeo = new THREE.CylinderGeometry(0.02, 0.04, 0.25, 4);
    const nose = new THREE.Mesh(noseGeo, this.material);
    nose.position.set(0, 0.1, 0.7);
    this.group.add(nose);

    // Cheekbones
    const cheekGeo = new THREE.TorusGeometry(0.3, 0.015, 3, 8, Math.PI * 0.5);
    const leftCheek = new THREE.Mesh(cheekGeo, this.material);
    leftCheek.position.set(-0.45, 0.05, 0.4);
    leftCheek.rotation.set(0, 0.5, 0.3);
    this.group.add(leftCheek);

    const rightCheek = new THREE.Mesh(cheekGeo, this.material);
    rightCheek.position.set(0.45, 0.05, 0.4);
    rightCheek.rotation.set(0, -0.5, -0.3);
    this.group.add(rightCheek);

    this.group.position.y = 0.1;
  }

  update(delta) {
    const targetJaw = this.morphState.jawOpen * 0.3;
    this.jawPivot.rotation.x = THREE.MathUtils.lerp(this.jawPivot.rotation.x, targetJaw, 0.15);

    const eyeScale = 1 - this.morphState.eyesClosed * 0.8;
    this.leftEye.scale.y = THREE.MathUtils.lerp(this.leftEye.scale.y, eyeScale, 0.2);
    this.rightEye.scale.y = this.leftEye.scale.y;
    this.leftPupil.scale.y = this.leftEye.scale.y;
    this.rightPupil.scale.y = this.leftEye.scale.y;

    const browOffset = this.morphState.browUp * 0.08;
    this.leftBrow.position.y = THREE.MathUtils.lerp(this.leftBrow.position.y, 0.42 + browOffset, 0.1);
    this.rightBrow.position.y = this.leftBrow.position.y;
  }

  setMorph(key, value) {
    if (key in this.morphState) {
      this.morphState[key] = Math.max(0, Math.min(1, value));
    }
  }

  setOpacity(opacity) {
    this.material.opacity = opacity;
  }
}

// =====================================================================
// ANIMATION CONTROLLER
// =====================================================================
class AnimationController {
  constructor(head, scene) {
    this.head = head;
    this.scene = scene;
    this.state = 'idle';
    this.time = 0;
    this.blinkTimer = 0;
    this.nextBlink = 2 + Math.random() * 4;
    this._hasLipSync = false;
  }

  setState(newState) {
    if (this.state === newState) return;
    this.state = newState;
    this.scene.setDormant(newState === 'idle');
  }

  update(delta) {
    this.time += delta;
    this.blinkTimer += delta;

    if (this.blinkTimer > this.nextBlink) {
      this.head.setMorph('eyesClosed', 1);
      setTimeout(() => this.head.setMorph('eyesClosed', 0), 120);
      this.blinkTimer = 0;
      this.nextBlink = 2 + Math.random() * 4;
    }

    const g = this.head.group;

    switch (this.state) {
      case 'idle':
        g.rotation.y = Math.sin(this.time * 0.3) * 0.05;
        g.rotation.x = Math.sin(this.time * 0.2) * 0.02;
        g.position.y = 0.1 + Math.sin(this.time * 0.4) * 0.01;
        this.head.setMorph('jawOpen', 0);
        this.head.setOpacity(0.85);
        break;

      case 'listening':
        g.rotation.y = Math.sin(this.time * 0.5) * 0.08;
        g.rotation.x = -0.05;
        this.head.setMorph('browUp', 0.3);
        this.head.setOpacity(0.85 + Math.sin(this.time * 3) * 0.1);
        break;

      case 'processing':
        this.head.setOpacity(Math.random() > 0.1 ? 0.85 : 0.3);
        this.head.setMorph('eyesClosed', 0.4);
        g.rotation.y = Math.sin(this.time * 2) * 0.03;
        break;

      case 'speaking':
        g.rotation.y = Math.sin(this.time * 1.5) * 0.04;
        g.rotation.x = Math.sin(this.time * 1.2) * 0.02;
        if (!this._hasLipSync) {
          this.head.setMorph('jawOpen', Math.abs(Math.sin(this.time * 8)) * 0.6);
        }
        this.head.setOpacity(0.9);
        break;

      case 'alert':
        const phase = this.time % 2;
        if (phase < 0.3) {
          g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, 0.3, 0.15);
          this.head.setOpacity(1);
        } else {
          g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, 0, 0.05);
          this.head.setOpacity(0.85);
        }
        break;
    }
  }

  setLipSyncActive(active) {
    this._hasLipSync = active;
  }
}

// =====================================================================
// LIP SYNC
// =====================================================================
class LipSync {
  constructor(head, animController) {
    this.head = head;
    this.animController = animController;
    this.audioContext = null;
    this.currentSource = null;
    this.isActive = false;
  }

  stop() {
    this.isActive = false;
    this.animController.setLipSyncActive(false);
    this.head.setMorph('jawOpen', 0);
    if (this.currentSource) {
      try { this.currentSource.stop(); } catch (e) {}
      this.currentSource = null;
    }
  }

  async playAndSync(audioPath) {
    try {
      if (!this.audioContext) this.audioContext = new AudioContext();

      const response = await fetch(`file://${audioPath}`);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;

      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      source.connect(analyser);
      analyser.connect(this.audioContext.destination);

      this.isActive = true;
      this.currentSource = source;
      this.animController.setLipSyncActive(true);
      source.start(0);

      const updateLoop = () => {
        if (!this.isActive) return;
        analyser.getByteFrequencyData(dataArray);
        let low = 0;
        for (let i = 0; i < 8; i++) low += dataArray[i];
        this.head.setMorph('jawOpen', Math.min(1, (low / 8) / 180));
        requestAnimationFrame(updateLoop);
      };
      updateLoop();

      source.onended = () => {
        this.isActive = false;
        this.currentSource = null;
        this.animController.setLipSyncActive(false);
        this.head.setMorph('jawOpen', 0);
      };
    } catch (err) {
      console.error('Lip sync error:', err);
      this.isActive = false;
      this.animController.setLipSyncActive(false);
    }
  }
}

// =====================================================================
// UI COMPONENTS
// =====================================================================
class StatusBar {
  constructor() {
    this.ticker = document.getElementById('ticker');
    this.items = [];
    this.setText('ADJUTANT ONLINE // ALL SYSTEMS NOMINAL // AWAITING ORDERS');
  }
  addItems(newItems) {
    this.items = [...newItems, ...this.items].slice(0, 30);
    this.ticker.textContent = this.items.map(i => i.title).join(' // ');
  }
  setText(text) { this.ticker.textContent = text; }
}

class Transcript {
  constructor() {
    this.scrollContainer = document.getElementById('transcript-overlay');
    this.container = document.getElementById('transcript-text');
    this.streamEl = null;
    this.streamBuffer = '';
    this.fadeTimeout = null;
  }
  addUserText(text) {
    this._clearFade();
    const el = document.createElement('div');
    el.className = 'user-text';
    el.textContent = `> ${text}`;
    this.container.appendChild(el);
    this._trim();
    this._scrollToBottom();
    this._scheduleFade();
  }
  startStream() {
    this._clearFade();
    this.streamBuffer = '';
    this.streamEl = document.createElement('div');
    this.streamEl.className = 'adjutant-text';
    this.container.appendChild(this.streamEl);
    this._scrollToBottom();
  }
  appendChunk(text) {
    this.streamBuffer += text;
    if (this.streamEl) this.streamEl.textContent = this.streamBuffer;
    this._scrollToBottom();
  }
  endStream() {
    this.streamEl = null;
    this.streamBuffer = '';
    this._scrollToBottom();
    this._scheduleFade();
  }
  _scrollToBottom() {
    this.scrollContainer.scrollTop = this.scrollContainer.scrollHeight;
  }
  _trim() { while (this.container.children.length > 10) this.container.removeChild(this.container.firstChild); }
  _scheduleFade() {
    this._clearFade();
    this.fadeTimeout = setTimeout(() => {
      this.scrollContainer.style.transition = 'opacity 2s';
      this.scrollContainer.style.opacity = '0.3';
    }, 10000);
  }
  _clearFade() {
    if (this.fadeTimeout) clearTimeout(this.fadeTimeout);
    this.scrollContainer.style.transition = 'opacity 0.3s';
    this.scrollContainer.style.opacity = '1';
  }
}

class VoiceIndicator {
  constructor() {
    this.dot = document.getElementById('voice-dot');
    this.label = document.getElementById('voice-label');
  }
  setState(state) {
    this.dot.className = '';
    const labels = { idle: 'STANDBY', listening: 'RECORDING', processing: 'PROCESSING', speaking: 'TRANSMITTING', alert: 'ALERT' };
    this.label.textContent = labels[state] || 'STANDBY';
    if (state === 'listening') this.dot.className = 'listening';
    else if (state === 'processing') this.dot.className = 'processing';
    else if (state === 'speaking' || state === 'alert') this.dot.className = 'speaking';
  }
}

// =====================================================================
// MAIN APP
// =====================================================================
(function () {
  const statusBar = new StatusBar();
  const transcript = new Transcript();
  const voiceIndicator = new VoiceIndicator();

  // Three.js
  const canvas = document.getElementById('face-canvas');
  const adjutantScene = new AdjutantScene(canvas);
  const head = new AdjutantHead(adjutantScene);
  const animController = new AnimationController(head, adjutantScene);
  const lipSync = new LipSync(head, animController);

  adjutantScene.onUpdate = (delta) => {
    animController.update(delta);
    head.update(delta);
  };
  adjutantScene.start();

  // WebSocket
  let ws = null;
  let isRecording = false;
  const wsUrl = 'ws://127.0.0.1:9247';

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
      console.log('Disconnected, reconnecting...');
      statusBar.setText('CONNECTION LOST // RECONNECTING...');
      animController.setState('alert');
      setTimeout(connect, 3000);
    };

    ws.onerror = () => {};
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
        if (data.state === 'speaking' || data.state === 'processing') {
          stopBtn.classList.add('visible');
        } else if (data.state === 'idle') {
          stopBtn.classList.remove('visible');
        }
        break;
      case 'transcript':
        if (data.source === 'user') transcript.addUserText(data.text);
        break;
      case 'stream_chunk':
        if (!transcript.streamEl) transcript.startStream();
        transcript.appendChunk(data.text);
        break;
      case 'speak':
        transcript.endStream();
        if (data.audio_path) lipSync.playAndSync(data.audio_path);
        break;
      case 'feed_items':
        statusBar.addItems(data.items);
        break;
      case 'error':
        transcript.addUserText(`[ERROR] ${data.message}`);
        break;
    }
  }

  // Stop button
  const stopBtn = document.getElementById('stop-btn');
  stopBtn.addEventListener('click', () => {
    send({ type: 'stop_speech' });
    lipSync.stop();
    animController.setState('idle');
    voiceIndicator.setState('idle');
    transcript.endStream();
    stopBtn.classList.remove('visible');
  });

  // Dashboard button
  const dashboardBtn = document.getElementById('dashboard-btn');
  dashboardBtn.addEventListener('click', () => {
    require('electron').ipcRenderer.send('open-dashboard');
  });

  // Text input
  const textInput = document.getElementById('text-input');
  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && textInput.value.trim()) {
      send({ type: 'text_query', text: textInput.value.trim() });
      textInput.value = '';
    }
  });

  // Push-to-talk via Electron IPC
  if (window.adjutant) {
    window.adjutant.onInit((data) => connect());
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
    connect();
  }

  // Keepalive
  setInterval(() => send({ type: 'ping' }), 30000);
})();
