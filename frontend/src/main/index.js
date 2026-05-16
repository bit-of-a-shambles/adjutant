const { app, BrowserWindow, Tray, Menu, globalShortcut, nativeImage, screen, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let dashboardWindow;
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

function createDashboardWindow() {
  if (dashboardWindow) {
    dashboardWindow.focus();
    return;
  }

  dashboardWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 500,
    backgroundColor: '#0a0f0a',
    frame: true,
    titleBarStyle: 'hiddenInset',
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: false,
      nodeIntegration: true,
    },
  });

  dashboardWindow.loadFile(path.join(__dirname, '..', 'renderer', 'dashboard.html'));

  dashboardWindow.webContents.on('did-finish-load', () => {
    dashboardWindow.webContents.send('init', { wsUrl: WS_URL });
  });

  dashboardWindow.on('closed', () => {
    dashboardWindow = null;
  });
}

function toggleDashboard() {
  if (dashboardWindow) {
    dashboardWindow.close();
  } else {
    createDashboardWindow();
  }
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
    {
      label: 'Dashboard',
      click: () => toggleDashboard(),
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

  // Dashboard toggle: Cmd+Shift+D
  const registered = globalShortcut.register('CommandOrControl+Shift+D', () => {
    toggleDashboard();
  });
  if (!registered) {
    console.error('Failed to register Cmd+Shift+D shortcut');
  }
}

ipcMain.on('open-dashboard', () => {
  createDashboardWindow();
});

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
