const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const { spawn, exec } = require('child_process')

let mainWindow = null
let frpcProcess = null
let serverProcess = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: '樱花 MC 启动器',
    backgroundColor: '#0f0f1a',
    icon: path.join(__dirname, 'build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, 'web/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  const template = [
    {
      label: '文件',
      submenu: [
        { label: '打开游戏目录', click: () => openGameDir() },
        { type: 'separator' },
        { label: '退出', role: 'quit' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo' },
        { label: '重做', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', role: 'cut' },
        { label: '复制', role: 'copy' },
        { label: '粘贴', role: 'paste' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { label: '重新加载', role: 'reload' },
        { label: '开发者工具', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: '全屏', role: 'togglefullscreen' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        { label: '关于樱花MC启动器', click: () => showAbout() },
        { label: 'GitHub 仓库', click: () => shell.openExternal('https://github.com/qw2548er/SakuraMC-Launcher') },
        { label: '樱花穿透官网', click: () => shell.openExternal('https://www.natfrp.com/') }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function openGameDir() {
  const gameDir = app.getPath('userData') + '/.minecraft'
  if (!fs.existsSync(gameDir)) fs.mkdirSync(gameDir, { recursive: true })
  shell.openPath(gameDir)
}

function showAbout() {
  dialog.showMessageBox(mainWindow, {
    title: '关于樱花MC启动器',
    message: '樱花 MC 启动器 v0.1.0',
    detail: '跨平台 Minecraft Java 版启动器 + 完整樱花穿透控制台\n\n基于 Uniapp Vue3 + Electron 构建\n© 2024 SakuraMC Team',
    type: 'info',
    buttons: ['确定']
  })
}

// IPC: 启动 Minecraft
ipcMain.handle('launch-minecraft', async (event, cmd) => {
  return new Promise((resolve) => {
    try {
      const child = exec(cmd, { cwd: app.getPath('userData') })
      child.stdout.on('data', (data) => {
        event.sender.send('mc-log', data.toString())
      })
      child.stderr.on('data', (data) => {
        event.sender.send('mc-log', data.toString())
      })
      child.on('close', (code) => {
        resolve({ code })
      })
    } catch (e) {
      resolve({ error: e.message })
    }
  })
})

// IPC: 启动 frpc
ipcMain.handle('start-frpc', async (event, { binaryPath, configPath }) => {
  if (frpcProcess) return { error: 'frpc 已在运行' }
  return new Promise((resolve) => {
    try {
      frpcProcess = spawn(binaryPath || 'frpc', ['-c', configPath])
      frpcProcess.stdout.on('data', (data) => {
        event.sender.send('frpc-log', data.toString())
      })
      frpcProcess.stderr.on('data', (data) => {
        event.sender.send('frpc-log', data.toString())
      })
      frpcProcess.on('close', () => {
        frpcProcess = null
        event.sender.send('frpc-stopped')
      })
      resolve({ pid: frpcProcess.pid })
    } catch (e) {
      resolve({ error: e.message })
    }
  })
})

ipcMain.handle('stop-frpc', async () => {
  if (frpcProcess) {
    frpcProcess.kill()
    frpcProcess = null
    return { stopped: true }
  }
  return { stopped: false }
})

// IPC: 选择文件
ipcMain.handle('select-file', async (event, filters) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters || []
  })
  return result.filePaths[0] || null
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
  if (frpcProcess) frpcProcess.kill()
  if (serverProcess) serverProcess.kill()
})

app.on('activate', () => {
  if (mainWindow === null) createWindow()
})
