const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store();

// API Configuration - ROY Backend
const API_BASE_URL = 'https://mtzoavtbtqflufyccern.supabase.co/functions/v1';

let mainWindow = null;
let whatsappWindow = null;
let zoomWindow = null;
let meetWindow = null;
let authData = null;

// Capture states
let captureState = {
  whatsapp: { isCapturing: false, interval: null, messagesSent: 0 },
  zoom: { isCapturing: false, interval: null, participantsDetected: 0 },
  meet: { isCapturing: false, interval: null, participantsDetected: 0 }
};

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 920,
    minWidth: 400,
    minHeight: 700,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    title: 'ROY Desktop'
  });

  mainWindow.loadFile('renderer/index.html');
  mainWindow.setMenuBarVisibility(false);
}

// ============= WhatsApp Window =============
// Modern Chrome User-Agent to bypass WhatsApp browser check
const CHROME_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function createWhatsAppWindow() {
  whatsappWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'whatsapp-preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'WhatsApp Web - ROY',
    show: true
  });

  // Set User-Agent before loading
  whatsappWindow.webContents.setUserAgent(CHROME_USER_AGENT);
  
  whatsappWindow.loadURL('https://web.whatsapp.com');
  whatsappWindow.setMenuBarVisibility(false);

  whatsappWindow.on('closed', () => {
    whatsappWindow = null;
    stopCapture('whatsapp');
    updateMainWindow('whatsapp-status', { connected: false });
  });

  whatsappWindow.webContents.on('did-finish-load', () => {
    checkWhatsAppReady();
  });
}

async function checkWhatsAppReady() {
  if (!whatsappWindow) return;

  try {
    const isReady = await whatsappWindow.webContents.executeJavaScript(`
      (function() {
        const mainPanel = document.querySelector('[data-testid="chat-list"]');
        return !!mainPanel;
      })()
    `);

    updateMainWindow('whatsapp-status', { 
      connected: isReady,
      message: isReady ? 'Conectado' : 'Aguardando login...'
    });

    if (isReady && !captureState.whatsapp.isCapturing) {
      startCapture('whatsapp');
    } else if (!isReady) {
      setTimeout(checkWhatsAppReady, 3000);
    }
  } catch (error) {
    console.error('[ROY] Erro ao verificar WhatsApp:', error);
    setTimeout(checkWhatsAppReady, 5000);
  }
}

// ============= Zoom Window =============
function createZoomWindow() {
  zoomWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'zoom-preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'Zoom - ROY',
    show: true
  });

  zoomWindow.loadURL('https://zoom.us/wc');
  zoomWindow.setMenuBarVisibility(false);

  zoomWindow.on('closed', () => {
    zoomWindow = null;
    stopCapture('zoom');
    updateMainWindow('zoom-status', { connected: false });
  });

  zoomWindow.webContents.on('did-finish-load', () => {
    checkZoomReady();
  });
}

async function checkZoomReady() {
  if (!zoomWindow) return;

  try {
    const isInMeeting = await zoomWindow.webContents.executeJavaScript(`
      (function() {
        // Check if in meeting by looking for participant list or meeting controls
        const meetingControls = document.querySelector('[class*="meeting-control"]') || 
                               document.querySelector('[class*="participants"]') ||
                               document.querySelector('[aria-label*="participant"]');
        return !!meetingControls;
      })()
    `);

    updateMainWindow('zoom-status', { 
      connected: isInMeeting,
      message: isInMeeting ? 'Em reunião' : 'Aguardando reunião...'
    });

    if (isInMeeting && !captureState.zoom.isCapturing) {
      startCapture('zoom');
    }

    // Keep checking
    setTimeout(checkZoomReady, 5000);
  } catch (error) {
    console.error('[ROY] Erro ao verificar Zoom:', error);
    setTimeout(checkZoomReady, 5000);
  }
}

// ============= Google Meet Window =============
function createMeetWindow() {
  meetWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'meet-preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'Google Meet - ROY',
    show: true
  });

  meetWindow.loadURL('https://meet.google.com');
  meetWindow.setMenuBarVisibility(false);

  meetWindow.on('closed', () => {
    meetWindow = null;
    stopCapture('meet');
    updateMainWindow('meet-status', { connected: false });
  });

  meetWindow.webContents.on('did-finish-load', () => {
    checkMeetReady();
  });
}

async function checkMeetReady() {
  if (!meetWindow) return;

  try {
    const isInMeeting = await meetWindow.webContents.executeJavaScript(`
      (function() {
        // Check if in meeting by looking for specific elements
        const meetingLayout = document.querySelector('[data-meeting-code]') || 
                             document.querySelector('[data-participant-id]') ||
                             document.querySelector('[jscontroller="kAPMuc"]');
        return !!meetingLayout;
      })()
    `);

    updateMainWindow('meet-status', { 
      connected: isInMeeting,
      message: isInMeeting ? 'Em reunião' : 'Aguardando reunião...'
    });

    if (isInMeeting && !captureState.meet.isCapturing) {
      startCapture('meet');
    }

    // Keep checking
    setTimeout(checkMeetReady, 5000);
  } catch (error) {
    console.error('[ROY] Erro ao verificar Meet:', error);
    setTimeout(checkMeetReady, 5000);
  }
}

