const { contextBridge, ipcRenderer } = require('electron');

// Expose limited API to Google Meet context
contextBridge.exposeInMainWorld('electronAPI', {
  capturedParticipant: (data) => ipcRenderer.send('captured-participant', { ...data, platform: 'meet' })
});

console.log('[ROY] Meet preload carregado');
