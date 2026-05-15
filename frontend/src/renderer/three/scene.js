/**
 * Three.js scene setup for Adjutant face.
 * Transparent background WebGL renderer.
 */
class AdjutantScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.width = 280;
    this.height = 280;

    // Scene
    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 100);
    this.camera.position.set(0, 0, 3);
    this.camera.lookAt(0, 0, 0);

    // Renderer — transparent background
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);

    // Clock for animations
    this.clock = new THREE.Clock();

    // Target FPS
    this.targetFPS = 30;
    this.frameInterval = 1000 / this.targetFPS;
    this.lastFrameTime = 0;

    // Dormant mode (reduced FPS when idle)
    this.dormant = false;
  }

  setDormant(dormant) {
    this.dormant = dormant;
    this.targetFPS = dormant ? 10 : 30;
    this.frameInterval = 1000 / this.targetFPS;
  }

  start() {
    this.animate(0);
  }

  animate(currentTime) {
    requestAnimationFrame((t) => this.animate(t));

    const elapsed = currentTime - this.lastFrameTime;
    if (elapsed < this.frameInterval) return;

    this.lastFrameTime = currentTime - (elapsed % this.frameInterval);
    const delta = this.clock.getDelta();

    // Update animations (set by AdjutantHead)
    if (this.onUpdate) {
      this.onUpdate(delta);
    }

    this.renderer.render(this.scene, this.camera);
  }
}
