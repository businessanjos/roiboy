const { contextBridge, ipcRenderer } = require('electron');

// Expose limited API to Zoom context
contextBridge.exposeInMainWorld('electronAPI', {
  capturedParticipant: (data) => ipcRenderer.send('captured-participant', { ...data, platform: 'zoom' })
});

console.log('[ROY] Zoom preload carregado');
