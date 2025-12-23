// ROI Boy - WhatsApp Web Content Script v2.0 - Performance Optimized
(function() {
  'use strict';

  console.log('[ROI Boy] WhatsApp content script loaded v2.0');

  let isCapturing = false;
  let processedMessages = new Set();
  let observer = null;
  let currentChatName = '';
  let lastMessageSentAt = 0;
  let pendingMessage = null;
  let debounceTimer = null;
  
  // Performance: Minimum interval between API calls (ms)
  const MIN_SEND_INTERVAL = 500;
  const DEBOUNCE_DELAY = 300;

  // Status patterns to ignore (WhatsApp UI status indicators)
  const STATUS_PATTERNS = [
    /^digitando\.{0,3}$/i,
    /^typing\.{0,3}$/i,
    /^online$/i,
    /^última vez/i,
    /^last seen/i,
    /^visto por último/i,
    /^gravando áudio/i,
    /^recording audio/i,
    /^gravando\.{0,3}$/i,
    /^\d{1,2}:\d{2}$/,  // Time only like "14:30"
    /^hoje às \d/i,
    /^ontem às \d/i,
    /^yesterday at/i,
    /^today at/i,
    /^clique aqui/i,
    /^click here/i,
  ];

  // Check if a name looks like a WhatsApp status rather than a real name
  function isStatusIndicator(name) {
    if (!name || name.length < 2) return true;
    if (name.length > 100) return true; // Too long to be a name
    
    const normalized = name.trim().toLowerCase();
    
    // Check against status patterns
    for (const pattern of STATUS_PATTERNS) {
      if (pattern.test(normalized)) {
        return true;
      }
    }
    
    return false;
  }

  // Get the real contact name from header (more reliable)
  function getRealContactName() {
    // Primary: Get from conversation header title
    const headerTitle = document.querySelector('[data-testid="conversation-info-header-chat-title"]');
    if (headerTitle) {
      const name = headerTitle.textContent?.trim() || '';
      if (!isStatusIndicator(name)) {
        return name;
      }
    }
    
    // Fallback: Get from the header span with actual name
    const headerSpan = document.querySelector('[data-testid="conversation-header"] span[dir="auto"]');
    if (headerSpan) {
      const name = headerSpan.textContent?.trim() || '';
      if (!isStatusIndicator(name)) {
        return name;
      }
    }
    
    // Last resort: Try to get from chat list active item
    const activeChat = document.querySelector('[data-testid="cell-frame-container"][aria-selected="true"] span[dir="auto"]');
    if (activeChat) {
      const name = activeChat.textContent?.trim() || '';
      if (!isStatusIndicator(name)) {
        return name;
      }
    }
    
    return null;
  }

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

    const mainPanel = document.querySelector('#main');
    if (mainPanel) {
      chatObserver.observe(mainPanel, { childList: true, subtree: true, attributes: true });
    }
  }

  // Update current chat info with validation
  function updateCurrentChat() {
    const realName = getRealContactName();
    if (realName) {
      currentChatName = realName;
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

    const messagesContainer = document.querySelector('[data-testid="conversation-panel-messages"]');
    if (messagesContainer) {
      observer.observe(messagesContainer, {
        childList: true,
        subtree: true
      });
      console.log('[ROI Boy] Message observer attached');
    } else {
      setTimeout(observeMessages, 1000);
    }
  }

  // Process new message elements
  function processNewMessages(element) {
    const messageRows = element.querySelectorAll ? 
      element.querySelectorAll('[data-testid="msg-container"]') : [];
    
    if (element.matches && element.matches('[data-testid="msg-container"]')) {
      processMessage(element);
    }

    messageRows.forEach(processMessage);
  }

  // Process a single message with throttling
  function processMessage(msgElement) {
    try {
      const messageId = msgElement.getAttribute('data-id') || generateMessageId(msgElement);
      
      if (processedMessages.has(messageId)) {
        return;
      }

      // Check if it's an incoming message (from client)
      const isIncoming = msgElement.classList.contains('message-in') ||
                         msgElement.querySelector('[data-testid="msg-meta"]')?.closest('.message-in');

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
      
      // Get the real contact name (validated)
      const contactName = getRealContactName() || currentChatName;

      // Validate contact name before sending
      if (isStatusIndicator(contactName)) {
        console.log('[ROI Boy] Skipping - invalid contact name:', contactName);
        return;
      }

      // Only send if we have actual content
      if (!messageText && !isAudio) {
        return;
      }
      
      // Skip very short messages that are likely noise
      if (messageText.length < 2 && !isAudio) {
        return;
      }

      // Mark as processed immediately
      processedMessages.add(messageId);

      // Limit processed messages set size
      if (processedMessages.size > 1000) {
        const iterator = processedMessages.values();
        for (let i = 0; i < 500; i++) {
          processedMessages.delete(iterator.next().value);
        }
      }

      // Generate unique message hash to prevent duplicates
      const messageHash = generateMessageHash(phoneNumber, messageText, contactName);
      
      // Check if we recently processed this exact message
      if (processedMessages.has(messageHash)) {
        console.log('[ROI Boy] Duplicate message hash detected, skipping');
        return;
      }
      
      // Store hash for deduplication
      processedMessages.add(messageHash);
      
      // Prepare message data
      const messageData = {
        phone: phoneNumber,
        contactName: contactName,
        senderName: senderName || contactName,
        content: messageText,
        isAudio: isAudio,
        isGroup: !!senderName,
        groupName: senderName ? contactName : null,
        timestamp: new Date().toISOString(),
        rawTimestamp: timestamp,
        messageHash: messageHash
      };

      // Throttle and debounce sending
      scheduleMessageSend(messageData);

    } catch (error) {
      console.error('[ROI Boy] Error processing message:', error);
    }
  }

  // Schedule message send with debounce and throttle
  function scheduleMessageSend(messageData) {
    pendingMessage = messageData;
    
    // Clear any pending debounce
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    // Debounce to batch rapid messages
    debounceTimer = setTimeout(() => {
      const now = Date.now();
      const timeSinceLastSend = now - lastMessageSentAt;
      
      if (timeSinceLastSend >= MIN_SEND_INTERVAL) {
        sendMessage(pendingMessage);
        lastMessageSentAt = now;
        pendingMessage = null;
      } else {
        // Schedule for after the throttle period
        const delay = MIN_SEND_INTERVAL - timeSinceLastSend;
        setTimeout(() => {
          if (pendingMessage) {
            sendMessage(pendingMessage);
            lastMessageSentAt = Date.now();
            pendingMessage = null;
          }
        }, delay);
      }
    }, DEBOUNCE_DELAY);
  }

  // Send message to background script
  function sendMessage(messageData) {
    console.log('[ROI Boy] Sending message:', { 
      phone: messageData.phone, 
      contactName: messageData.contactName,
      contentPreview: messageData.content?.substring(0, 50),
      hash: messageData.messageHash 
    });

    chrome.runtime.sendMessage({
      type: 'WHATSAPP_MESSAGE',
      payload: messageData
    }).catch(err => {
      console.error('[ROI Boy] Error sending message:', err);
    });
  }

  // Generate a unique ID for messages without data-id
  function generateMessageId(element) {
    const text = element.textContent?.substring(0, 50) || '';
    const time = Date.now();
    return `msg_${text}_${time}`;
  }
  
  // Generate stable hash for message deduplication
  function generateMessageHash(phone, content, chatName) {
    const normalizedContent = (content || '').trim().toLowerCase().substring(0, 200);
    const normalizedPhone = (phone || '').replace(/\D/g, '');
    const normalizedChat = (chatName || '').trim().toLowerCase();
    
    const str = `${normalizedPhone}|${normalizedChat}|${normalizedContent}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
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

    // Try to get from header - only if it looks like a phone number
    const header = document.querySelector('[data-testid="conversation-info-header-chat-title"]');
    if (header) {
      const title = header.textContent || '';
      if (title.match(/^\+?\d{10,}/)) {
        return title;
      }
    }

    return '';
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
