/**
 * Procedural wireframe head for the Adjutant.
 * Generates a stylized head shape using spheres and ellipsoids,
 * rendered as green wireframe with glow.
 */
class AdjutantHead {
  constructor(scene) {
    this.sceneObj = scene;
    this.group = new THREE.Group();

    // Wireframe material — Adjutant green
    this.material = new THREE.MeshBasicMaterial({
      color: 0x00ff41,
      wireframe: true,
      transparent: true,
      opacity: 0.85,
    });

    // Glow material (slightly different for inner glow)
    this.glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff41,
      wireframe: true,
      transparent: true,
      opacity: 0.15,
    });

    this.buildHead();
    scene.scene.add(this.group);

    // Morph state (0-1 for each)
    this.morphState = {
      jawOpen: 0,
      mouthWidth: 0,
      browUp: 0,
      eyesClosed: 0,
    };
  }

  buildHead() {
    // Main cranium — slightly elongated sphere
    const craniumGeo = new THREE.SphereGeometry(0.7, 16, 12);
    craniumGeo.scale(1, 1.15, 0.95);
    this.cranium = new THREE.Mesh(craniumGeo, this.material);
    this.cranium.position.y = 0.15;
    this.group.add(this.cranium);

    // Inner cranium glow
    const innerGeo = new THREE.SphereGeometry(0.65, 12, 10);
    innerGeo.scale(1, 1.15, 0.95);
    const innerCranium = new THREE.Mesh(innerGeo, this.glowMaterial);
    innerCranium.position.y = 0.15;
    this.group.add(innerCranium);

    // Jaw — separate piece that can open
    const jawGeo = new THREE.SphereGeometry(0.45, 12, 6, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5);
    jawGeo.scale(1.1, 0.5, 0.9);
    this.jaw = new THREE.Mesh(jawGeo, this.material);
    this.jaw.position.y = -0.45;
    this.jawPivot = new THREE.Group();
    this.jawPivot.position.y = -0.15;
    this.jawPivot.add(this.jaw);
    this.group.add(this.jawPivot);

    // Eyes — small wireframe spheres
    const eyeGeo = new THREE.SphereGeometry(0.12, 8, 6);
    this.leftEye = new THREE.Mesh(eyeGeo, this.material);
    this.leftEye.position.set(-0.25, 0.25, 0.6);
    this.group.add(this.leftEye);

    this.rightEye = new THREE.Mesh(eyeGeo, this.material);
    this.rightEye.position.set(0.25, 0.25, 0.6);
    this.group.add(this.rightEye);

    // Eye pupils — bright dots
    const pupilGeo = new THREE.SphereGeometry(0.04, 6, 4);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x00ff41, transparent: true, opacity: 1 });
    this.leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
    this.leftPupil.position.set(-0.25, 0.25, 0.72);
    this.group.add(this.leftPupil);

    this.rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
    this.rightPupil.position.set(0.25, 0.25, 0.72);
    this.group.add(this.rightPupil);

    // Brow ridges — torus segments
    const browGeo = new THREE.TorusGeometry(0.15, 0.02, 4, 8, Math.PI);
    this.leftBrow = new THREE.Mesh(browGeo, this.material);
    this.leftBrow.position.set(-0.25, 0.42, 0.58);
    this.leftBrow.rotation.z = Math.PI;
    this.group.add(this.leftBrow);

    this.rightBrow = new THREE.Mesh(browGeo, this.material);
    this.rightBrow.position.set(0.25, 0.42, 0.58);
    this.rightBrow.rotation.z = Math.PI;
    this.group.add(this.rightBrow);

    // Nose ridge — simple line
    const noseGeo = new THREE.CylinderGeometry(0.02, 0.04, 0.25, 4);
    const nose = new THREE.Mesh(noseGeo, this.material);
    nose.position.set(0, 0.1, 0.7);
    this.group.add(nose);

    // Cheekbone accents
    const cheekGeo = new THREE.TorusGeometry(0.3, 0.015, 3, 8, Math.PI * 0.5);
    const leftCheek = new THREE.Mesh(cheekGeo, this.material);
    leftCheek.position.set(-0.45, 0.05, 0.4);
    leftCheek.rotation.set(0, 0.5, 0.3);
    this.group.add(leftCheek);

    const rightCheek = new THREE.Mesh(cheekGeo, this.material);
    rightCheek.position.set(0.45, 0.05, 0.4);
    rightCheek.rotation.set(0, -0.5, -0.3);
    this.group.add(rightCheek);

    // Shift entire head down slightly
    this.group.position.y = 0.1;
  }

  update(delta, state) {
    // Jaw movement (for speaking)
    const targetJaw = this.morphState.jawOpen * 0.3;
    this.jawPivot.rotation.x = THREE.MathUtils.lerp(this.jawPivot.rotation.x, targetJaw, 0.15);

    // Eye blink (eyesClosed morph)
    const eyeScale = 1 - this.morphState.eyesClosed * 0.8;
    this.leftEye.scale.y = THREE.MathUtils.lerp(this.leftEye.scale.y, eyeScale, 0.2);
    this.rightEye.scale.y = THREE.MathUtils.lerp(this.rightEye.scale.y, eyeScale, 0.2);
    this.leftPupil.scale.y = this.leftEye.scale.y;
    this.rightPupil.scale.y = this.rightEye.scale.y;

    // Brow raise
    const browOffset = this.morphState.browUp * 0.08;
    this.leftBrow.position.y = THREE.MathUtils.lerp(this.leftBrow.position.y, 0.42 + browOffset, 0.1);
    this.rightBrow.position.y = THREE.MathUtils.lerp(this.rightBrow.position.y, 0.42 + browOffset, 0.1);
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
