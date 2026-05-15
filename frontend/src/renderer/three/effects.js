/**
 * Post-processing placeholder.
 * Full bloom + scanline effects require Three.js addons (EffectComposer).
 * For Phase 1, we achieve the look with CSS scanlines (in hud.css)
 * and the wireframe material's built-in green glow.
 *
 * Phase 2 will add proper Three.js post-processing:
 * - UnrealBloomPass for green glow bleed
 * - Custom ShaderPass for CRT scanlines
 * - Vignette ShaderPass for darkened edges
 */

class Effects {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    // TODO: Add EffectComposer with bloom + scanline passes
  }

  render() {
    // For now, direct render. Will be replaced by composer.render()
    this.renderer.render(this.scene, this.camera);
  }
}
