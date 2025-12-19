// ROI Boy Popup Script

document.addEventListener('DOMContentLoaded', init);

// DOM Elements
const loginView = document.getElementById('login-view');
const mainView = document.getElementById('main-view');
const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const userBadge = document.getElementById('user-badge');
const userName = document.getElementById('user-name');

// Stats elements
const whatsappCount = document.getElementById('whatsapp-count');
const zoomCount = document.getElementById('zoom-count');
const meetCount = document.getElementById('meet-count');
const lastSyncText = document.getElementById('last-sync-text');

// Integration status elements
const integrationIcon = document.getElementById('integration-icon');
const integrationName = document.getElementById('integration-name');
const integrationIndicator = document.getElementById('integration-indicator');

// Quick action buttons
const openWhatsApp = document.getElementById('open-whatsapp');
const openZoom = document.getElementById('open-zoom');
const openMeet = document.getElementById('open-meet');

// Initialize
async function init() {
  const response = await sendMessage({ type: 'CHECK_AUTH' });
  
  if (response.success && response.data) {
    showMainView(response.data);
    updateStats();
    checkCurrentTab();
  } else {
    showLoginView();
  }

  setupEventListeners();
}

// Setup event listeners
function setupEventListeners() {
  loginForm.addEventListener('submit', handleLogin);
  logoutBtn.addEventListener('click', handleLogout);
  
  openWhatsApp.addEventListener('click', () => openUrl('https://web.whatsapp.com'));
  openZoom.addEventListener('click', () => openUrl('https://zoom.us/join'));
  openMeet.addEventListener('click', () => openUrl('https://meet.google.com'));
}

// Handle login
async function handleLogin(e) {
  e.preventDefault();
  
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  setLoading(true);
  hideError();
  
  try {
    const response = await sendMessage({
      type: 'LOGIN',
      payload: { email, password }
    });
    
    if (response.success) {
      showMainView(response.data);
      updateStats();
    } else {
      showError(response.error || 'Erro ao fazer login');
    }
  } catch (error) {
    showError('Erro de conexão. Tente novamente.');
  } finally {
    setLoading(false);
  }
}

// Handle logout
async function handleLogout() {
  await sendMessage({ type: 'LOGOUT' });
  showLoginView();
}

// Show login view
function showLoginView() {
  loginView.classList.remove('hidden');
  mainView.classList.add('hidden');
  userBadge.classList.add('hidden');
}

// Show main view
function showMainView(authData) {
  loginView.classList.add('hidden');
  mainView.classList.remove('hidden');
  
  if (authData?.user) {
    userBadge.classList.remove('hidden');
    userName.textContent = authData.user.name || authData.user.email;
  }
}

// Update stats
async function updateStats() {
  const response = await sendMessage({ type: 'GET_STATS' });
  
  if (response.success && response.data) {
    const stats = response.data;
    
    whatsappCount.textContent = stats.whatsapp?.messages || 0;
    zoomCount.textContent = stats.zoom?.meetings || 0;
    meetCount.textContent = stats.googleMeet?.meetings || 0;
    
    // Find most recent sync
    const syncs = [
      stats.whatsapp?.lastSync,
      stats.zoom?.lastSync,
      stats.googleMeet?.lastSync
    ].filter(Boolean);
    
    if (syncs.length > 0) {
      const lastSync = new Date(Math.max(...syncs.map(s => new Date(s))));
      lastSyncText.textContent = `Última sincronização: ${formatTime(lastSync)}`;
    }
  }
}

// Check current tab for integration
async function checkCurrentTab() {
  const response = await sendMessage({ type: 'GET_INTEGRATION_STATUS' });
  
  if (response.success && response.data) {
    const { type, connected } = response.data;
    
    switch (type) {
      case 'whatsapp':
        integrationIcon.textContent = '💬';
        integrationName.textContent = 'WhatsApp Web';
        break;
      case 'zoom':
        integrationIcon.textContent = '📹';
        integrationName.textContent = 'Zoom';
        break;
      case 'google-meet':
        integrationIcon.textContent = '🎥';
        integrationName.textContent = 'Google Meet';
        break;
      default:
        integrationIcon.textContent = '📱';
        integrationName.textContent = 'Nenhuma integração ativa';
    }
    
    if (connected) {
      integrationIndicator.classList.remove('inactive');
      integrationIndicator.classList.add('active');
      integrationIndicator.querySelector('.status-text').textContent = 'Ativo';
    } else {
      integrationIndicator.classList.remove('active');
      integrationIndicator.classList.add('inactive');
      integrationIndicator.querySelector('.status-text').textContent = 'Inativo';
    }
  }
}

// Open URL in new tab
function openUrl(url) {
  chrome.tabs.create({ url });
}

// Send message to background script
function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      resolve(response || { success: false, error: 'No response' });
    });
  });
}

// Set loading state
function setLoading(loading) {
  loginBtn.disabled = loading;
  loginBtn.querySelector('.btn-text').classList.toggle('hidden', loading);
  loginBtn.querySelector('.btn-loading').classList.toggle('hidden', !loading);
}

// Show error
function showError(message) {
  loginError.textContent = message;
  loginError.classList.remove('hidden');
}

// Hide error
function hideError() {
  loginError.classList.add('hidden');
}

// Format time
function formatTime(date) {
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'agora';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min atrás`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h atrás`;
  
  return date.toLocaleDateString('pt-BR');
}

// Refresh stats periodically
setInterval(updateStats, 10000);
