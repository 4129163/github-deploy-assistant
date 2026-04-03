// 桌面精灵核心代码
const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron')
const path = require('path')
let petWindow = null

function createPetWindow() {
  petWindow = new BrowserWindow({
    width: 150,
    height: 150,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  petWindow.loadFile(path.join(__dirname, 'pet.html'))
  petWindow.setIgnoreMouseEvents(false)
  // 拖拽功能
  let pos = { x: 0, y: 0 }
  petWindow.on('mousedown', (e) => {
    pos = { x: e.screenX - petWindow.getPosition()[0], y: e.screenY - petWindow.getPosition()[1] }
  })
  petWindow.on('mousemove', (e) => {
    if (e.buttons === 1) {
      petWindow.setPosition(e.screenX - pos.x, e.screenY - pos.y)
    }
  })
}

// 指令处理
ipcMain.handle('pet:execute-command', async (event, command) => {
  // 对接现有API，处理用户指令
  const { handleCommand } = require('./command-handler')
  return await handleCommand(command)
})

app.whenReady().then(() => {
  createPetWindow()
  // 全局快捷键唤醒
  globalShortcut.register('Alt+G', () => {
    petWindow.show()
    petWindow.focus()
  })
})
