/**
 * Status bar ticker — scrolls feed headlines.
 */
class StatusBar {
  constructor() {
    this.ticker = document.getElementById('ticker');
    this.items = [];
    this.setText('ADJUTANT ONLINE // ALL SYSTEMS NOMINAL // AWAITING ORDERS');
  }

  addItems(newItems) {
    this.items = [...newItems, ...this.items].slice(0, 30);
    this.updateTicker();
  }

  updateTicker() {
    if (this.items.length === 0) return;
    const text = this.items.map(i => i.title).join(' // ');
    this.setText(text);
  }

  setText(text) {
    this.ticker.textContent = text;
  }
}
