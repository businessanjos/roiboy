const { app, BrowserWindow, ipcMain, session, protocol, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store();

// ============= CRITICAL: Block whatsapp:// protocol COMPLETELY =============

// Remove as default handler
app.removeAsDefaultProtocolClient('whatsapp');

// Block protocol at app level BEFORE anything else
app.on('open-url', (event, url) => {
  if (url.toLowerCase().startsWith('whatsapp:')) {
    console.log('[ROY] BLOCKED open-url:', url);
    event.preventDefault();
    return false;
  }
});

// Register protocol handler to capture and block whatsapp://
app.whenReady().then(() => {
  // Intercept whatsapp:// protocol and do nothing with it
  protocol.registerHttpProtocol('whatsapp', (request, callback) => {
    console.log('[ROY] BLOCKED protocol request:', request.url);
    // Don't call callback - effectively blocks the request
  });
});

// Block ALL external protocol launches
app.on('web-contents-created', (event, contents) => {
  // Block navigation to whatsapp://
  contents.on('will-navigate', (navEvent, url) => {
    if (url.toLowerCase().startsWith('whatsapp:')) {
      console.log('[ROY] BLOCKED navigation:', url);
      navEvent.preventDefault();
    }
  });
  
  // Block new windows with whatsapp://
  contents.setWindowOpenHandler(({ url }) => {
    if (url.toLowerCase().startsWith('whatsapp:')) {
      console.log('[ROY] BLOCKED window:', url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
  
  // CRITICAL: Block protocol handler execution
  contents.on('will-frame-navigate', (navEvent, url) => {
    if (url.toLowerCase().startsWith('whatsapp:')) {
      console.log('[ROY] BLOCKED frame navigation:', url);
      navEvent.preventDefault();
    }
  });
});

// Override shell.openExternal to block whatsapp://
const originalOpenExternal = shell.openExternal;
shell.openExternal = async (url, options) => {
  if (url.toLowerCase().startsWith('whatsapp:')) {
    console.log('[ROY] BLOCKED shell.openExternal:', url);
    return Promise.resolve();
  }
  return originalOpenExternal(url, options);
};

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
  // Create session and block whatsapp:// protocol at the request level
  const whatsappSession = session.fromPartition('persist:whatsapp');
  
  // CRITICAL: Block ALL requests to whatsapp:// protocol
  whatsappSession.webRequest.onBeforeRequest({ urls: ['whatsapp://*', 'whatsapp:*'] }, (details, callback) => {
    console.log('[ROY] BLOQUEADO request para:', details.url);
    callback({ cancel: true });
  });

  // Also intercept redirects
  whatsappSession.webRequest.onBeforeRedirect((details) => {
    if (details.redirectURL && details.redirectURL.startsWith('whatsapp:')) {
      console.log('[ROY] BLOQUEADO redirect para:', details.redirectURL);
    }
  });

  whatsappWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'whatsapp-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      session: whatsappSession,
      webSecurity: true
    },
    title: 'WhatsApp Web - ROY',
    show: true
  });

  // Set User-Agent to mimic Chrome browser
  whatsappWindow.webContents.setUserAgent(CHROME_USER_AGENT);
  
  // Block ALL attempts to open whatsapp:// URLs
  whatsappWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('whatsapp:')) {
      console.log('[ROY] Bloqueando window.open:', url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Block navigation
  whatsappWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('whatsapp:')) {
      console.log('[ROY] Bloqueando navegação:', url);
      event.preventDefault();
    }
  });

  // Handle errors
  whatsappWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('[ROY] Falha ao carregar:', errorCode, errorDescription, validatedURL);
  });

  console.log('[ROY] Carregando WhatsApp Web...');
  whatsappWindow.loadURL('https://web.whatsapp.com');
  whatsappWindow.setMenuBarVisibility(false);

  // CRITICAL: Inject blocker IMMEDIATELY and EARLY
  whatsappWindow.webContents.on('did-start-loading', () => {
    whatsappWindow.webContents.executeJavaScript(`
      // Block whatsapp:// protocol at every level
      (function() {
        console.log('[ROY] Injetando bloqueadores EARLY...');
        
        // Block link clicks
        document.addEventListener('click', function(e) {
          const target = e.target.closest('a');
          if (target && target.href && target.href.toLowerCase().startsWith('whatsapp:')) {
            console.log('[ROY] BLOCKED click on whatsapp link');
            e.preventDefault();
            e.stopPropagation();
            return false;
          }
        }, true);
      })();
    `).catch(() => {});
  });

  whatsappWindow.webContents.on('dom-ready', () => {
    whatsappWindow.webContents.executeJavaScript(`
      // Comprehensive whatsapp:// protocol blocker
      (function() {
        console.log('[ROY] Proteções anti-redirect DOM-READY ativadas');
        
        // 1. Override createElement
        const originalCreateElement = document.createElement.bind(document);
        document.createElement = function(tagName, options) {
          const element = originalCreateElement(tagName, options);
          if (tagName.toLowerCase() === 'a') {
            const desc = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, 'href');
            Object.defineProperty(element, 'href', {
              get: desc.get,
              set: function(value) {
                if (value && value.toString().toLowerCase().startsWith('whatsapp:')) {
                  console.log('[ROY] BLOCKED href set to whatsapp://');
                  return;
                }
                desc.set.call(this, value);
              },
              configurable: true
            });
          }
          return element;
        };
        
        // 2. Override window.open
        const originalOpen = window.open;
        window.open = function(url, ...args) {
          if (url && url.toString().toLowerCase().startsWith('whatsapp:')) {
            console.log('[ROY] BLOCKED window.open to whatsapp://');
            return null;
          }
          return originalOpen.apply(this, [url, ...args]);
        };
        
        // 3. Override location.assign and location.replace
        const originalAssign = window.location.assign.bind(window.location);
        const originalReplace = window.location.replace.bind(window.location);
        
        window.location.assign = function(url) {
          if (url && url.toString().toLowerCase().startsWith('whatsapp:')) {
            console.log('[ROY] BLOCKED location.assign to whatsapp://');
            return;
          }
          return originalAssign(url);
        };
        
        window.location.replace = function(url) {
          if (url && url.toString().toLowerCase().startsWith('whatsapp:')) {
            console.log('[ROY] BLOCKED location.replace to whatsapp://');
            return;
          }
          return originalReplace(url);
        };
        
        // 4. Block all whatsapp:// links on click
        document.addEventListener('click', function(e) {
          const target = e.target.closest('a');
          if (target && target.href && target.href.toLowerCase().startsWith('whatsapp:')) {
            console.log('[ROY] BLOCKED click on whatsapp:// link');
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
          }
        }, true);
        
        // 5. MutationObserver to remove any whatsapp:// links that appear
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === 1) {
                const links = node.querySelectorAll ? node.querySelectorAll('a[href^="whatsapp:"]') : [];
                links.forEach(link => {
                  console.log('[ROY] REMOVED whatsapp:// link');
                  link.removeAttribute('href');
                  link.style.pointerEvents = 'none';
                });
                if (node.tagName === 'A' && node.href && node.href.toLowerCase().startsWith('whatsapp:')) {
                  node.removeAttribute('href');
                  node.style.pointerEvents = 'none';
                }
              }
            });
          });
        });
        
        observer.observe(document.body || document.documentElement, {
          childList: true,
          subtree: true
        });
        
        console.log('[ROY] Todas as proteções ativadas com sucesso');
      })();
    `).catch(err => console.error('[ROY] Erro ao injetar script:', err));
  });

  // Debug mode
  if (process.argv.includes('--dev')) {
    whatsappWindow.webContents.openDevTools({ mode: 'detach' });
  }

  whatsappWindow.on('closed', () => {
    whatsappWindow = null;
    stopCapture('whatsapp');
    updateMainWindow('whatsapp-status', { connected: false });
  });

  whatsappWindow.webContents.on('did-finish-load', () => {
    const url = whatsappWindow.webContents.getURL();
    console.log('[ROY] WhatsApp Web carregado:', url);
    setTimeout(checkWhatsAppReady, 2000);
  });
}

