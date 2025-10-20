const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

// =============================================================================
// #region Configuration
// =============================================================================

const CONFIG = {
  STEAM_APP_ID: 2437830,
  WINDOW: {
    WIDTH: 1280,
    HEIGHT: 720,
    TITLE: 'Saltpeter'
  },
  SERVER: {
    DEV_PORT: 8888,
    PROD_PORT: 9999
  },
  PATHS: {
    ICON: '../build/icon.ico',
    PRELOAD: 'preload.js',
    DIST: '../dist',
    PUBLIC: '../public'
  }
};

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg'
};

// #endregion
// =============================================================================

// =============================================================================
// #region Steam Integration
// =============================================================================

let steamClient = null;

function initializeSteam() {
  try {
    const steamworks = require('steamworks.js');
    steamClient = steamworks.init(CONFIG.STEAM_APP_ID);
    console.log('🎮 Steam initialized:', steamClient ? 'Success' : 'Failed');
  } catch (err) {
    console.log('⚠️ Running without Steam:', err.message);
  }
}

// #endregion
// =============================================================================

// =============================================================================
// #region Local Server
// =============================================================================

let server = null;

function getServerPort() {
  return app.isPackaged ? CONFIG.SERVER.PROD_PORT : CONFIG.SERVER.DEV_PORT;
}

function getMimeType(filePath) {
  const ext = path.extname(filePath);
  return MIME_TYPES[ext] || 'text/html';
}

function resolveFilePath(requestUrl) {
  if (requestUrl === '/') {
    return path.join(__dirname, CONFIG.PATHS.PUBLIC, 'index.html');
  }

  if (requestUrl === '/app.js') {
    return path.join(__dirname, CONFIG.PATHS.DIST, 'app.js');
  }

  return path.join(__dirname, CONFIG.PATHS.PUBLIC, requestUrl);
}

function handleFileRequest(req, res) {
  const filePath = resolveFilePath(req.url);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('File not found');
    }

    const contentType = getMimeType(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

function startLocalServer() {
  const port = getServerPort();

  server = http.createServer(handleFileRequest);
  server.listen(port);

  console.log(`🌐 Local server running on port ${port}`);
}

function stopLocalServer() {
  if (server) {
    server.close();
    console.log('🛑 Local server stopped');
  }
}

// #endregion
// =============================================================================

// =============================================================================
// #region Window Management
// =============================================================================

let mainWindow = null;

function createMainWindow() {
  const port = getServerPort();

  mainWindow = new BrowserWindow({
    width: CONFIG.WINDOW.WIDTH,
    height: CONFIG.WINDOW.HEIGHT,
    title: CONFIG.WINDOW.TITLE,
    autoHideMenuBar: true,
    icon: path.join(__dirname, CONFIG.PATHS.ICON),
    webPreferences: {
      preload: path.join(__dirname, CONFIG.PATHS.PRELOAD),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadURL(`http://localhost:${port}`);

  console.log(`🪟 Window created: ${CONFIG.WINDOW.TITLE}`);
}

// #endregion
// =============================================================================

// =============================================================================
// #region App Lifecycle
// =============================================================================

function onAppReady() {
  initializeSteam();
  startLocalServer();
  createMainWindow();
}

function onAllWindowsClosed() {
  stopLocalServer();

  // On macOS, apps typically stay open until user quits explicitly
  if (process.platform !== 'darwin') {
    app.quit();
  }
}

function onAppActivate() {
  // On macOS, recreate window when dock icon is clicked and no windows exist
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
}

// #endregion
// =============================================================================

// =============================================================================
// #region Event Listeners
// =============================================================================

app.whenReady().then(onAppReady);
app.on('window-all-closed', onAllWindowsClosed);
app.on('activate', onAppActivate);

// #endregion
// =============================================================================