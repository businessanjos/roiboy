const { app, BrowserWindow, ipcMain, session, protocol, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store();

// Enable GPU acceleration for WebGL (needed for QR code canvas)
app.commandLine.appendSwitch('enable-webgl');
app.commandLine.appendSwitch('enable-accelerated-2d-canvas');
app.commandLine.appendSwitch('enable-gpu-rasterization');

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
  whatsapp: { isCapturing: false, interval: null, messagesSent: 0, messagesCaptured: 0, errors: 0 },
  zoom: { isCapturing: false, interval: null, participantsDetected: 0 },
  meet: { isCapturing: false, interval: null, participantsDetected: 0 }
};

// ============= Global Safe Execute JS Helper =============
// Helper function to safely execute JS in any BrowserWindow, handling disposed frame errors
async function safeExecuteJS(browserWindow, script) {
  try {
    if (!browserWindow || browserWindow.isDestroyed()) {
      return null;
    }
    const webContents = browserWindow.webContents;
    if (!webContents || webContents.isDestroyed()) {
      return null;
    }
    return await webContents.executeJavaScript(script);
  } catch (error) {
    // Silently return null for ALL frame-related errors
    const errorMsg = error.message || error.toString();
    if (errorMsg.includes('disposed') || 
        errorMsg.includes('destroyed') || 
        errorMsg.includes('Render frame') ||
        errorMsg.includes('WebFrameMain') ||
        errorMsg.includes('frame was') ||
        errorMsg.includes('webContents')) {
      return null;
    }
    // Log but don't throw for other errors
    console.log('[ROY] safeExecuteJS error (non-critical):', errorMsg.substring(0, 100));
    return null;
  }
}

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
    title: 'ROY APP Desktop'
  });

  mainWindow.loadFile('renderer/index.html');
  mainWindow.setMenuBarVisibility(false);
}

