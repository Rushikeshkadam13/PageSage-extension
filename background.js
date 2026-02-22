/**
 * Background Service Worker - Handles AI API communication
 * Supports multiple AI providers: Groq, Gemini, OpenAI, and Grok
 */

// ============================================================================
// CONFIGURATION - MULTIPLE AI PROVIDERS
// ============================================================================

const CONFIG = {
  groq: {
    name: 'Meta Llama (Groq)',
    model: 'llama-3.3-70b-versatile',
    maxTokens: 1500,
    temperature: 0.7,
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    storageKey: 'groqApiKey'
  },
  gemini: {
    name: 'Google Gemini',
    model: 'gemini-1.5-flash',
    maxTokens: 1500,
    temperature: 0.7,
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
    storageKey: 'geminiApiKey'
  },
  openai: {
    name: 'OpenAI ChatGPT',
    model: 'gpt-4o-mini',
    maxTokens: 1500,
    temperature: 0.7,
    endpoint: 'https://api.openai.com/v1/chat/completions',
    storageKey: 'openaiApiKey'
  },
  grok: {
    name: 'xAI Grok',
    model: 'grok-2-latest',
    maxTokens: 1500,
    temperature: 0.7,
    endpoint: 'https://api.x.ai/v1/chat/completions',
    storageKey: 'grokApiKey'
  }
};

// Default model
const DEFAULT_MODEL = 'groq';

// ============================================================================
// MESSAGE HANDLING
// ============================================================================

/**
 * Listen for messages from popup and content scripts
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle query request
  if (request.action === 'queryAI') {
    handleAIQuery(request)
      .then(response => sendResponse({ success: true, data: response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
  
  // Handle settings storage (model + API key)
  if (request.action === 'saveSettings') {
    const { model, apiKey } = request;
    const config = CONFIG[model];
    if (!config) {
      sendResponse({ success: false, error: 'Invalid model' });
      return true;
    }
    chrome.storage.local.set({ 
      selectedModel: model,
      [config.storageKey]: apiKey 
    })
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  // Handle settings retrieval
  if (request.action === 'getSettings') {
    chrome.storage.local.get(['selectedModel', 'groqApiKey', 'geminiApiKey', 'openaiApiKey', 'grokApiKey'])
      .then(result => {
        const model = request.model || result.selectedModel || DEFAULT_MODEL;
        const config = CONFIG[model];
        sendResponse({ 
          success: true, 
          model: model,
          apiKey: result[config.storageKey] || ''
        });
      })
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// ============================================================================
// AI QUERY HANDLING
// ============================================================================

/**
 * Main function to handle AI queries using selected provider
 * @param {Object} request - Request object containing query and page content
 * @returns {Promise<string>} - AI response
 */
async function handleAIQuery(request) {
  const { query, pageContent } = request;
  
  // Get selected model and API key from storage
  const storage = await chrome.storage.local.get(['selectedModel', 'groqApiKey', 'geminiApiKey', 'openaiApiKey', 'grokApiKey']);
  const model = storage.selectedModel || DEFAULT_MODEL;
  const config = CONFIG[model];
  const apiKey = storage[config.storageKey];
  
  if (!apiKey) {
    throw new Error(`API key not configured for ${config.name}. Please add your API key in Settings.`);
  }
  
  // Build the prompt (keeping it short to save tokens)
  const prompt = buildPrompt(query, pageContent);
  
  // Make API request based on provider
  let response, data, responseText;
  
  if (model === 'gemini') {
    // Gemini uses a different API format
    response = await fetch(`${config.endpoint}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are a helpful assistant that analyzes webpage content. Be concise and direct.\n\n${prompt}`
          }]
        }],
        generationConfig: {
          maxOutputTokens: config.maxTokens,
          temperature: config.temperature
        }
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || `API request failed: ${response.status}`;
      throw new Error(errorMsg);
    }
    
    data = await response.json();
    responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  } else {
    // OpenAI-compatible format (Groq, OpenAI, Grok)
    response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that analyzes webpage content. Be concise and direct.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: config.maxTokens,
        temperature: config.temperature
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || `API request failed: ${response.status}`;
      throw new Error(errorMsg);
    }
    
    data = await response.json();
    responseText = data.choices?.[0]?.message?.content;
  }
  
  if (!responseText) {
    throw new Error('No response generated. Try a different question.');
  }
  
  return responseText;
}

/**
 * Builds a concise prompt to minimize token usage
 * @param {string} query - User's question
 * @param {Object} pageContent - Extracted page content
 * @returns {string} - Formatted prompt
 */
function buildPrompt(query, pageContent) {
  // Keep prompt minimal to save tokens
  let prompt = `Webpage: ${pageContent.title}\n\n`;
  
  // Increased content length for better context (Wikipedia has 15k+ chars)
  const maxContentLength = 12000; // ~3000 tokens
  let content = pageContent.textContent || '';
  if (content.length > maxContentLength) {
    content = content.substring(0, maxContentLength) + '...';
  }
  
  // Add structure summary (headings - important for Wikipedia)
  if (pageContent.structuredContent?.headings?.length > 0) {
    const headings = pageContent.structuredContent.headings
      .slice(0, 10) // Include more headings
      .map(h => h.text)
      .join(', ');
    prompt += `Topics: ${headings}\n\n`;
  }
  
  prompt += `Content:\n${content}\n\n`;
  
  // Add image descriptions
  if (pageContent.images?.length > 0) {
    const imgDescs = pageContent.images
      .slice(0, 3)
      .filter(img => img.alt)
      .map(img => img.alt)
      .join('; ');
    if (imgDescs) {
      prompt += `Images: ${imgDescs}\n\n`;
    }
  }
  
  prompt += `Question: ${query}\nAnswer concisely:`;
  
  return prompt;
}

// ============================================================================
// INSTALLATION HANDLER
// ============================================================================

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('PageSage extension installed');
  }
});

console.log('PageSage background service worker loaded (Multi-provider: Groq, Gemini, OpenAI, Grok)');