// ============= Capture Functions =============
function startCapture(platform) {
  if (captureState[platform].isCapturing || !authData) return;

  captureState[platform].isCapturing = true;
  console.log(`[ROY] Iniciando captura ${platform}...`);

  updateMainWindow(`${platform}-capture`, { 
    capturing: true,
    message: 'Capturando...'
  });

  if (platform === 'whatsapp') {
    injectWhatsAppCaptureScript();
    captureState.whatsapp.interval = setInterval(() => {
      injectWhatsAppCaptureScript();
    }, 5000);
  } else if (platform === 'zoom') {
    captureState.zoom.interval = setInterval(() => {
      extractZoomParticipants();
    }, 10000);
  } else if (platform === 'meet') {
    captureState.meet.interval = setInterval(() => {
      extractMeetParticipants();
    }, 10000);
  }
}

function stopCapture(platform) {
  captureState[platform].isCapturing = false;
  if (captureState[platform].interval) {
    clearInterval(captureState[platform].interval);
    captureState[platform].interval = null;
  }

  updateMainWindow(`${platform}-capture`, { 
    capturing: false,
    message: 'Parado'
  });
}

// ============= WhatsApp Capture =============
async function injectWhatsAppCaptureScript() {
  if (!whatsappWindow) return;

  try {
    await whatsappWindow.webContents.executeJavaScript(`
      (function() {
        if (window.__royInjected) return;
        window.__royInjected = true;
        window.__royMessages = window.__royMessages || [];
        
        console.log('[ROY] Script de captura injetado');
        
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
            
            if (!textElement) return;
            
            const text = textElement.innerText;
            const chatHeader = document.querySelector('header [title]');
            let phone = '';
            
            if (chatHeader) {
              const title = chatHeader.getAttribute('title');
              const phoneMatch = title.match(/\\+?[0-9\\s-]{10,}/);
              if (phoneMatch) {
                phone = phoneMatch[0].replace(/[\\s-]/g, '');
              }
            }
            
            const msgId = msgElement.getAttribute('data-id') || Date.now().toString();
            
            if (window.__royMessages.includes(msgId)) return;
            window.__royMessages.push(msgId);
            
            if (window.__royMessages.length > 1000) {
              window.__royMessages = window.__royMessages.slice(-500);
            }
            
            window.electronAPI.capturedMessage({
              platform: 'whatsapp',
              id: msgId,
              text: text,
              direction: isOutgoing ? 'team_to_client' : 'client_to_team',
              timestamp: new Date().toISOString(),
              phone: phone
            });
            
          } catch (e) {
            console.error('[ROY] Erro ao processar mensagem:', e);
          }
        }
        
        const chatContainer = document.querySelector('#main');
        if (chatContainer) {
          observer.observe(chatContainer, { childList: true, subtree: true });
        }
      })()
    `);
  } catch (error) {
    console.error('[ROY] Erro ao injetar script WhatsApp:', error);
  }
}

// ============= Zoom Capture =============
async function extractZoomParticipants() {
  if (!zoomWindow || !authData) return;

  try {
    const participants = await zoomWindow.webContents.executeJavaScript(`
      (function() {
        const participants = [];
        
        // Try different selectors for participant list
        const participantElements = document.querySelectorAll('[class*="participant-item"]') ||
                                   document.querySelectorAll('[aria-label*="participant"]');
        
        participantElements.forEach(el => {
          const nameEl = el.querySelector('[class*="name"]') || el;
          const name = nameEl.innerText || nameEl.textContent;
          if (name && name.trim()) {
            participants.push({
              name: name.trim(),
              joinTime: new Date().toISOString()
            });
          }
        });
        
        return participants;
      })()
    `);

    if (participants.length > 0) {
      // Get meeting info
      const meetingInfo = await zoomWindow.webContents.executeJavaScript(`
        (function() {
          const meetingId = document.querySelector('[class*="meeting-id"]')?.innerText || 'unknown';
          const title = document.title || 'Zoom Meeting';
          return { meetingId, title };
        })()
      `);

      await sendToAPI('zoom-participants', {
        platform: 'zoom',
        meetingId: meetingInfo.meetingId,
        title: meetingInfo.title,
        participants: participants
      });

      captureState.zoom.participantsDetected += participants.length;
      updateStats();
    }
  } catch (error) {
    console.error('[ROY] Erro ao extrair participantes Zoom:', error);
  }
}

