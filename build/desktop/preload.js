const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('sakuraAPI', {
  launchMinecraft: (cmd) => ipcRenderer.invoke('launch-minecraft', cmd),
  startFrpc: (opts) => ipcRenderer.invoke('start-frpc', opts),
  stopFrpc: () => ipcRenderer.invoke('stop-frpc'),
  selectFile: (filters) => ipcRenderer.invoke('select-file', filters),
  onMcLog: (callback) => ipcRenderer.on('mc-log', (_, data) => callback(data)),
  onFrpcLog: (callback) => ipcRenderer.on('frpc-log', (_, data) => callback(data)),
  onFrpcStopped: (callback) => ipcRenderer.on('frpc-stopped', () => callback()),
  isElectron: true
})
