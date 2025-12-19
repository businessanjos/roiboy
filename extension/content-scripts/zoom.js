// ROI Boy - Zoom Content Script
(function() {
  'use strict';

  console.log('[ROI Boy] Zoom content script loaded');

  let isCapturing = false;
  let trackedParticipants = new Set();
  let meetingInfo = null;
  let participantObserver = null;

  // Initialize
  function init() {
    waitForZoomLoad().then(() => {
      console.log('[ROI Boy] Zoom meeting loaded');
      startCapture();
    });
  }

  // Wait for Zoom to load
  function waitForZoomLoad() {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        // Check for meeting container
        const meetingContainer = document.querySelector('.meeting-client') ||
                                  document.querySelector('#wc-container-left') ||
                                  document.querySelector('[class*="meeting-app"]');
        
        if (meetingContainer) {
          clearInterval(checkInterval);
          setTimeout(resolve, 2000); // Extra delay for full load
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

    // Get meeting info
    extractMeetingInfo();

    // Watch for participants
    observeParticipants();

    // Periodically scan for new participants
    setInterval(scanParticipants, 5000);

    console.log('[ROI Boy] Zoom capture started');
  }

  // Extract meeting info
  function extractMeetingInfo() {
    // Try to get meeting ID from URL
    const urlMatch = window.location.href.match(/\/(\d{9,11})/);
    const meetingId = urlMatch ? urlMatch[1] : null;

    // Try to get meeting title
    const titleElement = document.querySelector('.meeting-topic') ||
                         document.querySelector('[class*="meeting-title"]') ||
                         document.querySelector('.meeting-info-container__topic');
    const meetingTitle = titleElement?.textContent?.trim() || 'Zoom Meeting';

    meetingInfo = {
      meetingId,
      title: meetingTitle,
      platform: 'zoom',
      startTime: new Date().toISOString()
    };

    console.log('[ROI Boy] Meeting info:', meetingInfo);
  }

  // Observe participants panel
  function observeParticipants() {
    if (participantObserver) {
      participantObserver.disconnect();
    }

    participantObserver = new MutationObserver((mutations) => {
      scanParticipants();
    });

    // Watch participants container
    const participantsContainer = document.querySelector('.participants-section-container') ||
                                   document.querySelector('[class*="participants-list"]') ||
                                   document.querySelector('#wc-container-left');

    if (participantsContainer) {
      participantObserver.observe(participantsContainer, {
        childList: true,
        subtree: true
      });
    }

    // Also observe the main container for panel changes
    const mainContainer = document.querySelector('.meeting-client') ||
                          document.querySelector('#wc-container');
    if (mainContainer) {
      participantObserver.observe(mainContainer, {
        childList: true,
        subtree: true
      });
    }
  }

  // Scan for participants
  function scanParticipants() {
    // Various selectors for participant names
    const participantSelectors = [
      '.participants-item__display-name',
      '.participant-item-name',
      '[class*="participant-name"]',
      '.video-avatar__avatar-name',
      '.video-avatar-name'
    ];

    participantSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(processParticipant);
    });

    // Also try to get from video tiles
    const videoTiles = document.querySelectorAll('[class*="video-cell"]');
    videoTiles.forEach(tile => {
      const nameEl = tile.querySelector('[class*="name"]');
      if (nameEl) {
        processParticipantByName(nameEl.textContent);
      }
    });
  }

  // Process a participant element
  function processParticipant(element) {
    const name = element.textContent?.trim();
    processParticipantByName(name);
  }

  // Process participant by name
  function processParticipantByName(name) {
    if (!name || trackedParticipants.has(name)) {
      return;
    }

    // Skip if it's just "Me" or empty
    if (name === 'Me' || name === 'Eu' || name.length < 2) {
      return;
    }

    trackedParticipants.add(name);

    const participantData = {
      name: name,
      meetingId: meetingInfo?.meetingId,
      meetingTitle: meetingInfo?.title,
      joinTime: new Date().toISOString(),
      platform: 'zoom'
    };

    console.log('[ROI Boy] New Zoom participant:', participantData);

    // Send to background
    chrome.runtime.sendMessage({
      type: 'ZOOM_PARTICIPANT',
      payload: participantData
    }).catch(err => {
      console.error('[ROI Boy] Error sending Zoom participant:', err);
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
