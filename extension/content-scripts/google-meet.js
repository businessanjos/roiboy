// ROI Boy - Google Meet Content Script
(function() {
  'use strict';

  console.log('[ROI Boy] Google Meet content script loaded');

  let isCapturing = false;
  let trackedParticipants = new Set();
  let meetingInfo = null;
  let participantObserver = null;

  // Initialize
  function init() {
    waitForMeetLoad().then(() => {
      console.log('[ROI Boy] Google Meet loaded');
      startCapture();
    });
  }

  // Wait for Google Meet to load
  function waitForMeetLoad() {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        // Check for meeting indicators
        const inMeeting = document.querySelector('[data-meeting-title]') ||
                          document.querySelector('[data-self-name]') ||
                          document.querySelector('[jsname="r4nke"]');
        
        if (inMeeting) {
          clearInterval(checkInterval);
          setTimeout(resolve, 2000);
        }
      }, 1000);

      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 30000);
    });
  }

  // Start capturing
  function startCapture() {
    if (isCapturing) return;
    isCapturing = true;

    extractMeetingInfo();
    observeParticipants();
    
    // Periodic scan
    setInterval(scanParticipants, 5000);

    console.log('[ROI Boy] Google Meet capture started');
  }

  // Extract meeting info
  function extractMeetingInfo() {
    // Get meeting code from URL
    const urlMatch = window.location.pathname.match(/\/([a-z]{3}-[a-z]{4}-[a-z]{3})/);
    const meetingCode = urlMatch ? urlMatch[1] : null;

    // Get meeting title
    const titleElement = document.querySelector('[data-meeting-title]');
    const meetingTitle = titleElement?.getAttribute('data-meeting-title') || 
                         titleElement?.textContent?.trim() || 
                         'Google Meet';

    meetingInfo = {
      meetingId: meetingCode,
      title: meetingTitle,
      platform: 'google_meet',
      startTime: new Date().toISOString()
    };

    console.log('[ROI Boy] Google Meet info:', meetingInfo);
  }

  // Observe participants
  function observeParticipants() {
    if (participantObserver) {
      participantObserver.disconnect();
    }

    participantObserver = new MutationObserver(() => {
      scanParticipants();
    });

    // Watch the main container
    const container = document.querySelector('[jsname="r4nke"]') ||
                      document.querySelector('c-wiz') ||
                      document.body;

    if (container) {
      participantObserver.observe(container, {
        childList: true,
        subtree: true
      });
    }
  }

  // Scan for participants
  function scanParticipants() {
    // Participant name selectors for Google Meet
    const nameSelectors = [
      '[data-self-name]',
      '[data-participant-id] [jsname="Xqg0A"]',
      '.ZjFb7c',
      '.zWGUib',
      '[data-requested-participant-id]',
      '.cS7aqe'
    ];

    nameSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(processParticipant);
    });

    // Try to get from video tiles
    const videoTiles = document.querySelectorAll('[data-participant-id]');
    videoTiles.forEach(tile => {
      const nameEl = tile.querySelector('[jsname="Xqg0A"]') ||
                     tile.querySelector('.zWGUib') ||
                     tile.querySelector('.ZjFb7c');
      if (nameEl) {
        processParticipantByName(nameEl.textContent);
      }
    });

    // Try to open participants panel if possible
    tryOpenParticipantsPanel();
  }

  // Try to read participants from panel
  function tryOpenParticipantsPanel() {
    // Look for participants panel content
    const participantsList = document.querySelectorAll('[jsname="gDJRdd"]');
    participantsList.forEach(item => {
      const nameEl = item.querySelector('.zWGUib');
      if (nameEl) {
        processParticipantByName(nameEl.textContent);
      }
    });
  }

  // Process participant element
  function processParticipant(element) {
    let name = element.getAttribute('data-self-name') || 
               element.textContent?.trim();
    processParticipantByName(name);
  }

  // Process by name
  function processParticipantByName(name) {
    if (!name || trackedParticipants.has(name)) {
      return;
    }

    // Skip common non-participant text
    if (name.length < 2 || name === 'You' || name === 'Você') {
      return;
    }

    trackedParticipants.add(name);

    const participantData = {
      name: name,
      meetingId: meetingInfo?.meetingId,
      meetingTitle: meetingInfo?.title,
      joinTime: new Date().toISOString(),
      platform: 'google_meet'
    };

    console.log('[ROI Boy] New Google Meet participant:', participantData);

    chrome.runtime.sendMessage({
      type: 'GOOGLE_MEET_PARTICIPANT',
      payload: participantData
    }).catch(err => {
      console.error('[ROI Boy] Error sending Meet participant:', err);
    });
  }

  // Listen for messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PING') {
      sendResponse({
        status: 'active',
        capturing: isCapturing,
        participants: trackedParticipants.size,
        meetingInfo
      });
    }
    return true;
  });

  // Initialize
  init();
})();
