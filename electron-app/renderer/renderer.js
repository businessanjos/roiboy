// DOM Elements
const loginView = document.getElementById('login-view');
const mainView = document.getElementById('main-view');
const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const openWhatsappBtn = document.getElementById('open-whatsapp-btn');

// User elements
const userName = document.getElementById('user-name');
const userEmail = document.getElementById('user-email');
const userAvatar = document.getElementById('user-avatar');

// Status elements
const whatsappStatus = document.getElementById('whatsapp-status');
const whatsappIcon = document.getElementById('whatsapp-icon');
const whatsappCard = document.getElementById('whatsapp-card');
const captureStatus = document.getElementById('capture-status');
const captureIcon = document.getElementById('capture-icon');
const captureIndicator = document.getElementById('capture-indicator');

// Stats elements
const messagesSent = document.getElementById('messages-sent');
const lastSync = document.getElementById('last-sync');

// Initialize app
async function init() {
  const result = await window.electronAPI.checkAuth();
  
  if (result.authenticated) {
    showMainView(result.user);
  } else {
    showLoginView();
  }
}

function showLoginView() {
  loginView.style.display = 'flex';
  mainView.style.display = 'none';
}

function showMainView(user) {
  loginView.style.display = 'none';
  mainView.style.display = 'flex';
  
  if (user) {
    userName.textContent = user.name || 'Usuário';
    userEmail.textContent = user.email || '';
    userAvatar.textContent = (user.name || 'U').charAt(0).toUpperCase();
  }
}

function showError(message) {
  loginError.textContent = message;
  loginError.style.display = 'block';
}

function hideError() {
  loginError.style.display = 'none';
}

function setLoading(loading) {
  const btnText = loginBtn.querySelector('.btn-text');
  const btnLoading = loginBtn.querySelector('.btn-loading');
  
  if (loading) {
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline-flex';
    loginBtn.disabled = true;
  } else {
    btnText.style.display = 'inline';
    btnLoading.style.display = 'none';
    loginBtn.disabled = false;
  }
}

// Event Handlers
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();
  setLoading(true);
  
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  try {
    const result = await window.electronAPI.login({ email, password });
    
    if (result.success) {
      showMainView(result.user);
    } else {
      showError(result.error || 'Erro ao fazer login');
    }
  } catch (error) {
    showError('Erro de conexão');
  } finally {
    setLoading(false);
  }
});

logoutBtn.addEventListener('click', async () => {
  await window.electronAPI.logout();
  showLoginView();
  
  // Reset stats
  messagesSent.textContent = '0';
  lastSync.textContent = '--:--';
  updateWhatsAppStatus({ connected: false });
  updateCaptureStatus({ capturing: false });
});

openWhatsappBtn.addEventListener('click', async () => {
  await window.electronAPI.openWhatsApp();
  whatsappStatus.textContent = 'Abrindo...';
});

// Update UI functions
function updateWhatsAppStatus(data) {
  if (data.connected) {
    whatsappStatus.textContent = 'Conectado';
    whatsappIcon.classList.remove('inactive', 'warning');
    whatsappIcon.classList.add('active');
    openWhatsappBtn.textContent = 'Abrir';
  } else {
    whatsappStatus.textContent = data.message || 'Desconectado';
    whatsappIcon.classList.remove('active');
    whatsappIcon.classList.add('inactive');
    openWhatsappBtn.textContent = 'Conectar';
  }
}

function updateCaptureStatus(data) {
  if (data.capturing) {
    captureStatus.textContent = data.message || 'Ativa';
    captureIcon.classList.remove('inactive');
    captureIcon.classList.add('active');
    captureIndicator.classList.add('active');
  } else {
    captureStatus.textContent = data.message || 'Inativa';
    captureIcon.classList.remove('active');
    captureIcon.classList.add('inactive');
    captureIndicator.classList.remove('active');
  }
}

function updateStats(data) {
  if (data.messagesSent !== undefined) {
    messagesSent.textContent = data.messagesSent;
  }
  if (data.lastSync) {
    lastSync.textContent = data.lastSync;
  }
}

// IPC Event Listeners
window.electronAPI.onWhatsAppStatus(updateWhatsAppStatus);
window.electronAPI.onCaptureStatus(updateCaptureStatus);
window.electronAPI.onStatsUpdate(updateStats);

// Initialize
init();