// ============= WhatsApp Window =============
// Modern Chrome User-Agent to bypass WhatsApp browser check (updated Dec 2024)
const CHROME_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function createWhatsAppWindow() {
  // Create session for WhatsApp
  const whatsappSession = session.fromPartition('persist:whatsapp');
  
  // Block whatsapp:// protocol via redirect interception (onBeforeRequest doesn't support custom schemes)
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
      webSecurity: true,
      // Enable WebGL for QR code canvas rendering
      experimentalFeatures: true
    },
    title: 'WhatsApp Web - ROY',
    show: true
  });

  // Set User-Agent to mimic Chrome browser
  whatsappWindow.webContents.setUserAgent(CHROME_USER_AGENT);
  
  // CRITICAL: Hide Electron detection BEFORE any page loads
  whatsappWindow.webContents.on('did-start-navigation', () => {
    safeExecuteJS(whatsappWindow, `
      // Hide Electron/Node.js detection
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en-US', 'en'] });
      
      // Hide Electron-specific properties
      if (window.process) delete window.process;
      if (window.require) delete window.require;
      if (window.module) delete window.module;
      if (window.Buffer) delete window.Buffer;
      
      // Fake Chrome runtime
      if (!window.chrome) {
        window.chrome = {
          runtime: {},
          loadTimes: function() {},
          csi: function() {},
          app: {}
        };
      }
      
      console.log('[ROY] Electron detection hidden');
    `);
  });
  
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
    safeExecuteJS(whatsappWindow, `
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
    `);
  });

  whatsappWindow.webContents.on('dom-ready', () => {
    safeExecuteJS(whatsappWindow, `
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
    `);
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

  // Check if webContents is still valid
  if (whatsappWindow.isDestroyed() || whatsappWindow.webContents.isDestroyed()) {
    console.log('[ROY] WhatsApp window foi destruída');
    return;
  }

  try {
    // Get raw page info first (using global safeExecuteJS)
    const pageInfo = await safeExecuteJS(whatsappWindow, `
      (function() {
        const html = document.documentElement.outerHTML;
        const bodyText = document.body?.innerText || '';
        return {
          url: window.location.href,
          title: document.title,
          divCount: document.querySelectorAll('div').length,
          spanCount: document.querySelectorAll('span').length,
          hasCanvas: !!document.querySelector('canvas'),
          bodyLength: bodyText.length,
          // Look for WhatsApp Business specific elements
          hasAppWrapper: !!document.getElementById('app'),
          hasSidePanel: !!document.querySelector('[data-testid="side"]') || !!document.getElementById('side'),
          hasMainPanel: !!document.getElementById('main'),
          hasChatList: !!document.querySelector('[aria-label*="Chat list"]') || 
                       !!document.querySelector('[aria-label*="Lista de conversas"]') ||
                       !!document.querySelector('[role="grid"]') ||
                       !!document.querySelector('[role="list"]'),
          hasInputBox: !!document.querySelector('[contenteditable="true"]'),
          hasMenuBtn: !!document.querySelector('[data-testid="menu"]') || 
                      !!document.querySelector('[aria-label*="Menu"]'),
          // Check for QR code indicators
          hasQrCode: !!document.querySelector('canvas') && bodyText.includes('QR'),
          hasLinkText: bodyText.includes('Link a device') || bodyText.includes('Vincular'),
          // Check for logged-in indicators
          hasArchived: bodyText.includes('Arquivada') || bodyText.includes('Archived'),
          hasNewChat: bodyText.includes('Nova conversa') || bodyText.includes('New chat'),
          hasChats: bodyText.includes('conversas') || bodyText.includes('chats'),
          sample: bodyText.substring(0, 500)
        };
      })()
    `);
    
    if (!pageInfo) {
      // Window was disposed, try again later
      setTimeout(checkWhatsAppReady, 3000);
      return;
    }

    console.log('[ROY] WhatsApp page info:', JSON.stringify(pageInfo, null, 2));

    // Determine if logged in based on multiple signals
    const notLoggedInSignals = pageInfo.hasQrCode || pageInfo.hasLinkText;
    const loggedInSignals = pageInfo.hasSidePanel || 
                           pageInfo.hasMainPanel || 
                           pageInfo.hasChatList ||
                           pageInfo.hasArchived ||
                           pageInfo.hasNewChat ||
                           pageInfo.hasInputBox ||
                           (pageInfo.divCount > 300 && pageInfo.spanCount > 100);

    const isReady = loggedInSignals && !notLoggedInSignals;
    
    console.log('[ROY] Detection result:', { isReady, loggedInSignals, notLoggedInSignals });

    updateMainWindow('whatsapp-status', { 
      connected: isReady,
      message: isReady ? 'Conectado' : 'Aguardando login...'
    });

    if (isReady && !captureState.whatsapp.isCapturing) {
      console.log('[ROY] WhatsApp conectado! Iniciando captura...');
      startCapture('whatsapp');
    }
    
    // Keep checking
    setTimeout(checkWhatsAppReady, isReady ? 10000 : 3000);
  } catch (error) {
    // Ignore "frame was disposed" errors - they're expected when window is closed
    if (error.message && error.message.includes('disposed')) {
      console.log('[ROY] WhatsApp window foi fechada durante verificação');
      return;
    }
    console.error('[ROY] Erro ao verificar WhatsApp:', error.message);
    // Try to force connection after several failures
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
  if (!zoomWindow || zoomWindow.isDestroyed()) return;

  try {
    const isInMeeting = await safeExecuteJS(zoomWindow, `
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
  if (!meetWindow || meetWindow.isDestroyed()) return;

  try {
    const isInMeeting = await safeExecuteJS(meetWindow, `
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
    // Start heartbeat to notify backend we're connected
    startHeartbeat();
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

  // Stop heartbeat when WhatsApp capture stops
  if (platform === 'whatsapp') {
    stopHeartbeat();
  }

  updateMainWindow(`${platform}-capture`, { 
    capturing: false,
    message: 'Parado'
  });
}

// ============= WhatsApp Capture =============
async function injectWhatsAppCaptureScript() {
  if (!whatsappWindow) return;
  
  // Check if window and webContents are still valid
  if (whatsappWindow.isDestroyed() || whatsappWindow.webContents.isDestroyed()) {
    console.log('[ROY] WhatsApp window foi destruída, pulando injeção');
    return;
  }

  try {
    // First, inject the capture script and get diagnostic info (using global safeExecuteJS)
    const diagnostics = await safeExecuteJS(whatsappWindow, `
      (function() {
        // Initialize message queue if not exists
        window.__royMessageQueue = window.__royMessageQueue || [];
        window.__roySentIds = window.__roySentIds || new Set();
        
        const diag = {
          alreadySetup: !!window.__royObserverSetup,
          queueSize: window.__royMessageQueue.length,
          sentIdsSize: window.__roySentIds.size
        };
        
        if (window.__royObserverSetup) return diag;
        window.__royObserverSetup = true;
        
        // Function to extract phone from chat header
        function extractPhoneFromChat() {
          // Try multiple selectors
          const headerSpans = document.querySelectorAll('#main header span');
          for (const span of headerSpans) {
            const text = span.getAttribute('title') || span.innerText || '';
            // Look for phone pattern
            const phoneMatch = text.match(/\\+?[0-9][0-9\\s()-]{8,20}/);
            if (phoneMatch) {
              return phoneMatch[0].replace(/[\\s()-]/g, '');
            }
          }
          
          // Try contact info drawer
          const contactInfo = document.querySelector('[data-testid="drawer-right"] span[data-testid="cell-phone"]');
          if (contactInfo) {
            const phone = contactInfo.innerText.replace(/[\\s()-]/g, '');
            return phone.startsWith('+') ? phone : '+' + phone;
          }
          
          return '';
        }
        
        function isGroupChat() {
          const header = document.querySelector('#main header');
          if (!header) return false;
          // Groups typically have "clique aqui para informações" or participant count
          const text = header.innerText || '';
          return text.includes('participantes') || text.includes('clique aqui');
        }
        
        function getContactName() {
          const header = document.querySelector('#main header span[title]');
          if (header) return header.getAttribute('title') || header.innerText;
          const spans = document.querySelectorAll('#main header span');
          for (const span of spans) {
            const text = span.innerText || '';
            if (text.length > 2 && !text.includes('clique') && !text.includes('digitando')) {
              return text;
            }
          }
          return '';
        }
        
        function processMessage(msgElement) {
          try {
            const msgId = msgElement.getAttribute('data-id') || 
                         msgElement.getAttribute('data-pre-plain-text') ||
                         Math.random().toString(36).substr(2, 9);
                         
            if (window.__roySentIds.has(msgId)) return null;
            
            // Check if outgoing message
            const isOutgoing = msgElement.classList.contains('message-out') || 
                              !!msgElement.querySelector('[data-icon="msg-check"]') ||
                              !!msgElement.querySelector('[data-icon="msg-dblcheck"]') ||
                              !!msgElement.querySelector('[data-testid="msg-check"]') ||
                              !!msgElement.querySelector('[data-testid="msg-dblcheck"]');
            
            const phone = extractPhoneFromChat();
            const isGroup = isGroupChat();
            const contactName = getContactName();
            
            // DISABLED: Audio detection was causing UI crashes
            // Audio messages will be processed in a separate, safer scan
            // Skip audio elements entirely in the main message processor
            const hasAudioElement = msgElement.querySelector('audio') || 
                                   msgElement.querySelector('[data-testid="ptt"]') ||
                                   msgElement.querySelector('[data-icon="ptt"]');
            
            if (hasAudioElement) {
              // Skip audio messages in real-time processing to avoid crashes
              return null;
            }
            
            // Find text content - try multiple selectors
            let text = '';
            const textSelectors = [
              'span.selectable-text.copyable-text',
              '[data-testid="msg-text"]',
              '.selectable-text',
              'span[dir="ltr"]',
              'span[dir="rtl"]'
            ];
            
            for (const sel of textSelectors) {
              const el = msgElement.querySelector(sel);
              if (el) {
                text = el.innerText || el.textContent || '';
                if (text.trim()) break;
              }
            }
            
            if (!text || text.trim().length < 2) return null;
            
            window.__roySentIds.add(msgId);
            
            // Keep set size manageable
            if (window.__roySentIds.size > 2000) {
              const arr = Array.from(window.__roySentIds);
              window.__roySentIds = new Set(arr.slice(-1000));
            }
            
            const msgData = {
              platform: 'whatsapp',
              id: msgId,
              text: text.trim(),
              direction: isOutgoing ? 'team_to_client' : 'client_to_team',
              timestamp: new Date().toISOString(),
              phone: phone,
              contactName: contactName,
              isGroup: isGroup
            };
            
            window.__royMessageQueue.push(msgData);
            return msgData;
            
          } catch (e) {
            return null;
          }
        }
        
        function scanCurrentChat() {
          // Try multiple selectors for message containers
          const selectors = [
            '[data-testid="msg-container"]',
            '.message-in, .message-out',
            '[class*="message-in"], [class*="message-out"]',
            '[data-pre-plain-text]'
          ];
          
          let messages = [];
          for (const sel of selectors) {
            messages = document.querySelectorAll(sel);
            if (messages.length > 0) break;
          }
          
          let found = 0;
          messages.forEach(msg => {
            const result = processMessage(msg);
            if (result) found++;
          });
          
          diag.scannedMessages = messages.length;
          diag.foundNew = found;
          return found;
        }
        
        // DISABLED MutationObserver - was causing UI crashes when clicking on audio
        // Using polling-based approach instead for stability
        diag.observerActive = false;
        diag.containerFound = !!document.querySelector('#main');
        
        // Initial scan
        const found = scanCurrentChat();
        diag.initialScan = found;
        
        // Poll for new messages more frequently since observer is disabled
        setInterval(() => {
          try {
            scanCurrentChat();
          } catch(e) {
            // Silently ignore scan errors
          }
        }, 3000);
        
        // Monitor for chat changes
        let lastChatName = '';
        setInterval(() => {
          try {
            const currentName = getContactName();
            if (currentName && currentName !== lastChatName) {
              lastChatName = currentName;
              setTimeout(scanCurrentChat, 500);
            }
          } catch(e) {
            // Silently ignore
          }
        }, 2000);
        
        return diag;
      })()
    `);
    
    console.log('[ROY] Diagnóstico captura:', diagnostics);
    
    // Now retrieve any queued messages (using global safeExecuteJS)
    const messages = await safeExecuteJS(whatsappWindow, `
      (function() {
        const queue = window.__royMessageQueue || [];
        window.__royMessageQueue = [];
        return { 
          messages: queue,
          queueSize: queue.length,
          sentIdsSize: window.__roySentIds ? window.__roySentIds.size : 0
        };
      })()
    `);
    
    if (!messages) {
      // Window was disposed, exit gracefully
      return;
    }
    
    if (messages && messages.messages && messages.messages.length > 0) {
      console.log('[ROY] Recuperando', messages.messages.length, 'mensagens da fila (IDs enviados:', messages.sentIdsSize + ')');
      captureState.whatsapp.messagesCaptured += messages.messages.length;
      updateStats();
      
      for (const msg of messages.messages) {
        console.log('[ROY] Mensagem:', { 
          direction: msg.direction, 
          phone: msg.phone, 
          contactName: msg.contactName,
          textPreview: msg.text.substring(0, 50) + '...',
          isGroup: msg.isGroup 
        });
        if (msg.text) {
          await sendWhatsAppMessageToAPI(msg);
        }
      }
    }
    
    // Retrieve and process audio messages with safe detection
    await scanWhatsAppAudioMessages();
  } catch (error) {
    // Ignore "frame was disposed" errors - they're expected when window is closed
    if (error.message && error.message.includes('disposed')) {
      console.log('[ROY] WhatsApp window foi fechada durante captura');
      return;
    }
    console.error('[ROY] Erro ao injetar script WhatsApp:', error);
  }
}

// ============= Zoom Capture =============
async function extractZoomParticipants() {
  if (!zoomWindow || zoomWindow.isDestroyed() || !authData) return;

  try {
    const participants = await safeExecuteJS(zoomWindow, `
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

    if (participants && participants.length > 0) {
      // Get meeting info
      const meetingInfo = await safeExecuteJS(zoomWindow, `
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
  if (!meetWindow || meetWindow.isDestroyed() || !authData) return;

  try {
    const participants = await safeExecuteJS(meetWindow, `
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

    if (participants && participants.length > 0) {
      // Get meeting info from URL
      const meetingCode = await safeExecuteJS(meetWindow, `
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

  // Use account_id for authentication - more reliable than JWT which expires
  const accountId = authData.account_id;
  if (!accountId) {
    console.error('[ROY] Sem account_id - faça login novamente');
    return;
  }

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
      phone_e164: phoneE164 || undefined,
      contact_name: messageData.contactName || undefined, // Use name as fallback identifier
      content_text: messageData.text,
      direction: direction,
      sent_at: messageData.timestamp || new Date().toISOString(),
      source: 'extension',
      is_group: messageData.isGroup || false,
      account_id: accountId // Send account_id in payload for authentication
    };

    console.log('[ROY] Enviando mensagem:', { phone: phoneE164, contactName: messageData.contactName, direction });

    const response = await fetch(`${API_BASE_URL}/ingest-whatsapp-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-account-id': accountId // Also send in header
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (response.ok) {
      captureState.whatsapp.messagesSent++;
      updateStats();
      console.log('[ROY] Mensagem enviada com sucesso:', result);
    } else {
      captureState.whatsapp.errors++;
      updateStats();
      console.error('[ROY] Erro da API:', result);
    }
  } catch (error) {
    console.error('[ROY] Erro ao enviar mensagem:', error);
  }
}

// ============= WhatsApp Audio Scan (Safe Method) =============
// Separate scan for audio messages - runs independently to avoid UI crashes
async function scanWhatsAppAudioMessages() {
  if (!whatsappWindow || !authData) return;
  
  // Check if window and webContents are still valid
  if (whatsappWindow.isDestroyed() || whatsappWindow.webContents.isDestroyed()) {
    console.log('[ROY] WhatsApp window foi destruída, pulando scan de áudio');
    return;
  }

  try {
    // Safe audio detection - just collect metadata, don't interact with elements (using global safeExecuteJS)
    const audioMessages = await safeExecuteJS(whatsappWindow, `
      (function() {
        window.__royProcessedAudioIds = window.__royProcessedAudioIds || new Set();
        const audioMsgs = [];
        
        // Function to get chat info
        function getChatInfo() {
          const headerSpans = document.querySelectorAll('#main header span');
          let phone = '';
          let contactName = '';
          
          for (const span of headerSpans) {
            const text = span.getAttribute('title') || span.innerText || '';
            const phoneMatch = text.match(/\\+?[0-9][0-9\\s()-]{8,20}/);
            if (phoneMatch) {
              phone = phoneMatch[0].replace(/[\\s()-]/g, '');
            }
            if (text.length > 2 && !text.includes('clique') && !text.includes('digitando')) {
              if (!contactName) contactName = text;
            }
          }
          
          const header = document.querySelector('#main header');
          const isGroup = header && (header.innerText.includes('participantes') || header.innerText.includes('clique aqui'));
          
          return { phone, contactName, isGroup };
        }
        
        // Find audio/voice message elements safely - try multiple selectors
        const audioContainers = document.querySelectorAll(
          '[data-testid="audio-play"], [data-testid="ptt-play"], ' +
          '[data-icon="audio-play"], [data-icon="ptt-play"], ' +
          'button[aria-label*="Play"], button[aria-label*="Reproduzir"], ' +
          '[data-testid="ptt"], audio'
        );
        
        console.log('[ROY-AUDIO] Encontrados', audioContainers.length, 'elementos de áudio candidatos');
        
        audioContainers.forEach(audioBtn => {
          try {
            // Find parent message container
            const msgContainer = audioBtn.closest('[data-id]') || audioBtn.closest('.message-in, .message-out');
            if (!msgContainer) return;
            
            const msgId = msgContainer.getAttribute('data-id') || 
                         audioBtn.closest('[data-id]')?.getAttribute('data-id') ||
                         'audio_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
            
            if (window.__royProcessedAudioIds.has(msgId)) return;
            
            // Check direction
            const isOutgoing = msgContainer.classList.contains('message-out') || 
                              !!msgContainer.querySelector('[data-icon="msg-check"]') ||
                              !!msgContainer.querySelector('[data-icon="msg-dblcheck"]');
            
            // Try to find duration from the UI
            let durationSec = 0;
            const durationSpan = msgContainer.querySelector('[data-testid="audio-duration"]') ||
                                msgContainer.querySelector('span[dir="auto"]');
            if (durationSpan) {
              const durationText = durationSpan.innerText || '';
              const match = durationText.match(/(\\d+):(\\d+)/);
              if (match) {
                durationSec = parseInt(match[1]) * 60 + parseInt(match[2]);
              }
            }
            
            // Try to find audio element src
            const audioEl = msgContainer.querySelector('audio');
            const audioSrc = audioEl ? audioEl.src : null;
            
            const chatInfo = getChatInfo();
            
            window.__royProcessedAudioIds.add(msgId);
            
            // Keep set size manageable
            if (window.__royProcessedAudioIds.size > 500) {
              const arr = Array.from(window.__royProcessedAudioIds);
              window.__royProcessedAudioIds = new Set(arr.slice(-300));
            }
            
            audioMsgs.push({
              id: msgId,
              direction: isOutgoing ? 'team_to_client' : 'client_to_team',
              durationSec: durationSec,
              audioSrc: audioSrc,
              phone: chatInfo.phone,
              contactName: chatInfo.contactName,
              isGroup: chatInfo.isGroup,
              timestamp: new Date().toISOString()
            });
          } catch (e) {
            // Silently ignore individual element errors
          }
        });
        
        return audioMsgs;
      })()
    `);

    if (audioMessages && audioMessages.length > 0) {
      console.log('[ROY] Encontradas', audioMessages.length, 'mensagens de áudio');
      
      for (const audioData of audioMessages) {
        console.log('[ROY] Processando áudio:', {
          direction: audioData.direction,
          duration: audioData.durationSec + 's',
          phone: audioData.phone,
          hasAudioSrc: !!audioData.audioSrc
        });
        
        await sendWhatsAppAudioToAPI(audioData);
      }
    }
  } catch (error) {
    // Ignore "frame was disposed" errors - they're expected when window is closed
    if (error.message && error.message.includes('disposed')) {
      console.log('[ROY] WhatsApp window foi fechada durante scan de áudio');
      return;
    }
    // Silently ignore other audio scan errors to prevent affecting main capture
    console.log('[ROY] Audio scan info:', error.message);
  }
}

// ============= WhatsApp Audio Capture =============
async function sendWhatsAppAudioToAPI(audioData) {
  if (!authData) return;

  const accountId = authData.account_id;
  if (!accountId) {
    console.error('[ROY] Sem account_id - faça login novamente');
    return;
  }

  try {
    // Format phone to E.164
    let phoneE164 = audioData.phone || '';
    if (phoneE164 && !phoneE164.startsWith('+')) {
      phoneE164 = '+' + phoneE164.replace(/\D/g, '');
    }

    // Map direction values
    const direction = audioData.direction === 'team_to_client' 
      ? 'team_to_client' 
      : 'client_to_team';

    // Try to fetch the audio content if we have a URL (using global safeExecuteJS)
    let audioBase64 = null;
    if (audioData.audioSrc && audioData.audioSrc.startsWith('blob:')) {
      // For blob URLs, we need to fetch from the WhatsApp window context
      audioBase64 = await safeExecuteJS(whatsappWindow, `
        (async function() {
          try {
            const response = await fetch('${audioData.audioSrc}');
            const blob = await response.blob();
            return new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
              };
              reader.readAsDataURL(blob);
            });
          } catch (e) {
            console.error('[ROY] Erro ao buscar áudio:', e);
            return null;
          }
        })()
      `);
    }

    if (!audioBase64) {
      console.log('[ROY] Áudio sem conteúdo base64, registrando apenas metadados');
      // Even without audio content, we can log the audio message event
      // The backend can handle messages without audio content (just metadata)
      const payload = {
        phone_e164: phoneE164 || undefined,
        contact_name: audioData.contactName || undefined,
        direction: direction,
        sent_at: audioData.timestamp || new Date().toISOString(),
        source: 'extension',
        is_group: audioData.isGroup || false,
        account_id: accountId,
        audio_duration_sec: audioData.durationSec || 0,
        audio_format: 'ogg',
        has_audio_content: false
      };

      // Send to regular message endpoint as an audio placeholder
      const response = await fetch(`${API_BASE_URL}/ingest-whatsapp-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-account-id': accountId
        },
        body: JSON.stringify({
          ...payload,
          content_text: '[Áudio - ' + (audioData.durationSec || 0) + 's - sem transcrição disponível]'
        })
      });

      if (response.ok) {
        console.log('[ROY] Áudio (metadados) registrado com sucesso');
      } else {
        console.error('[ROY] Erro ao registrar áudio:', await response.text());
      }
      return;
    }

    const payload = {
      phone_e164: phoneE164 || undefined,
      contact_name: audioData.contactName || undefined,
      direction: direction,
      sent_at: audioData.timestamp || new Date().toISOString(),
      source: 'extension',
      is_group: audioData.isGroup || false,
      account_id: accountId,
      audio_base64: audioBase64,
      audio_duration_sec: audioData.durationSec || 0,
      audio_format: 'ogg'
    };

    console.log('[ROY] Enviando áudio para transcrição:', { 
      phone: phoneE164, 
      contactName: audioData.contactName, 
      direction,
      durationSec: audioData.durationSec,
      audioSize: audioBase64.length
    });

    const response = await fetch(`${API_BASE_URL}/ingest-whatsapp-audio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-account-id': accountId
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (response.ok) {
      captureState.whatsapp.messagesSent++;
      updateStats();
      console.log('[ROY] Áudio transcrito e enviado:', result);
    } else {
      captureState.whatsapp.errors++;
      updateStats();
      console.error('[ROY] Erro na transcrição:', result);
    }
  } catch (error) {
    console.error('[ROY] Erro ao enviar áudio:', error);
    captureState.whatsapp.errors++;
    updateStats();
  }
}

// ============= Heartbeat =============
let heartbeatInterval = null;

async function sendHeartbeat(status = 'connected') {
  if (!authData) return;
  
  try {
    const response = await fetch(`${API_BASE_URL}/whatsapp-heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-account-id': authData.account_id,
        'x-session-token': authData.session_token || authData.apiKey
      },
      body: JSON.stringify({
        status,
        app_version: require('./package.json').version || '1.0.0'
      })
    });
    
    if (response.ok) {
      console.log('[ROY] Heartbeat enviado:', status);
    } else {
      console.error('[ROY] Erro no heartbeat:', await response.text());
    }
  } catch (error) {
    console.error('[ROY] Erro ao enviar heartbeat:', error.message);
  }
}

