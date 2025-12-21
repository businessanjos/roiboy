const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Auth
  login: (credentials) => ipcRenderer.invoke('login', credentials),
  checkAuth: () => ipcRenderer.invoke('check-auth'),
  logout: () => ipcRenderer.invoke('logout'),
  
  // Platform Windows
  openWhatsApp: () => ipcRenderer.invoke('open-whatsapp'),
  openZoom: () => ipcRenderer.invoke('open-zoom'),
  openMeet: () => ipcRenderer.invoke('open-meet'),
  openDashboard: () => ipcRenderer.invoke('open-dashboard'),
  
  // Force connection (manual override)
  forceWhatsAppConnection: () => ipcRenderer.invoke('force-whatsapp-connection'),
  
  // Clear WhatsApp cache
  clearWhatsAppCache: () => ipcRenderer.invoke('clear-whatsapp-cache'),
  
  // Events
  onWhatsAppStatus: (callback) => ipcRenderer.on('whatsapp-status', (event, data) => callback(data)),
  onZoomStatus: (callback) => ipcRenderer.on('zoom-status', (event, data) => callback(data)),
  onMeetStatus: (callback) => ipcRenderer.on('meet-status', (event, data) => callback(data)),
  onWhatsAppCapture: (callback) => ipcRenderer.on('whatsapp-capture', (event, data) => callback(data)),
  onZoomCapture: (callback) => ipcRenderer.on('zoom-capture', (event, data) => callback(data)),
  onMeetCapture: (callback) => ipcRenderer.on('meet-capture', (event, data) => callback(data)),
  onStatsUpdate: (callback) => ipcRenderer.on('stats-update', (event, data) => callback(data))
});
