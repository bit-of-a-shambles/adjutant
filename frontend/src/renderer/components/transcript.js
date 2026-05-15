/**
 * Transcript overlay — shows user speech and Adjutant responses.
 */
class Transcript {
  constructor() {
    this.container = document.getElementById('transcript-text');
    this.streamBuffer = '';
    this.fadeTimeout = null;
  }

  addUserText(text) {
    this.clearFadeTimeout();
    const el = document.createElement('div');
    el.className = 'user-text';
    el.textContent = `> ${text}`;
    this.container.appendChild(el);
    this.trimOld();
    this.scheduleFade();
  }

  startStream() {
    this.clearFadeTimeout();
    this.streamBuffer = '';
    this.streamEl = document.createElement('div');
    this.streamEl.className = 'adjutant-text';
    this.container.appendChild(this.streamEl);
  }

  appendChunk(text) {
    this.streamBuffer += text;
    if (this.streamEl) {
      this.streamEl.textContent = this.streamBuffer;
    }
    this.container.scrollTop = this.container.scrollHeight;
  }

  endStream() {
    this.streamEl = null;
    this.streamBuffer = '';
    this.scheduleFade();
  }

  trimOld() {
    while (this.container.children.length > 6) {
      this.container.removeChild(this.container.firstChild);
    }
  }

  scheduleFade() {
    this.clearFadeTimeout();
    this.fadeTimeout = setTimeout(() => {
      this.container.style.transition = 'opacity 2s';
      this.container.style.opacity = '0.3';
    }, 10000);
  }

  clearFadeTimeout() {
    if (this.fadeTimeout) clearTimeout(this.fadeTimeout);
    this.container.style.transition = 'opacity 0.3s';
    this.container.style.opacity = '1';
  }
}
