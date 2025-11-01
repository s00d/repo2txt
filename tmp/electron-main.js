
const { app, BrowserWindow } = require('electron');
const url = 'http://localhost:8765';

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'repo2txt',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  
  win.loadURL(url);
  
  win.on('closed', () => {
    process.exit(0);
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  process.exit(0);
});
