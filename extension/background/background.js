// ROI Boy Extension - Background Service Worker
const API_BASE_URL = 'https://mtzoavtbtqflufyccern.supabase.co/functions/v1';

// State management
let authData = null;
let captureStats = {
  whatsapp: { messages: 0, lastSync: null },
  zoom: { meetings: 0, lastSync: null },
  googleMeet: { meetings: 0, lastSync: null }
};

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('[ROI Boy] Extension installed');
  loadAuthData();
});

// Load auth data from storage
async function loadAuthData() {
  const result = await chrome.storage.local.get(['authData', 'captureStats']);
  if (result.authData) {
    authData = result.authData;
    console.log('[ROI Boy] Auth data loaded');
  }
  if (result.captureStats) {
    captureStats = result.captureStats;
  }
}

// Save auth data to storage
async function saveAuthData(data) {
  authData = data;
  await chrome.storage.local.set({ authData: data });
}

// Save capture stats
async function saveCaptureStats() {
  await chrome.storage.local.set({ captureStats });
}

// Clear auth data
async function clearAuthData() {
  authData = null;
  await chrome.storage.local.remove(['authData']);
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(message, sender) {
  console.log('[ROI Boy] Message received:', message.type);

  switch (message.type) {
    case 'LOGIN':
      return await handleLogin(message.payload);

    case 'LOGOUT':
      return await handleLogout();

    case 'CHECK_AUTH':
      return { success: true, data: authData };

    case 'GET_STATS':
      return { success: true, data: captureStats };

    case 'WHATSAPP_MESSAGE':
      return await handleWhatsAppMessage(message.payload);

    case 'ZOOM_PARTICIPANT':
      return await handleZoomParticipant(message.payload);

    case 'GOOGLE_MEET_PARTICIPANT':
      return await handleGoogleMeetParticipant(message.payload);

    case 'GET_INTEGRATION_STATUS':
      return await getIntegrationStatus(sender.tab);

    default:
      return { success: false, error: 'Unknown message type' };
  }
}

// Login handler
async function handleLogin({ email, password }) {
  try {
    const response = await fetch(`${API_BASE_URL}/extension-auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erro ao fazer login');
    }

    await saveAuthData({
      apiKey: data.apiKey,
      user: data.user,
      accountId: data.accountId
    });

    console.log('[ROI Boy] Login successful');
    return { success: true, data: authData };
  } catch (error) {
    console.error('[ROI Boy] Login error:', error);
    return { success: false, error: error.message };
  }
}

// Logout handler
async function handleLogout() {
  await clearAuthData();
  captureStats = {
    whatsapp: { messages: 0, lastSync: null },
    zoom: { meetings: 0, lastSync: null },
    googleMeet: { meetings: 0, lastSync: null }
  };
  await saveCaptureStats();
  console.log('[ROI Boy] Logged out');
  return { success: true };
}

// WhatsApp message handler
async function handleWhatsAppMessage(payload) {
  if (!authData) {
    console.warn('[ROI Boy] Not authenticated, skipping message');
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/ingest-whatsapp-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authData.apiKey}`
      },
      body: JSON.stringify({
        ...payload,
        source: 'extension'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send message');
    }

    // Update stats
    captureStats.whatsapp.messages++;
    captureStats.whatsapp.lastSync = new Date().toISOString();
    await saveCaptureStats();

    console.log('[ROI Boy] WhatsApp message sent successfully');
    return { success: true };
  } catch (error) {
    console.error('[ROI Boy] Error sending WhatsApp message:', error);
    return { success: false, error: error.message };
  }
}

// Zoom participant handler
async function handleZoomParticipant(payload) {
  if (!authData) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/zoom-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authData.apiKey}`
      },
      body: JSON.stringify({
        event: 'meeting.participant_joined',
        payload: {
          object: {
            participant: payload,
            id: payload.meetingId
          }
        },
        source: 'extension'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send Zoom data');
    }

    captureStats.zoom.meetings++;
    captureStats.zoom.lastSync = new Date().toISOString();
    await saveCaptureStats();

    console.log('[ROI Boy] Zoom participant data sent');
    return { success: true };
  } catch (error) {
    console.error('[ROI Boy] Error sending Zoom data:', error);
    return { success: false, error: error.message };
  }
}

// Google Meet participant handler
async function handleGoogleMeetParticipant(payload) {
  if (!authData) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/google-meet-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authData.apiKey}`
      },
      body: JSON.stringify({
        event: 'participant_joined',
        payload: payload,
        source: 'extension'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send Google Meet data');
    }

    captureStats.googleMeet.meetings++;
    captureStats.googleMeet.lastSync = new Date().toISOString();
    await saveCaptureStats();

    console.log('[ROI Boy] Google Meet participant data sent');
    return { success: true };
  } catch (error) {
    console.error('[ROI Boy] Error sending Google Meet data:', error);
    return { success: false, error: error.message };
  }
}

// Get integration status for current tab
async function getIntegrationStatus(tab) {
  if (!tab?.url) return { success: true, data: { type: 'unknown' } };

  const url = tab.url;
  let type = 'unknown';
  let connected = false;

  if (url.includes('web.whatsapp.com')) {
    type = 'whatsapp';
    connected = true;
  } else if (url.includes('zoom.us')) {
    type = 'zoom';
    connected = true;
  } else if (url.includes('meet.google.com')) {
    type = 'google-meet';
    connected = true;
  }

  return {
    success: true,
    data: {
      type,
      connected,
      authenticated: !!authData
    }
  };
}

// Keep service worker alive
chrome.alarms.create('keepAlive', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    console.log('[ROI Boy] Service worker keepalive');
  }
});
