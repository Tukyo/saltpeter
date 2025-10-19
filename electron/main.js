const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

let mainWindow;
let server;

// Determine if this is a packaged app (production) or development
const isPackaged = app.isPackaged;
const PORT = isPackaged ? 9999 : 8888;

function startServer() {
  server = http.createServer((req, res) => {
    let filePath = req.url === '/' ? '/index.html' : req.url;

    if (filePath === '/app.js') {
      filePath = path.join(__dirname, '../dist/app.js');
    } else {
      filePath = path.join(__dirname, '../public', filePath);
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end('File not found');
      }

      const ext = path.extname(filePath);
      let contentType = 'text/html';
      if (ext === '.js') contentType = 'application/javascript';
      if (ext === '.css') contentType = 'text/css';
      if (ext === '.png') contentType = 'image/png';
      if (ext === '.jpg') contentType = 'image/jpeg';

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });

  server.listen(PORT);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);
}

app.whenReady().then(() => {
  startServer();
  createWindow();
});

app.on('window-all-closed', () => {
  if (server) server.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});