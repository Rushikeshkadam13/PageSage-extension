/**
 * Popup Script - Main UI Controller for PageSage Extension
 * Handles user interactions, content extraction, and AI query management
 */

// ============================================================================
// DOM ELEMENT REFERENCES
// ============================================================================

const elements = {
  // Page info elements
  pageTitle: document.getElementById('pageTitle'),
  pageUrl: document.getElementById('pageUrl'),
  
  // Query elements
  queryInput: document.getElementById('queryInput'),
  sendBtn: document.getElementById('sendBtn'),

  // Chat elements
  chatMessages: document.getElementById('chatMessages'),
  clearChatBtn: document.getElementById('clearChatBtn'),
  
  // Settings elements
  settingsBtn: document.getElementById('settingsBtn'),
  settingsPanel: document.getElementById('settingsPanel'),
  closeSettings: document.getElementById('closeSettings'),
  popoutBtn: document.getElementById('popoutBtn'),
  themeBtn: document.getElementById('themeBtn'),
  modelSelect: document.getElementById('modelSelect'),
  apiKeyInput: document.getElementById('apiKeyInput'),
  apiKeyLabel: document.getElementById('apiKeyLabel'),
  apiKeyNote: document.getElementById('apiKeyNote'),
  saveSettings: document.getElementById('saveSettings'),
  
  // Quick action buttons
  quickBtns: document.querySelectorAll('.quick-btn')
};

// Store extracted page content
let pageContent = null;

// Chat state management
let chatHistory = []; // Array of {role: 'user'|'assistant', content: string}
let currentPageUrl = null; // For per-page chat persistence

// Model configuration info
const MODEL_CONFIG = {
  groq: {
    label: 'Groq API Key',
    placeholder: 'gsk_...',
    note: 'Get your FREE API key from <a href="https://console.groq.com/keys" target="_blank">Groq Console</a><br><strong>Free tier:</strong> 30 requests/min, very fast!',
    prefix: 'gsk_'
  },
  gemini: {
    label: 'Google Gemini API Key',
    placeholder: 'AIza...',
    note: 'Get your API key from <a href="https://aistudio.google.com/apikey" target="_blank">Google AI Studio</a><br><strong>Free tier:</strong> 15 requests/min',
    prefix: 'AIza'
  },
  openai: {
    label: 'OpenAI API Key',
    placeholder: 'sk-...',
    note: 'Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank">OpenAI Platform</a><br><strong>Note:</strong> Requires paid credits',
    prefix: 'sk-'
  },
  grok: {
    label: 'xAI Grok API Key',
    placeholder: 'xai-...',
    note: 'Get your API key from <a href="https://console.x.ai" target="_blank">xAI Console</a><br><strong>Note:</strong> Check pricing at x.ai',
    prefix: 'xai-'
  }
};

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the popup when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', async () => {
  // Check if we're in standalone window mode
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('tabId')) {
    // Hide pop-out button in standalone mode
    elements.popoutBtn.style.display = 'none';
  }
  
  // Load saved theme preference
  await loadTheme();
  
  // Load current page info
  await loadCurrentPageInfo();
  
  // Load saved API key
  await loadSavedApiKey();
  
  // Set up event listeners
  setupEventListeners();
});

/**
 * Load information about the current active tab
 */
async function loadCurrentPageInfo() {
  try {
    // Check if we're in standalone window mode (tab ID passed via URL)
    const urlParams = new URLSearchParams(window.location.search);
    const passedTabId = urlParams.get('tabId');
    
    let tab;
    if (passedTabId) {
      // Standalone window mode - use the passed tab ID
      tab = await chrome.tabs.get(parseInt(passedTabId));
    } else {
      // Normal popup mode - get active tab
      [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    }
    
    if (tab) {
      // Display page info
      elements.pageTitle.textContent = tab.title || 'Unknown Page';
      elements.pageUrl.textContent = tab.url || '';
      
      // Store current page URL for chat persistence
      currentPageUrl = tab.url;
      
      // Load chat history for this page
      await loadChatHistory();
      
      // Extract content from the page
      await extractPageContent(tab.id);
    }
  } catch (error) {
    elements.pageTitle.textContent = 'Error loading page';
    elements.pageUrl.textContent = error.message;
  }
}

/**
 * Extract content from the current page using content script
 * @param {number} tabId - ID of the tab to extract content from
 */
async function extractPageContent(tabId) {
  try {
    // Send message to content script to extract content
    const response = await chrome.tabs.sendMessage(tabId, { action: 'extractContent' });
    
    if (response) {
      pageContent = response;
    }
  } catch (error) {
    
    // If content script is not loaded, inject it first
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      
      // Try again after injection
      const response = await chrome.tabs.sendMessage(tabId, { action: 'extractContent' });
      if (response) {
        pageContent = response;
      }
    } catch (injectionError) {
      // Content script injection failed
    }
  }
}

