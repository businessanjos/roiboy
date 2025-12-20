const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store();

// API Configuration - ROY Backend
const API_BASE_URL = 'https://mtzoavtbtqflufyccern.supabase.co/functions/v1';

// ROY Dashboard URL
const ROY_DASHBOARD_URL = 'https://cxroy.lovable.app';

let mainWindow = null;
let whatsappWindow = null;
let zoomWindow = null;
let meetWindow = null;
let dashboardWindow = null;
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
  // Use persist partition to save session/cookies
  const ses = session.fromPartition('persist:whatsapp');
  
  whatsappWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'whatsapp-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      session: ses,
      // Allow features WhatsApp needs
      webSecurity: true,
      allowRunningInsecureContent: false
    },
    title: 'WhatsApp Web - ROY',
    show: true
  });

  // Set User-Agent before loading
  ses.setUserAgent(CHROME_USER_AGENT);
  whatsappWindow.webContents.setUserAgent(CHROME_USER_AGENT);
  
  // Set permission handler for notifications, media, etc.
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['notifications', 'media', 'mediaKeySystem', 'clipboard-read', 'clipboard-sanitized-write'];
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  });
  
  whatsappWindow.loadURL('https://web.whatsapp.com');
  whatsappWindow.setMenuBarVisibility(false);

  // Open DevTools in dev mode to see logs
  if (process.argv.includes('--dev')) {
    whatsappWindow.webContents.openDevTools({ mode: 'detach' });
  }

  whatsappWindow.on('closed', () => {
    whatsappWindow = null;
    stopCapture('whatsapp');
    updateMainWindow('whatsapp-status', { connected: false });
  });

  whatsappWindow.webContents.on('did-finish-load', () => {
    console.log('[ROY] WhatsApp Web carregado, verificando status...');
    checkWhatsAppReady();
  });
  
  // Also check when DOM is ready
  whatsappWindow.webContents.on('dom-ready', () => {
    console.log('[ROY] WhatsApp DOM ready');
  });
}

async function checkWhatsAppReady() {
  if (!whatsappWindow) {
    console.log('[ROY] WhatsApp window não existe');
    return;
  }

  try {
    // Simple detection - just check if we're past the QR code screen
    const result = await whatsappWindow.webContents.executeJavaScript(`
      (function() {
        try {
          // Method 1: Check for QR code (if visible, NOT logged in)
          const qrCanvas = document.querySelector('canvas');
          const qrDiv = document.querySelector('[data-ref]');
          const hasQR = qrCanvas || qrDiv;
          
          // Method 2: Check for side panel (conversations list)
          const sidePanel = document.getElementById('side') || 
                           document.getElementById('pane-side') ||
                           document.querySelector('#side') ||
                           document.querySelector('[id="side"]');
          
          // Method 3: Check for any header with contact info
          const header = document.querySelector('header');
          const hasHeader = header && header.querySelector('[title]');
          
          // Method 4: Check URL - if we're on web.whatsapp.com without QR
          const isWhatsApp = window.location.hostname.includes('whatsapp');
          
          // Method 5: Check for the app wrapper with content
          const appDiv = document.getElementById('app');
          const hasApp = appDiv && appDiv.children.length > 2;
          
          // Method 6: Check for search box (only visible when logged in)
          const searchBox = document.querySelector('[data-testid="chat-list-search"]') ||
                           document.querySelector('[title*="Pesquisar"]') ||
                           document.querySelector('[title*="Search"]') ||
                           document.querySelector('input[title]');
          
          // Method 7: Simple div count heuristic
          const divCount = document.querySelectorAll('div').length;
          const hasManyDivs = divCount > 100;
          
          const debug = {
            hasQR: !!hasQR,
            sidePanel: !!sidePanel,
            hasHeader: !!hasHeader,
            hasApp: !!hasApp,
            searchBox: !!searchBox,
            divCount: divCount,
            hasManyDivs: hasManyDivs,
            url: window.location.href
          };
          
          console.log('[ROY Debug]', JSON.stringify(debug));
          
          // If we have many divs and no QR, we're probably logged in
          const isLoggedIn = !hasQR && (sidePanel || hasHeader || searchBox || (hasManyDivs && hasApp));
          
          return { ready: isLoggedIn, debug: debug };
        } catch(e) {
          return { ready: false, error: e.message };
        }
      })()
    `);

    console.log('[ROY] WhatsApp check result:', JSON.stringify(result));

    const isReady = result && result.ready;

    updateMainWindow('whatsapp-status', { 
      connected: isReady,
      message: isReady ? 'Conectado' : 'Aguardando login...'
    });

    if (isReady && !captureState.whatsapp.isCapturing) {
      console.log('[ROY] Iniciando captura WhatsApp...');
      startCapture('whatsapp');
    }
    
    // Keep checking
    setTimeout(checkWhatsAppReady, isReady ? 10000 : 2000);
  } catch (error) {
    console.error('[ROY] Erro ao verificar WhatsApp:', error.message);
    setTimeout(checkWhatsAppReady, 3000);
  }
}

// Force WhatsApp connection status (for manual override)
function forceWhatsAppConnected() {
  if (!whatsappWindow) return;
  
  console.log('[ROY] Forçando conexão WhatsApp...');
  
  updateMainWindow('whatsapp-status', { 
    connected: true,
    message: 'Conectado (manual)'
  });
  
  if (!captureState.whatsapp.isCapturing) {
    startCapture('whatsapp');
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

// ============= Dashboard Window =============
function createDashboardWindow() {
  dashboardWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'ROY - Dashboard',
    show: true
  });

  // Set modern Chrome User-Agent
  dashboardWindow.webContents.setUserAgent(CHROME_USER_AGENT);
  
  dashboardWindow.loadURL(ROY_DASHBOARD_URL);
  dashboardWindow.setMenuBarVisibility(false);

  dashboardWindow.on('closed', () => {
    dashboardWindow = null;
  });

  // Open external links in default browser
  dashboardWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(ROY_DASHBOARD_URL)) {
      require('electron').shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
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

ipcMain.handle('open-dashboard', async () => {
  if (dashboardWindow) {
    dashboardWindow.focus();
  } else {
    createDashboardWindow();
  }
  return { success: true };
});

// Force WhatsApp connection manually
ipcMain.handle('force-whatsapp-connection', async () => {
  if (!whatsappWindow) {
    return { success: false, error: 'WhatsApp window not open' };
  }
  
  forceWhatsAppConnected();
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
