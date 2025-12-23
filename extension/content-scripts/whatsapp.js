// ROI Boy - WhatsApp Web Content Script
(function() {
  'use strict';

  console.log('[ROI Boy] WhatsApp content script loaded');

  let isCapturing = false;
  let processedMessages = new Set();
  let observer = null;
  let currentChatName = '';

  // Initialize when WhatsApp loads
  function init() {
    waitForWhatsAppLoad().then(() => {
      console.log('[ROI Boy] WhatsApp Web loaded, starting capture');
      startCapture();
    });
  }

  // Wait for WhatsApp to fully load
  function waitForWhatsAppLoad() {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        // Check if main app container exists
        const appElement = document.querySelector('#app');
        const chatList = document.querySelector('[data-testid="chat-list"]');
        
        if (appElement && chatList) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 1000);
    });
  }

  // Start message capture
  function startCapture() {
    if (isCapturing) return;
    isCapturing = true;

    // Watch for chat changes
    observeChatChanges();

    // Watch for new messages
    observeMessages();

    console.log('[ROI Boy] Capture started');
  }

  // Observe chat panel changes
  function observeChatChanges() {
    const chatObserver = new MutationObserver(() => {
      updateCurrentChat();
    });

    const header = document.querySelector('[data-testid="conversation-header"]');
    if (header) {
      chatObserver.observe(header, { childList: true, subtree: true });
    }

    // Also observe the main panel
    const mainPanel = document.querySelector('#main');
    if (mainPanel) {
      chatObserver.observe(mainPanel, { childList: true, subtree: true, attributes: true });
    }
  }

  // Update current chat info
  function updateCurrentChat() {
    const headerTitle = document.querySelector('[data-testid="conversation-info-header-chat-title"]');
    if (headerTitle) {
      currentChatName = headerTitle.textContent?.trim() || '';
    }
  }

  // Observe messages in current chat
  function observeMessages() {
    if (observer) {
      observer.disconnect();
    }

    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              processNewMessages(node);
            }
          });
        }
      }
    });

    // Watch the message container
    const messagesContainer = document.querySelector('[data-testid="conversation-panel-messages"]');
    if (messagesContainer) {
      observer.observe(messagesContainer, {
        childList: true,
        subtree: true
      });
      console.log('[ROI Boy] Message observer attached');
    } else {
      // Retry after a short delay
      setTimeout(observeMessages, 1000);
    }
  }

  // Process new message elements
  function processNewMessages(element) {
    // Find message containers - both incoming and outgoing
    const messageRows = element.querySelectorAll ? 
      element.querySelectorAll('[data-testid="msg-container"]') : [];
    
    // Also check if the element itself is a message
    if (element.matches && element.matches('[data-testid="msg-container"]')) {
      processMessage(element);
    }

    messageRows.forEach(processMessage);
  }

  // Process a single message
  function processMessage(msgElement) {
    try {
      // Get unique message ID from data attributes
      const messageId = msgElement.getAttribute('data-id') || 
                        generateMessageId(msgElement);
      
      if (processedMessages.has(messageId)) {
        return;
      }

      // Check if it's an incoming message (from client)
      const isIncoming = msgElement.classList.contains('message-in') ||
                         msgElement.querySelector('[data-testid="msg-meta"]')?.closest('.message-in');

      // Only capture incoming messages (from clients to team)
      if (!isIncoming) {
        return;
      }

      // Extract message content
      const textElement = msgElement.querySelector('[data-testid="msg-text"]') ||
                          msgElement.querySelector('.copyable-text');
      
      let messageText = '';
      if (textElement) {
        messageText = textElement.textContent?.trim() || '';
      }

      // Check for audio message
      const audioElement = msgElement.querySelector('[data-testid="audio-play"]');
      const isAudio = !!audioElement;

      // Get timestamp
      const timeElement = msgElement.querySelector('[data-testid="msg-meta"]');
      const timestamp = timeElement?.textContent?.trim() || '';

      // Get sender info (for groups)
      const senderElement = msgElement.querySelector('[data-testid="msg-author-name"]');
      const senderName = senderElement?.textContent?.trim() || '';

      // Get phone number from contact info if possible
      const phoneNumber = extractPhoneNumber();

      // Only send if we have actual content
      if (!messageText && !isAudio) {
        return;
      }

      // Mark as processed
      processedMessages.add(messageId);

      // Limit processed messages set size
      if (processedMessages.size > 1000) {
        const iterator = processedMessages.values();
        for (let i = 0; i < 500; i++) {
          processedMessages.delete(iterator.next().value);
        }
      }

      // Generate unique message hash to prevent duplicates
      const messageHash = generateMessageHash(phoneNumber, messageText, currentChatName);
      
      // Check if we recently processed this exact message
      if (processedMessages.has(messageHash)) {
        console.log('[ROI Boy] Duplicate message hash detected, skipping');
        return;
      }
      
      // Prepare message data with contact_name for better client matching
      const messageData = {
        phone: phoneNumber,
        contactName: currentChatName, // Always send contact name for fallback matching
        senderName: senderName || currentChatName,
        content: messageText,
        isAudio: isAudio,
        isGroup: !!senderName,
        groupName: senderName ? currentChatName : null,
        timestamp: new Date().toISOString(),
        rawTimestamp: timestamp,
        messageHash: messageHash // Send hash to backend for deduplication
      };

      console.log('[ROI Boy] Captured message:', { 
        phone: messageData.phone, 
        contactName: messageData.contactName,
        contentPreview: messageData.content?.substring(0, 50),
        hash: messageHash 
      });

      // Send to background script
      chrome.runtime.sendMessage({
        type: 'WHATSAPP_MESSAGE',
        payload: messageData
      }).catch(err => {
        console.error('[ROI Boy] Error sending message:', err);
      });
      
      // Store hash instead of generated ID for better deduplication
      processedMessages.add(messageHash);

    } catch (error) {
      console.error('[ROI Boy] Error processing message:', error);
    }
  }

  // Generate a unique ID for messages without data-id
  function generateMessageId(element) {
    const text = element.textContent?.substring(0, 50) || '';
    const time = Date.now();
    return `msg_${text}_${time}`;
  }
  
  // Generate stable hash for message deduplication
  function generateMessageHash(phone, content, chatName) {
    // Create a stable hash based on message content and context
    const normalizedContent = (content || '').trim().toLowerCase().substring(0, 200);
    const normalizedPhone = (phone || '').replace(/\D/g, '');
    const normalizedChat = (chatName || '').trim().toLowerCase();
    
    // Simple hash function
    const str = `${normalizedPhone}|${normalizedChat}|${normalizedContent}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `hash_${Math.abs(hash).toString(36)}`;
  }

  // Extract phone number from current chat
  function extractPhoneNumber() {
    // Try to get from contact info
    const contactInfo = document.querySelector('[data-testid="conversation-info-header"]');
    if (contactInfo) {
      const phoneSpan = contactInfo.querySelector('span[title*="+"]');
      if (phoneSpan) {
        return phoneSpan.getAttribute('title') || '';
      }
    }

    // Try to get from URL
    const urlMatch = window.location.href.match(/\/(\d+)@/);
    if (urlMatch) {
      return `+${urlMatch[1]}`;
    }

    // Try to get from header
    const header = document.querySelector('[data-testid="conversation-info-header-chat-title"]');
    if (header) {
      const title = header.textContent || '';
      if (title.match(/^\+?\d+/)) {
        return title;
      }
    }

    return currentChatName;
  }

  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PING') {
      sendResponse({ status: 'active', capturing: isCapturing });
    }
    return true;
  });

  // Start initialization
  init();
})();