/**
 * Load saved API key and model from storage
 */
async function loadSavedApiKey() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
    if (response.success) {
      // Set model selection
      if (response.model) {
        elements.modelSelect.value = response.model;
      }
      // Update UI for selected model
      updateApiKeyUI(elements.modelSelect.value);
      // Set API key if available for selected model
      if (response.apiKey) {
        elements.apiKeyInput.value = response.apiKey;
      }
    }
  } catch (error) {
    // Settings load failed
  }
}

/**
 * Update API key input UI based on selected model
 */
function updateApiKeyUI(model) {
  const config = MODEL_CONFIG[model];
  if (config) {
    elements.apiKeyLabel.textContent = config.label;
    elements.apiKeyInput.placeholder = config.placeholder;
    elements.apiKeyNote.innerHTML = config.note;
  }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

/**
 * Set up all event listeners
 */
function setupEventListeners() {
  // Send button click
  elements.sendBtn.addEventListener('click', handleSendQuery);
  
  // Enter key in textarea (Ctrl/Cmd + Enter to send)
  elements.queryInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSendQuery();
    }
  });
  
  // Quick action buttons
  elements.quickBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const query = btn.dataset.query;
      elements.queryInput.value = query;
      handleSendQuery();
    });
  });
  
  // Clear chat button
  elements.clearChatBtn.addEventListener('click', clearChat);
  
  // Settings panel toggle
  elements.settingsBtn.addEventListener('click', () => {
    elements.settingsPanel.classList.add('visible');
  });
  
  elements.closeSettings.addEventListener('click', () => {
    elements.settingsPanel.classList.remove('visible');
  });
  
  // Pop-out to standalone window (won't close when clicking outside)
  elements.popoutBtn.addEventListener('click', async () => {
    // Get current tab to pass its ID to the standalone window
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tab?.id || '';
    chrome.windows.create({
      url: chrome.runtime.getURL('popup.html') + '?tabId=' + tabId,
      type: 'popup',
      width: 450,
      height: 650
    });
    window.close(); // Close the popup
  });
  
  // Model selection change
  elements.modelSelect.addEventListener('change', async (e) => {
    const model = e.target.value;
    updateApiKeyUI(model);
    // Load saved API key for the selected model
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getSettings', model: model });
      elements.apiKeyInput.value = response.success && response.apiKey ? response.apiKey : '';
    } catch (error) {
      elements.apiKeyInput.value = '';
    }
  });
  
  // Save settings
  elements.saveSettings.addEventListener('click', saveApiKey);
  
  // Theme toggle button
  elements.themeBtn.addEventListener('click', toggleTheme);
  
  // Auto-resize chat input
  elements.queryInput.addEventListener('input', autoResizeInput);
}

// ============================================================================
// QUERY HANDLING
// ============================================================================

/**
 * Handle sending a query to the AI (chat-based)
 */
async function handleSendQuery() {
  const query = elements.queryInput.value.trim();
  
  // Validate query
  if (!query) {
    return;
  }
  
  // Validate page content
  if (!pageContent) {
    addChatMessage('Unable to extract page content. Please refresh and try again.', 'error');
    return;
  }
  
  // Add user message to chat
  addChatMessage(query, 'user');
  chatHistory.push({ role: 'user', content: query });
  
  // Clear input and reset height
  elements.queryInput.value = '';
  elements.queryInput.style.height = 'auto';
  
  // Show loading indicator
  const loadingEl = addChatMessage('', 'loading');
  elements.sendBtn.disabled = true;
  
  try {
    // Send query with conversation history to background script
    const response = await chrome.runtime.sendMessage({
      action: 'queryAI',
      query: query,
      pageContent: pageContent,
      chatHistory: chatHistory.slice(0, -1) // Exclude the message we just added
    });
    
    // Remove loading indicator
    loadingEl.remove();
    elements.sendBtn.disabled = false;
    
    if (response.success) {
      addChatMessage(response.data, 'assistant');
      chatHistory.push({ role: 'assistant', content: response.data });
      // Save chat history
      await saveChatHistory();
    } else {
      addChatMessage(response.error || 'Unknown error occurred', 'error');
    }
  } catch (error) {
    loadingEl.remove();
    elements.sendBtn.disabled = false;
    addChatMessage(`Error: ${error.message}`, 'error');
  }
}

// ============================================================================
// CHAT UI HELPERS
// ============================================================================

