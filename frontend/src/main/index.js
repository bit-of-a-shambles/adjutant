const { app, BrowserWindow, Tray, Menu, globalShortcut, nativeImage, screen } = require('electron');
const path = require('path');

let mainWindow;
let tray;

const WINDOW_WIDTH = 350;
const WINDOW_HEIGHT = 450;
const WS_URL = 'ws://127.0.0.1:9247';

function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x: 20,
    y: screenHeight - WINDOW_HEIGHT - 20,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    skipTaskbar: true,
    resizable: false,
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: false,
      nodeIntegration: true,
    },
  });

  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // Pass WebSocket URL to renderer
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('init', { wsUrl: WS_URL });
  });
}

function createTray() {
  // Simple tray icon (green circle)
  const icon = nativeImage.createFromBuffer(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAKklEQVQ4y2Ng+M/wn4EKgImaCkYNGDVg1IBRA4bUAAZqJuRRA0YNoBcAAHGAA/H8BuIcAAAAAElFTkSuQmCC',
      'base64'
    )
  );

  tray = new Tray(icon);
  tray.setToolTip('Adjutant');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show/Hide',
      click: () => {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Adjutant',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

function registerShortcuts() {
  // Push-to-talk: Cmd+Shift+A
  globalShortcut.register('CommandOrControl+Shift+A', () => {
    mainWindow.webContents.send('push-to-talk-toggle');
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  registerShortcuts();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  // Don't quit on window close — keep in tray
});