function startHeartbeat() {
  if (heartbeatInterval) return;
  
  // Send initial heartbeat
  sendHeartbeat('connected');
  
  // Send heartbeat every 5 minutes
  heartbeatInterval = setInterval(() => {
    sendHeartbeat('connected');
  }, 5 * 60 * 1000);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  sendHeartbeat('disconnected');
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
      whatsappCaptured: captureState.whatsapp.messagesCaptured,
      whatsappErrors: captureState.whatsapp.errors,
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

    if (response.ok && (data.apiKey || data.session_token || data.account)) {
      // Store apiKey, session_token, and account_id for authentication
      // account_id is the most reliable as it doesn't expire
      authData = {
        ...data,
        apiKey: data.apiKey || data.api_key,
        session_token: data.session_token,
        account_id: data.account?.id // Store account_id - most reliable auth method
      };
      store.set('authData', authData);
      console.log('[ROY] Login bem-sucedido, account_id:', authData.account_id);
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

// Clear WhatsApp cache and reload
ipcMain.handle('clear-whatsapp-cache', async () => {
  try {
    const whatsappSession = session.fromPartition('persist:whatsapp');
    await whatsappSession.clearStorageData();
    await whatsappSession.clearCache();
    console.log('[ROY] WhatsApp cache cleared');
    
    // Close and reopen WhatsApp window
    if (whatsappWindow) {
      whatsappWindow.close();
      whatsappWindow = null;
    }
    
    setTimeout(() => {
      createWhatsAppWindow();
    }, 500);
    
    return { success: true };
  } catch (error) {
    console.error('[ROY] Error clearing cache:', error);
    return { success: false, error: error.message };
  }
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
