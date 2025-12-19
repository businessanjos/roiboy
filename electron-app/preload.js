const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Auth
  login: (credentials) => ipcRenderer.invoke('login', credentials),
  checkAuth: () => ipcRenderer.invoke('check-auth'),
  logout: () => ipcRenderer.invoke('logout'),
  
  // WhatsApp
  openWhatsApp: () => ipcRenderer.invoke('open-whatsapp'),
  toggleCapture: () => ipcRenderer.invoke('toggle-capture'),
  
  // Events
  onWhatsAppStatus: (callback) => ipcRenderer.on('whatsapp-status', (event, data) => callback(data)),
  onCaptureStatus: (callback) => ipcRenderer.on('capture-status', (event, data) => callback(data)),
  onStatsUpdate: (callback) => ipcRenderer.on('stats-update', (event, data) => callback(data))
});
