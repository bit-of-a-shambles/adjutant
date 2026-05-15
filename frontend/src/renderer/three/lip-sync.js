/**
 * Lip sync driver — analyzes audio playback amplitude
 * and maps it to face morph targets.
 */
class LipSync {
  constructor(head, animController) {
    this.head = head;
    this.animController = animController;
    this.audioContext = null;
    this.analyser = null;
    this.dataArray = null;
    this.isActive = false;
  }

  async playAndSync(audioPath) {
    try {
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      // Fetch the audio file
      const response = await fetch(`file://${audioPath}`);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      // Create source and analyser
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);

      this.isActive = true;
      this.animController.setLipSyncActive(true);

      source.start(0);
      this.updateLoop();

      source.onended = () => {
        this.isActive = false;
        this.animController.setLipSyncActive(false);
        this.head.setMorph('jawOpen', 0);
        this.head.setMorph('mouthWidth', 0);
      };
    } catch (err) {
      console.error('Lip sync error:', err);
      this.isActive = false;
      this.animController.setLipSyncActive(false);
    }
  }

  updateLoop() {
    if (!this.isActive) return;

    this.analyser.getByteFrequencyData(this.dataArray);

    // Low frequencies → jaw open
    let lowSum = 0;
    for (let i = 0; i < 8; i++) {
      lowSum += this.dataArray[i];
    }
    const jawOpen = Math.min(1, (lowSum / 8) / 180);

    // Mid frequencies → mouth width
    let midSum = 0;
    for (let i = 8; i < 32; i++) {
      midSum += this.dataArray[i];
    }
    const mouthWidth = Math.min(1, (midSum / 24) / 160);

    this.head.setMorph('jawOpen', jawOpen);
    this.head.setMorph('mouthWidth', mouthWidth);

    requestAnimationFrame(() => this.updateLoop());
  }
}
