const { ipcRenderer } = require('electron');

window.adjutant = {
  onInit: (callback) => ipcRenderer.on('init', (_event, data) => callback(data)),
  onPushToTalk: (callback) => ipcRenderer.on('push-to-talk-toggle', () => callback()),
};
