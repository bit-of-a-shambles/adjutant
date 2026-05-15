/**
 * Animation state machine for the Adjutant head.
 * States: idle, listening, processing, speaking, alert
 */
class AnimationController {
  constructor(head, scene) {
    this.head = head;
    this.scene = scene;
    this.state = 'idle';
    this.time = 0;
    this.blinkTimer = 0;
    this.nextBlink = this.randomBlinkInterval();
  }

  setState(newState) {
    if (this.state === newState) return;
    this.state = newState;

    // Transition effects
    switch (newState) {
      case 'idle':
        this.scene.setDormant(false);
        this.head.setOpacity(0.85);
        break;
      case 'listening':
        this.scene.setDormant(false);
        this.head.setOpacity(0.95);
        break;
      case 'processing':
        this.scene.setDormant(false);
        break;
      case 'speaking':
        this.scene.setDormant(false);
        this.head.setOpacity(0.9);
        break;
      case 'alert':
        this.scene.setDormant(false);
        break;
    }
  }

  update(delta) {
    this.time += delta;
    this.blinkTimer += delta;

    // Blink cycle (all states)
    if (this.blinkTimer > this.nextBlink) {
      this.doBlink();
      this.blinkTimer = 0;
      this.nextBlink = this.randomBlinkInterval();
    }

    switch (this.state) {
      case 'idle':
        this.animateIdle(delta);
        break;
      case 'listening':
        this.animateListening(delta);
        break;
      case 'processing':
        this.animateProcessing(delta);
        break;
      case 'speaking':
        this.animateSpeaking(delta);
        break;
      case 'alert':
        this.animateAlert(delta);
        break;
    }
  }

  animateIdle(delta) {
    // Gentle head bob
    const group = this.head.group;
    group.rotation.y = Math.sin(this.time * 0.3) * 0.05;
    group.rotation.x = Math.sin(this.time * 0.2) * 0.02;
    group.position.y = 0.1 + Math.sin(this.time * 0.4) * 0.01;

    // Jaw closed
    this.head.setMorph('jawOpen', 0);
    this.head.setMorph('browUp', 0);
  }

  animateListening(delta) {
    // Head tilts slightly, more attentive
    const group = this.head.group;
    group.rotation.y = Math.sin(this.time * 0.5) * 0.08;
    group.rotation.x = -0.05; // Slight forward lean
    group.rotation.z = Math.sin(this.time * 0.3) * 0.03;

    // Brows up slightly
    this.head.setMorph('browUp', 0.3);
    this.head.setMorph('jawOpen', 0);

    // Glow pulse
    const pulse = 0.85 + Math.sin(this.time * 3) * 0.1;
    this.head.setOpacity(pulse);
  }

  animateProcessing(delta) {
    // Rapid wireframe flicker
    const flicker = Math.random() > 0.1 ? 0.85 : 0.3;
    this.head.setOpacity(flicker);

    // Eyes narrow
    this.head.setMorph('eyesClosed', 0.4);
    this.head.setMorph('browUp', -0.2);

    // Small rotation
    const group = this.head.group;
    group.rotation.y = Math.sin(this.time * 2) * 0.03;
  }

  animateSpeaking(delta) {
    // Head micro-movements while talking
    const group = this.head.group;
    group.rotation.y = Math.sin(this.time * 1.5) * 0.04;
    group.rotation.x = Math.sin(this.time * 1.2) * 0.02;

    // Jaw movement is driven by lip-sync (external), but add baseline
    // If no lip-sync data, simulate
    if (!this._hasLipSync) {
      const jawMove = Math.abs(Math.sin(this.time * 8)) * 0.6;
      this.head.setMorph('jawOpen', jawMove);
    }

    this.head.setMorph('browUp', 0.1);
  }

  animateAlert(delta) {
    // Quick head turn + flash
    const group = this.head.group;
    const alertPhase = this.time % 2;

    if (alertPhase < 0.3) {
      group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, 0.3, 0.15);
      this.head.setOpacity(1);
    } else if (alertPhase < 0.6) {
      group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, -0.1, 0.1);
      this.head.setOpacity(0.5);
    } else {
      group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, 0, 0.05);
      this.head.setOpacity(0.85);
    }

    this.head.setMorph('browUp', 0.5);
  }

  doBlink() {
    // Quick blink animation using setMorph
    this.head.setMorph('eyesClosed', 1);
    setTimeout(() => this.head.setMorph('eyesClosed', 0), 120);
  }

  randomBlinkInterval() {
    return 2 + Math.random() * 4; // 2-6 seconds
  }

  setLipSyncActive(active) {
    this._hasLipSync = active;
  }
}