// ============= Meet Capture =============
async function extractMeetParticipants() {
  if (!meetWindow || !authData) return;

  try {
    const participants = await meetWindow.webContents.executeJavaScript(`
      (function() {
        const participants = [];
        
        // Try different selectors for participant list
        const participantElements = document.querySelectorAll('[data-participant-id]') ||
                                   document.querySelectorAll('[jscontroller="ES310d"]');
        
        participantElements.forEach(el => {
          const nameEl = el.querySelector('[class*="name"]') || el;
          const name = nameEl.innerText || nameEl.textContent;
          if (name && name.trim()) {
            participants.push({
              name: name.trim(),
              joinTime: new Date().toISOString()
            });
          }
        });
        
        return participants;
      })()
    `);

    if (participants.length > 0) {
      // Get meeting info from URL
      const meetingCode = await meetWindow.webContents.executeJavaScript(`
        window.location.pathname.split('/').pop() || 'unknown'
      `);

      await sendToAPI('meet-participants', {
        platform: 'meet',
        meetingId: meetingCode,
        title: 'Google Meet',
        participants: participants
      });

      captureState.meet.participantsDetected += participants.length;
      updateStats();
    }
  } catch (error) {
    console.error('[ROY] Erro ao extrair participantes Meet:', error);
  }
}

// ============= API Functions =============
async function sendToAPI(endpoint, data) {
  if (!authData || !authData.apiKey) {
    console.error('[ROY] Não autenticado');
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': authData.apiKey
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (response.ok) {
      console.log(`[ROY] Dados enviados para ${endpoint}:`, result);
    } else {
      console.error(`[ROY] Erro ao enviar para ${endpoint}:`, result);
    }

    return result;
  } catch (error) {
    console.error(`[ROY] Erro de rede (${endpoint}):`, error);
    throw error;
  }
}

async function sendWhatsAppMessageToAPI(messageData) {
  if (!authData) return;

  // Use session_token (JWT) for authentication - it's more reliable
  const authToken = authData.session_token || authData.apiKey;
  if (!authToken) return;

  try {
    // Format phone to E.164
    let phoneE164 = messageData.phone || '';
    if (phoneE164 && !phoneE164.startsWith('+')) {
      phoneE164 = '+' + phoneE164.replace(/\D/g, '');
    }

    // Map direction values
    const direction = messageData.direction === 'team_to_client' 
      ? 'team_to_client' 
      : 'client_to_team';

    const payload = {
      phone_e164: phoneE164,
      content_text: messageData.text,
      direction: direction,
      sent_at: messageData.timestamp || new Date().toISOString(),
      source: 'extension'
    };

    console.log('[ROY] Enviando mensagem:', { phone: phoneE164, direction });

    const response = await fetch(`${API_BASE_URL}/ingest-whatsapp-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': authToken
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (response.ok) {
      captureState.whatsapp.messagesSent++;
      updateStats();
      console.log('[ROY] Mensagem enviada com sucesso:', result);
    } else {
      console.error('[ROY] Erro da API:', result);
    }
  } catch (error) {
    console.error('[ROY] Erro ao enviar mensagem:', error);
  }
}

// ============= UI Helpers =============
function updateMainWindow(channel, data) {
  if (mainWindow) {
    mainWindow.webContents.send(channel, data);
  }
}

function updateStats() {
  if (mainWindow) {
    mainWindow.webContents.send('stats-update', {
      whatsappMessages: captureState.whatsapp.messagesSent,
      zoomParticipants: captureState.zoom.participantsDetected,
      meetParticipants: captureState.meet.participantsDetected,
      lastSync: new Date().toLocaleTimeString()
    });
  }
}

// ============= IPC Handlers =============
ipcMain.handle('login', async (event, { email, password }) => {
  try {
    const response = await fetch(`${API_BASE_URL}/extension-auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (response.ok && (data.apiKey || data.session_token)) {
      // Store both apiKey and session_token for authentication
      authData = {
        ...data,
        apiKey: data.apiKey || data.api_key,
        session_token: data.session_token
      };
      store.set('authData', authData);
      console.log('[ROY] Login bem-sucedido, token armazenado');
      return { success: true, user: data.user };
    } else {
      return { success: false, error: data.error || 'Credenciais inválidas' };
    }
  } catch (error) {
    console.error('[ROY] Erro de login:', error);
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
  stopCapture('whatsapp');
  stopCapture('zoom');
  stopCapture('meet');
  if (whatsappWindow) whatsappWindow.close();
  if (zoomWindow) zoomWindow.close();
  if (meetWindow) meetWindow.close();
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

ipcMain.handle('open-zoom', async () => {
  if (zoomWindow) {
    zoomWindow.focus();
  } else {
    createZoomWindow();
  }
  return { success: true };
});

ipcMain.handle('open-meet', async () => {
  if (meetWindow) {
    meetWindow.focus();
  } else {
    createMeetWindow();
  }
  return { success: true };
});

ipcMain.on('captured-message', async (event, messageData) => {
  console.log('[ROY] Mensagem capturada:', messageData);
  
  if (messageData.platform === 'whatsapp' && messageData.phone && messageData.text) {
    await sendWhatsAppMessageToAPI(messageData);
  }
});

// ============= App Lifecycle =============
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
  stopCapture('whatsapp');
  stopCapture('zoom');
  stopCapture('meet');
});
