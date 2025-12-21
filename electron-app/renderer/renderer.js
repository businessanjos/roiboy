// DOM Elements
const loginView = document.getElementById('login-view');
const mainView = document.getElementById('main-view');
const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const themeToggleBtn = document.getElementById('theme-toggle-btn');

// Platform buttons
const openWhatsappBtn = document.getElementById('open-whatsapp-btn');
const openZoomBtn = document.getElementById('open-zoom-btn');
const openMeetBtn = document.getElementById('open-meet-btn');
const openDashboardBtn = document.getElementById('open-dashboard-btn');

// User elements
const userName = document.getElementById('user-name');
const userEmail = document.getElementById('user-email');
const userAvatar = document.getElementById('user-avatar');

// Status elements
const whatsappStatus = document.getElementById('whatsapp-status');
const zoomStatus = document.getElementById('zoom-status');
const meetStatus = document.getElementById('meet-status');

// Indicator elements
const whatsappIndicator = document.getElementById('whatsapp-indicator');
const zoomIndicator = document.getElementById('zoom-indicator');
const meetIndicator = document.getElementById('meet-indicator');

// Stats elements
const whatsappMessages = document.getElementById('whatsapp-messages');
const whatsappCaptured = document.getElementById('whatsapp-captured');
const whatsappErrors = document.getElementById('whatsapp-errors');
const zoomParticipants = document.getElementById('zoom-participants');
const meetParticipants = document.getElementById('meet-participants');
const lastSync = document.getElementById('last-sync');

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem('roy-theme') || 'dark';
  setTheme(savedTheme);
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('roy-theme', theme);
  updateThemeIcon(theme);
}

function updateThemeIcon(theme) {
  const sunIcon = document.getElementById('theme-icon-sun');
  const moonIcon = document.getElementById('theme-icon-moon');
  
  if (theme === 'dark') {
    sunIcon.style.display = 'block';
    moonIcon.style.display = 'none';
  } else {
    sunIcon.style.display = 'none';
    moonIcon.style.display = 'block';
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
}

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
  whatsappMessages.textContent = '0';
  zoomParticipants.textContent = '0';
  meetParticipants.textContent = '0';
  lastSync.textContent = '--:--';
  
  // Reset statuses
  updatePlatformStatus('whatsapp', { connected: false });
  updatePlatformStatus('zoom', { connected: false });
  updatePlatformStatus('meet', { connected: false });
});

// Platform buttons
const forceWhatsappBtn = document.getElementById('force-whatsapp-btn');

openWhatsappBtn.addEventListener('click', async () => {
  await window.electronAPI.openWhatsApp();
  whatsappStatus.textContent = 'Abrindo...';
});

// Force WhatsApp connection
if (forceWhatsappBtn) {
  forceWhatsappBtn.addEventListener('click', async () => {
    const result = await window.electronAPI.forceWhatsAppConnection();
    if (result.success) {
      whatsappStatus.textContent = 'Conectado (manual)';
      whatsappIndicator.classList.add('active');
    }
  });
}

openZoomBtn.addEventListener('click', async () => {
  await window.electronAPI.openZoom();
  zoomStatus.textContent = 'Abrindo...';
});

openMeetBtn.addEventListener('click', async () => {
  await window.electronAPI.openMeet();
  meetStatus.textContent = 'Abrindo...';
});

openDashboardBtn.addEventListener('click', async () => {
  await window.electronAPI.openDashboard();
});

// Update UI functions
function updatePlatformStatus(platform, data) {
  const statusEl = document.getElementById(`${platform}-status`);
  const indicatorEl = document.getElementById(`${platform}-indicator`);
  const btnEl = document.getElementById(`open-${platform}-btn`);
  
  if (data.connected) {
    statusEl.textContent = data.message || 'Conectado';
    indicatorEl.classList.add('active');
    if (btnEl) btnEl.textContent = 'Abrir';
  } else {
    statusEl.textContent = data.message || 'Desconectado';
    indicatorEl.classList.remove('active');
    if (btnEl) btnEl.textContent = 'Conectar';
  }
}

function updateStats(data) {
  if (data.whatsappMessages !== undefined) {
    whatsappMessages.textContent = data.whatsappMessages;
  }
  if (data.whatsappCaptured !== undefined && whatsappCaptured) {
    whatsappCaptured.textContent = data.whatsappCaptured;
  }
  if (data.whatsappErrors !== undefined && whatsappErrors) {
    if (data.whatsappErrors > 0) {
      whatsappErrors.style.display = 'inline';
      whatsappErrors.querySelector('strong').textContent = data.whatsappErrors;
    }
  }
  if (data.zoomParticipants !== undefined) {
    zoomParticipants.textContent = data.zoomParticipants;
  }
  if (data.meetParticipants !== undefined) {
    meetParticipants.textContent = data.meetParticipants;
  }
  if (data.lastSync) {
    lastSync.textContent = data.lastSync;
  }
}

// IPC Event Listeners
window.electronAPI.onWhatsAppStatus((data) => updatePlatformStatus('whatsapp', data));
window.electronAPI.onZoomStatus((data) => updatePlatformStatus('zoom', data));
window.electronAPI.onMeetStatus((data) => updatePlatformStatus('meet', data));

window.electronAPI.onWhatsAppCapture((data) => {
  if (data.capturing) {
    document.getElementById('whatsapp-indicator').classList.add('active');
  }
});

window.electronAPI.onZoomCapture((data) => {
  if (data.capturing) {
    document.getElementById('zoom-indicator').classList.add('active');
  }
});

window.electronAPI.onMeetCapture((data) => {
  if (data.capturing) {
    document.getElementById('meet-indicator').classList.add('active');
  }
});

window.electronAPI.onStatsUpdate(updateStats);

// Theme toggle
themeToggleBtn.addEventListener('click', toggleTheme);

// Initialize
initTheme();
init();
