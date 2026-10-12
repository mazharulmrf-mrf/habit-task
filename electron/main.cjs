const { app, BrowserWindow, Menu, shell } = require('electron')
const path = require('path')

if (!app.requestSingleInstanceLock()) app.quit()

function createWindow() {
  const win = new BrowserWindow({
    width: 460, height: 860, minWidth: 380, minHeight: 600,
    backgroundColor: '#0e0e0d', title: 'Habit-Task',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  })
  Menu.setApplicationMenu(null)
  win.loadFile(path.join(__dirname, '..', 'dist-desktop', 'index.html'))
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' } })
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
