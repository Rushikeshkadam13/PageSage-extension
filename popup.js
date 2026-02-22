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

  // Response elements
  responseSection: document.getElementById('responseSection'),
  responseBox: document.getElementById('responseBox'),
  copyBtn: document.getElementById('copyBtn'),
  
  // Settings elements
  settingsBtn: document.getElementById('settingsBtn'),
  settingsPanel: document.getElementById('settingsPanel'),
  closeSettings: document.getElementById('closeSettings'),
  popoutBtn: document.getElementById('popoutBtn'),
  modelSelect: document.getElementById('modelSelect'),
  apiKeyInput: document.getElementById('apiKeyInput'),
  apiKeyLabel: document.getElementById('apiKeyLabel'),
  apiKeyNote: document.getElementById('apiKeyNote'),
  saveSettings: document.getElementById('saveSettings'),
  
  // Quick action buttons
  quickBtns: document.querySelectorAll('.quick-btn'),
  
  // Debug buttons
  saveContentBtn: document.getElementById('saveContentBtn'),
  autoScrollBtn: document.getElementById('autoScrollBtn'),
  
  // Status elements
  extractionStatus: document.getElementById('extractionStatus'),
  charCount: document.getElementById('charCount')
};

// Store extracted page content
let pageContent = null;

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
      
      // Extract content from the page
      await extractPageContent(tab.id);
      
      // Update extraction status
      updateExtractionStatus();
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
  
  // Copy button
  elements.copyBtn.addEventListener('click', copyResponseToClipboard);
  
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
  
  // Save extracted content for debugging
  elements.saveContentBtn.addEventListener('click', saveExtractedContent);
  
  // Auto-scroll button
  elements.autoScrollBtn.addEventListener('click', triggerAutoScroll);
}

// ============================================================================
// QUERY HANDLING
// ============================================================================

/**
 * Handle sending a query to the AI
 */
async function handleSendQuery() {
  const query = elements.queryInput.value.trim();
  
  // Validate query
  if (!query) {
    showResponse('Please enter a question about this page.', 'error');
    return;
  }
  
  // Validate page content
  if (!pageContent) {
    showResponse('Unable to extract page content. Please refresh and try again.', 'error');
    return;
  }
  
  // Show loading state
  showLoading();
  
  try {
    // Send query to background script
    const response = await chrome.runtime.sendMessage({
      action: 'queryAI',
      query: query,
      pageContent: pageContent
    });
    
    if (response.success) {
      showResponse(response.data);
    } else {
      showResponse(response.error || 'Unknown error occurred', 'error');
    }
  } catch (error) {
    showResponse(`Error: ${error.message}`, 'error');
  }
}

// ============================================================================
// UI HELPERS
// ============================================================================

/**
 * Show loading state in the response box
 */
function showLoading() {
  elements.responseSection.classList.add('visible');
  elements.responseBox.classList.add('loading');
  elements.responseBox.classList.remove('error');
  elements.responseBox.innerHTML = `
    <div class="loading-dots">
      <span></span>
      <span></span>
      <span></span>
    </div>
    <p style="margin-top: 10px;">Analyzing page content...</p>
  `;
  elements.sendBtn.disabled = true;
}

/**
 * Display response in the response box
 * @param {string} message - Response message to display
 * @param {string} type - Type of message ('success' or 'error')
 */
function showResponse(message, type = 'success') {
  elements.responseSection.classList.add('visible');
  elements.responseBox.classList.remove('loading');
  elements.sendBtn.disabled = false;
  
  if (type === 'error') {
    elements.responseBox.classList.add('error');
    elements.responseBox.textContent = message;
  } else {
    elements.responseBox.classList.remove('error');
    // Convert markdown-like formatting to HTML
    elements.responseBox.innerHTML = formatResponse(message);
  }
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
 * Copy response text to clipboard
 */
async function copyResponseToClipboard() {
  const text = elements.responseBox.textContent;
  
  try {
    await navigator.clipboard.writeText(text);
    
    // Show feedback
    const originalText = elements.copyBtn.textContent;
    elements.copyBtn.textContent = 'Copied!';
    setTimeout(() => {
      elements.copyBtn.textContent = originalText;
    }, 2000);
  } catch (error) {
    // Copy failed
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
// DEBUG: Save Extracted Content to File
// ============================================================================

/**
 * Update the extraction status display
 */
function updateExtractionStatus() {
  if (pageContent) {
    const charCount = pageContent.textContent?.length || 0;
    elements.charCount.textContent = charCount.toLocaleString();
    
    if (pageContent.isComplete) {
      elements.extractionStatus.classList.add('complete');
      elements.extractionStatus.innerHTML = `✅ <span id="charCount">${charCount.toLocaleString()}</span> chars extracted (complete)`;
    }
  }
}

/**
 * Trigger auto-scroll on the page to extract all content
 */
async function triggerAutoScroll() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      alert('No active tab found');
      return;
    }
    
    // Disable button and show loading
    elements.autoScrollBtn.disabled = true;
    elements.autoScrollBtn.textContent = '⏳ Scrolling...';
    
    // Send auto-scroll command to content script
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'autoScroll' });
    
    if (response?.success) {
      // Re-extract content after scroll
      await extractPageContent(tab.id);
      updateExtractionStatus();
      
      elements.autoScrollBtn.textContent = '✅ Done!';
      setTimeout(() => {
        elements.autoScrollBtn.textContent = '📜 Auto-Scroll & Extract';
        elements.autoScrollBtn.disabled = false;
      }, 2000);
    }
  } catch (error) {
    elements.autoScrollBtn.textContent = '📜 Auto-Scroll & Extract';
    elements.autoScrollBtn.disabled = false;
    alert('Error: ' + error.message);
  }
}

/**
 * Saves the extracted page content to a JSON file for verification
 * This helps debug and verify the content extraction is working correctly
 */
function saveExtractedContent() {
  if (!pageContent) {
    alert('No content extracted yet. Please wait for the page to load.');
    return;
  }
  
  // Create a detailed content object
  const contentToSave = {
    extractedAt: new Date().toISOString(),
    pageInfo: {
      title: pageContent.title,
      url: pageContent.url
    },
    isComplete: pageContent.isComplete || false,
    textContent: pageContent.textContent,
    structuredContent: pageContent.structuredContent,
    images: pageContent.images?.map(img => ({
      src: img.src,
      alt: img.alt,
      title: img.title,
      dimensions: `${img.width}x${img.height}`,
      hasBase64: !!img.base64
    })),
    scrollPositions: pageContent.scrollPositions || [],
    stats: {
      textLength: pageContent.textContent?.length || 0,
      headingsCount: pageContent.structuredContent?.headings?.length || 0,
      imagesCount: pageContent.images?.length || 0,
      scrollPositionsTracked: pageContent.scrollPositions?.length || 0
    }
  };
  
  // Convert to formatted JSON string
  const jsonString = JSON.stringify(contentToSave, null, 2);
  
  // Create blob and download
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  // Create download link
  const a = document.createElement('a');
  a.href = url;
  a.download = `extracted-content-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  alert('Content saved! Check your Downloads folder.');
}
