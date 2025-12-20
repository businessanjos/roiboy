const { contextBridge, ipcRenderer } = require('electron');

// Expose limited API to WhatsApp Web context
contextBridge.exposeInMainWorld('electronAPI', {
  capturedMessage: (data) => ipcRenderer.send('captured-message', data)
});

console.log('[ROY] WhatsApp preload carregado');