async function checkWhatsAppReady() {
  if (!whatsappWindow) {
    console.log('[ROY] WhatsApp window não existe');
    return;
  }

  try {
    // Enhanced detection for WhatsApp Business Web
    const result = await whatsappWindow.webContents.executeJavaScript(`
      (function() {
        try {
          // Check for conversation list items (most reliable indicator)
          const chatListItems = document.querySelectorAll('[data-testid="cell-frame-container"]');
          const hasChats = chatListItems.length > 0;
          
          // Check for conversation list by aria role
          const listbox = document.querySelector('[role="listbox"]') || 
                         document.querySelector('[aria-label*="Lista de conversas"]') ||
                         document.querySelector('[aria-label*="Chat list"]');
          
          // Check for side panel (conversations list) - WhatsApp Business Web
          const sidePanel = document.getElementById('side') || 
                           document.getElementById('pane-side') ||
                           document.querySelector('#side') ||
                           document.querySelector('[class*="side"]') ||
                           document.querySelector('div[tabindex] > div > div > div'); // Generic nested structure
          
          // Check for chat rows with avatars
          const avatars = document.querySelectorAll('[data-testid="cell-frame-container"] img');
          const hasAvatars = avatars.length > 0;
          
          // Check for search input (visible when logged in)
          const searchInput = document.querySelector('[data-testid="chat-list-search"]') ||
                             document.querySelector('input[title*="Pesquisar"]') ||
                             document.querySelector('input[title*="Search"]') ||
                             document.querySelector('[contenteditable="true"][data-tab]') ||
                             document.querySelector('div[contenteditable="true"]');
          
          // Check for header with user menu
          const userMenu = document.querySelector('[data-testid="menu"]') ||
                          document.querySelector('[aria-label*="Menu"]') ||
                          document.querySelector('[title*="Menu"]');
          
          // Check for "Archived" text (only visible when logged in) - Portuguese and English
          const pageText = document.body.innerText || '';
          const hasArchivedText = pageText.includes('Arquivadas') || pageText.includes('Archived');
          
          // Check div count (logged in has many more elements)
          const divCount = document.querySelectorAll('div').length;
          const hasManyDivs = divCount > 150;
          
          // Check for QR code (if visible, NOT logged in)
          const qrCanvas = document.querySelector('canvas[aria-label*="QR"]') || 
                          document.querySelector('[data-ref]');
          const hasQR = !!qrCanvas;
          
          // Check for WhatsApp Business specific elements
          const businessBadge = document.querySelector('[data-testid="business-badge"]') ||
                               pageText.includes('WhatsApp Business');
          
          const debug = {
            hasChats: hasChats,
            chatCount: chatListItems.length,
            hasListbox: !!listbox,
            sidePanel: !!sidePanel,
            hasAvatars: hasAvatars,
            avatarCount: avatars.length,
            searchInput: !!searchInput,
            userMenu: !!userMenu,
            hasArchivedText: hasArchivedText,
            divCount: divCount,
            hasManyDivs: hasManyDivs,
            hasQR: hasQR,
            isBusiness: !!businessBadge,
            url: window.location.href
          };
          
          console.log('[ROY Debug]', JSON.stringify(debug));
          
          // Logged in if: has chats OR has avatars OR (has many divs AND no QR) OR has archived text
          const isLoggedIn = hasChats || hasAvatars || hasArchivedText || 
                            (hasManyDivs && !hasQR) || 
                            (!!searchInput && !hasQR) ||
                            (!!listbox && !hasQR);
          
          return { ready: isLoggedIn, debug: debug };
        } catch(e) {
          console.error('[ROY] Detection error:', e);
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
        window.__roySentIds = window.__roySentIds || new Set();
        
        console.log('[ROY] Script de captura injetado');
        
        // Function to extract phone from chat header
        function extractPhoneFromChat() {
          // Try multiple selectors for WhatsApp Business
          const selectors = [
            'header span[dir="auto"][title]',
            'header [data-testid="conversation-info-header"] span',
            '#main header span[title]',
            'header ._amig span',
            '[data-testid="conversation-panel-wrapper"] header span[title]'
          ];
          
          for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el) {
              const text = el.getAttribute('title') || el.innerText || '';
              // Match phone pattern
              const phoneMatch = text.match(/\\+[0-9\\s()-]{10,20}/);
              if (phoneMatch) {
                return phoneMatch[0].replace(/[\\s()-]/g, '');
              }
              // If no + sign, try to find number patterns
              const numbersMatch = text.match(/[0-9]{10,15}/);
              if (numbersMatch) {
                return '+' + numbersMatch[0];
              }
            }
          }
          
          // Try to get from contact info drawer if open
          const contactInfo = document.querySelector('[data-testid="contact-info-drawer"] span[data-testid="cell-phone"]');
          if (contactInfo) {
            const phone = contactInfo.innerText.replace(/[\\s()-]/g, '');
            return phone.startsWith('+') ? phone : '+' + phone;
          }
          
          return '';
        }
        
        // Function to check if it's a group chat
        function isGroupChat() {
          const groupIndicators = [
            '[data-testid="group-subject"]',
            '[aria-label*="grupo"]',
            '[aria-label*="group"]'
          ];
          return groupIndicators.some(sel => document.querySelector(sel));
        }
        
        // Process a single message
        function processMessage(msgElement) {
          try {
            const msgId = msgElement.getAttribute('data-id') || '';
            
            // Skip if already processed
            if (!msgId || window.__roySentIds.has(msgId)) return;
            
            const isOutgoing = msgElement.classList.contains('message-out') || 
                              msgElement.querySelector('[data-testid="msg-check"]') !== null;
            
            // Get message text
            const textElement = msgElement.querySelector('[data-testid="msg-text"]') || 
                               msgElement.querySelector('.selectable-text') ||
                               msgElement.querySelector('span.selectable-text');
            
            if (!textElement) return;
            
            const text = textElement.innerText || textElement.textContent;
            if (!text || text.trim().length < 2) return;
            
            const phone = extractPhoneFromChat();
            const isGroup = isGroupChat();
            
            // Mark as sent to avoid duplicates
            window.__roySentIds.add(msgId);
            
            // Clean up old entries
            if (window.__roySentIds.size > 2000) {
              const arr = Array.from(window.__roySentIds);
              window.__roySentIds = new Set(arr.slice(-1000));
            }
            
            console.log('[ROY] Capturando mensagem:', { 
              id: msgId, 
              phone, 
              direction: isOutgoing ? 'out' : 'in',
              textLength: text.length,
              isGroup
            });
            
            window.electronAPI.capturedMessage({
              platform: 'whatsapp',
              id: msgId,
              text: text.trim(),
              direction: isOutgoing ? 'team_to_client' : 'client_to_team',
              timestamp: new Date().toISOString(),
              phone: phone,
              isGroup: isGroup
            });
            
          } catch (e) {
            console.error('[ROY] Erro ao processar mensagem:', e);
          }
        }
        
        // Scan existing messages in current chat
        function scanCurrentChat() {
          const messages = document.querySelectorAll('[data-testid="msg-container"]');
          console.log('[ROY] Escaneando', messages.length, 'mensagens existentes');
          messages.forEach(processMessage);
        }
        
        // Set up mutation observer for new messages
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === 1) {
                // Check if node itself is a message
                if (node.getAttribute && node.getAttribute('data-testid') === 'msg-container') {
                  processMessage(node);
                }
                // Check for nested messages
                const messages = node.querySelectorAll ? node.querySelectorAll('[data-testid="msg-container"]') : [];
                messages.forEach(processMessage);
              }
            });
          });
        });
        
        // Start observing
        function startObserving() {
          const chatContainer = document.querySelector('#main') || document.querySelector('[data-testid="conversation-panel-wrapper"]');
          if (chatContainer) {
            observer.observe(chatContainer, { childList: true, subtree: true });
            console.log('[ROY] Observer ativo no chat');
            scanCurrentChat();
          } else {
            setTimeout(startObserving, 2000);
          }
        }
        
        startObserving();
        
        // Re-scan when chat changes
        let lastChatPhone = '';
        setInterval(() => {
          const currentPhone = extractPhoneFromChat();
          if (currentPhone && currentPhone !== lastChatPhone) {
            lastChatPhone = currentPhone;
            console.log('[ROY] Chat mudou para:', currentPhone);
            setTimeout(scanCurrentChat, 500);
          }
        }, 2000);
        
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
