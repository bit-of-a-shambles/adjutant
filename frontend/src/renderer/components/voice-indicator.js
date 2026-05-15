/**
 * Voice indicator — shows mic/processing state.
 */
class VoiceIndicator {
  constructor() {
    this.dot = document.getElementById('voice-dot');
    this.label = document.getElementById('voice-label');
  }

  setState(state) {
    // Remove all state classes
    this.dot.className = '';

    switch (state) {
      case 'idle':
        this.label.textContent = 'STANDBY';
        break;
      case 'listening':
        this.dot.className = 'listening';
        this.label.textContent = 'RECORDING';
        break;
      case 'processing':
        this.dot.className = 'processing';
        this.label.textContent = 'PROCESSING';
        break;
      case 'speaking':
        this.dot.className = 'speaking';
        this.label.textContent = 'TRANSMITTING';
        break;
      case 'alert':
        this.dot.className = 'speaking';
        this.label.textContent = 'ALERT';
        break;
    }
  }
}
