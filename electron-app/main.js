const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store();

// API Configuration - ROI Boy Backend
const API_BASE_URL = 'https://mtzoavtbtqflufyccern.supabase.co/functions/v1';

let mainWindow = null;
let whatsappWindow = null;
let isCapturing = false;
let captureInterval = null;
let authData = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 600,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    title: 'ROI Boy WhatsApp'
  });

  mainWindow.loadFile('renderer/index.html');
  mainWindow.setMenuBarVisibility(false);
}

function createWhatsAppWindow() {
  whatsappWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'whatsapp-preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'WhatsApp Web - ROI Boy',
    show: true
  });

  whatsappWindow.loadURL('https://web.whatsapp.com');
  whatsappWindow.setMenuBarVisibility(false);

  whatsappWindow.on('closed', () => {
    whatsappWindow = null;
    stopCapture();
    if (mainWindow) {
      mainWindow.webContents.send('whatsapp-status', { connected: false });
    }
  });

  // Detectar quando WhatsApp está pronto
  whatsappWindow.webContents.on('did-finish-load', () => {
    checkWhatsAppReady();
  });
}

async function checkWhatsAppReady() {
  if (!whatsappWindow) return;

  try {
    const isReady = await whatsappWindow.webContents.executeJavaScript(`
      (function() {
        // Check if WhatsApp is loaded and user is logged in
        const appElement = document.querySelector('#app');
        const mainPanel = document.querySelector('[data-testid="chat-list"]');
        return !!mainPanel;
      })()
    `);

    if (mainWindow) {
      mainWindow.webContents.send('whatsapp-status', { 
        connected: isReady,
        message: isReady ? 'WhatsApp conectado!' : 'Aguardando login no WhatsApp...'
      });
    }

    if (isReady && !isCapturing) {
      startCapture();
    } else if (!isReady) {
      // Check again in 3 seconds
      setTimeout(checkWhatsAppReady, 3000);
    }
  } catch (error) {
    console.error('Erro ao verificar WhatsApp:', error);
    setTimeout(checkWhatsAppReady, 5000);
  }
}

function startCapture() {
  if (isCapturing || !whatsappWindow || !authData) return;

  isCapturing = true;
  console.log('Iniciando captura de mensagens...');

  if (mainWindow) {
    mainWindow.webContents.send('capture-status', { 
      capturing: true,
      message: 'Capturando mensagens...'
    });
  }

  // Injeta o script de captura
  injectCaptureScript();

  // Verifica periodicamente por novas mensagens
  captureInterval = setInterval(() => {
    extractAndSendMessages();
  }, 5000); // A cada 5 segundos
}

function stopCapture() {
  isCapturing = false;
  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
  }

  if (mainWindow) {
    mainWindow.webContents.send('capture-status', { 
      capturing: false,
      message: 'Captura pausada'
    });
  }
}

async function injectCaptureScript() {
  if (!whatsappWindow) return;

  try {
    await whatsappWindow.webContents.executeJavaScript(`
      (function() {
        if (window.__roiboyInjected) return;
        window.__roiboyInjected = true;
        window.__roiboyMessages = window.__roiboyMessages || [];
        window.__roiboyLastCheck = window.__roiboyLastCheck || Date.now();
        
        console.log('[ROI Boy] Script de captura injetado');
        
        // Observer para detectar novas mensagens
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === 1) {
                const messages = node.querySelectorAll('[data-testid="msg-container"]');
                messages.forEach(processMessage);
              }
            });
          });
        });
        
        function processMessage(msgElement) {
          try {
            const isOutgoing = msgElement.classList.contains('message-out');
            const textElement = msgElement.querySelector('[data-testid="msg-text"], .selectable-text');
            const timeElement = msgElement.querySelector('[data-testid="msg-meta"] span');
            
            if (!textElement) return;
            
            const text = textElement.innerText;
            const time = timeElement ? timeElement.innerText : '';
            
            // Get current chat info
            const headerElement = document.querySelector('[data-testid="conversation-info-header"]');
            const chatName = headerElement ? headerElement.innerText : '';
            
            // Get phone from header or contact info
            const phoneElement = document.querySelector('[data-testid="conversation-info-header"] span');
            let phone = '';
            
            // Try to extract phone from various places
            const chatHeader = document.querySelector('header [title]');
            if (chatHeader) {
              const title = chatHeader.getAttribute('title');
              const phoneMatch = title.match(/\\+?[0-9\\s-]{10,}/);
              if (phoneMatch) {
                phone = phoneMatch[0].replace(/[\\s-]/g, '');
              }
            }
            
            const msgId = msgElement.getAttribute('data-id') || Date.now().toString();
            
            // Check if already processed
            if (window.__roiboyMessages.includes(msgId)) return;
            window.__roiboyMessages.push(msgId);
            
            // Keep only last 1000 message IDs
            if (window.__roiboyMessages.length > 1000) {
              window.__roiboyMessages = window.__roiboyMessages.slice(-500);
            }
            
            // Send to main process
            window.electronAPI.capturedMessage({
              id: msgId,
              text: text,
              direction: isOutgoing ? 'team_to_client' : 'client_to_team',
              timestamp: new Date().toISOString(),
              chatName: chatName,
              phone: phone
            });
            
          } catch (e) {
            console.error('[ROI Boy] Erro ao processar mensagem:', e);
          }
        }
        
        // Start observing
        const chatContainer = document.querySelector('#main');
        if (chatContainer) {
          observer.observe(chatContainer, { childList: true, subtree: true });
          console.log('[ROI Boy] Observer iniciado');
        }
        
        // Process existing messages
        const existingMessages = document.querySelectorAll('[data-testid="msg-container"]');
        console.log('[ROI Boy] Mensagens existentes:', existingMessages.length);
      })()
    `);
  } catch (error) {
    console.error('Erro ao injetar script:', error);
  }
}