/**
 * Add a message to the chat display
 * @param {string} content - Message content
 * @param {string} type - Message type ('user', 'assistant', 'error', 'loading')
 * @returns {HTMLElement} - The created message element
 */
function addChatMessage(content, type) {
  const messageEl = document.createElement('div');
  messageEl.className = `chat-message ${type}`;
  
  if (type === 'loading') {
    messageEl.innerHTML = `
      <div class="loading-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    `;
  } else if (type === 'error') {
    messageEl.textContent = content;
  } else {
    // Format assistant messages with markdown support
    messageEl.innerHTML = type === 'assistant' ? formatResponse(content) : escapeHtml(content);
  }
  
  elements.chatMessages.appendChild(messageEl);
  
  // Scroll to bottom
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
  
  return messageEl;
}

/**
 * Escape HTML in user messages
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format response text with basic markdown support
 * @param {string} text - Raw response text
 * @returns {string} - Formatted HTML
 */
function formatResponse(text) {
  // Escape HTML first
  let formatted = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Convert markdown-like syntax
  formatted = formatted
    // Bold text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic text
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Bullet points
    .replace(/^- (.*)/gm, '• $1')
    // Numbered lists
    .replace(/^\d+\. (.*)/gm, '<br>$&')
    // Line breaks
    .replace(/\n/g, '<br>');
  
  return formatted;
}

/**
 * Load chat history for current page from storage
 */
async function loadChatHistory() {
  if (!currentPageUrl) return;
  
  try {
    const key = `chat_${btoa(currentPageUrl).substring(0, 50)}`;
    const result = await chrome.storage.local.get(key);
    
    if (result[key]) {
      chatHistory = result[key];
      // Render existing messages
      chatHistory.forEach(msg => {
        addChatMessage(msg.content, msg.role);
      });
    } else {
      chatHistory = [];
    }
  } catch (error) {
    chatHistory = [];
  }
}

/**
 * Save chat history for current page to storage
 */
async function saveChatHistory() {
  if (!currentPageUrl) return;
  
  try {
    const key = `chat_${btoa(currentPageUrl).substring(0, 50)}`;
    await chrome.storage.local.set({ [key]: chatHistory });
  } catch (error) {
    // Save failed silently
  }
}

/**
 * Clear chat history for current page
 */
async function clearChat() {
  // Clear UI
  elements.chatMessages.innerHTML = '';
  
  // Clear memory
  chatHistory = [];
  
  // Clear storage
  if (currentPageUrl) {
    try {
      const key = `chat_${btoa(currentPageUrl).substring(0, 50)}`;
      await chrome.storage.local.remove(key);
    } catch (error) {
      // Remove failed silently
    }
  }
}

// ============================================================================
// SETTINGS MANAGEMENT
// ============================================================================

/**
 * Save API key and model to storage
 */
async function saveApiKey() {
  const apiKey = elements.apiKeyInput.value.trim();
  const model = elements.modelSelect.value;
  const config = MODEL_CONFIG[model];
  
  if (!apiKey) {
    alert('Please enter a valid API key');
    return;
  }
  
  // Validate API key format based on selected model
  if (config.prefix && !apiKey.startsWith(config.prefix)) {
    alert(`Invalid API key format. ${config.label} should start with "${config.prefix}"`);
    return;
  }
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'saveSettings',
      model: model,
      apiKey: apiKey
    });
    
    if (response.success) {
      // Close settings panel
      elements.settingsPanel.classList.remove('visible');
      alert('Settings saved successfully!');
    } else {
      alert('Failed to save settings: ' + response.error);
    }
  } catch (error) {
    alert('Error saving settings: ' + error.message);
  }
}

// ============================================================================
// THEME MANAGEMENT
// ============================================================================

/**
 * Load saved theme preference from storage
 */
async function loadTheme() {
  try {
    const result = await chrome.storage.local.get('theme');
    if (result.theme === 'dark') {
      document.body.classList.add('dark-theme');
      elements.themeBtn.textContent = '☀️';
    }
  } catch (error) {
    // Default to light theme
  }
}

/**
 * Toggle between dark and light theme
 */
async function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-theme');
  elements.themeBtn.textContent = isDark ? '☀️' : '🌙';
  
  try {
    await chrome.storage.local.set({ theme: isDark ? 'dark' : 'light' });
  } catch (error) {
    // Save failed silently
  }
}

/**
 * Auto-resize chat input based on content
 */
function autoResizeInput() {
  const input = elements.queryInput;
  // Reset height to auto to get the correct scrollHeight
  input.style.height = 'auto';
  // Set height to scrollHeight, but respect max-height in CSS
  input.style.height = Math.min(input.scrollHeight, 100) + 'px';
}