async function extractAndSendMessages() {
  if (!whatsappWindow || !authData) return;

  try {
    // O script injetado envia mensagens via IPC, não precisamos fazer nada aqui
    // Apenas re-injetamos caso a página tenha recarregado
    await injectCaptureScript();
  } catch (error) {
    console.error('Erro ao extrair mensagens:', error);
  }
}

async function sendMessageToAPI(messageData) {
  if (!authData || !authData.apiKey) {
    console.error('Não autenticado');
    return;
  }

  try {
    const payload = {
      phone: messageData.phone,
      content: messageData.text,
      direction: messageData.direction,
      sent_at: messageData.timestamp,
      thread_id: messageData.chatName || 'default'
    };

    const response = await fetch(`${API_BASE_URL}/ingest-whatsapp-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': authData.apiKey
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (response.ok) {
      console.log('[ROI Boy] Mensagem enviada:', result);
      updateStats();
    } else {
      console.error('[ROI Boy] Erro ao enviar:', result);
    }

    return result;
  } catch (error) {
    console.error('[ROI Boy] Erro de rede:', error);
    throw error;
  }
}

let messagesSentCount = 0;

function updateStats() {
  messagesSentCount++;
  if (mainWindow) {
    mainWindow.webContents.send('stats-update', {
      messagesSent: messagesSentCount,
      lastSync: new Date().toLocaleTimeString()
    });
  }
}

// IPC Handlers
ipcMain.handle('login', async (event, { email, password }) => {
  try {
    const response = await fetch(`${API_BASE_URL}/extension-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (response.ok && data.apiKey) {
      authData = data;
      store.set('authData', authData);
      return { success: true, user: data.user };
    } else {
      return { success: false, error: data.error || 'Credenciais inválidas' };
    }
  } catch (error) {
    console.error('Erro de login:', error);
    return { success: false, error: 'Erro de conexão' };
  }
});

ipcMain.handle('check-auth', async () => {
  const savedAuth = store.get('authData');
  if (savedAuth && savedAuth.apiKey) {
    authData = savedAuth;
    return { authenticated: true, user: savedAuth.user };
  }
  return { authenticated: false };
});

ipcMain.handle('logout', async () => {
  authData = null;
  store.delete('authData');
  stopCapture();
  if (whatsappWindow) {
    whatsappWindow.close();
  }
  return { success: true };
});

ipcMain.handle('open-whatsapp', async () => {
  if (whatsappWindow) {
    whatsappWindow.focus();
  } else {
    createWhatsAppWindow();
  }
  return { success: true };
});

ipcMain.handle('toggle-capture', async () => {
  if (isCapturing) {
    stopCapture();
  } else {
    startCapture();
  }
  return { capturing: isCapturing };
});

ipcMain.on('captured-message', async (event, messageData) => {
  console.log('[ROI Boy] Mensagem capturada:', messageData);
  
  if (messageData.phone && messageData.text) {
    try {
      await sendMessageToAPI(messageData);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    }
  }
});

// App lifecycle
app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopCapture();
});
