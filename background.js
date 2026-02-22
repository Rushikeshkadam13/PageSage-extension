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
 * @param {Object} request - Request object containing query, page content, and chat history
 * @returns {Promise<string>} - AI response
 */
async function handleAIQuery(request) {
  const { query, pageContent, chatHistory = [] } = request;
  
  // Get selected model and API key from storage
  const storage = await chrome.storage.local.get(['selectedModel', 'groqApiKey', 'geminiApiKey', 'openaiApiKey', 'grokApiKey']);
  const model = storage.selectedModel || DEFAULT_MODEL;
  const config = CONFIG[model];
  const apiKey = storage[config.storageKey];
  
  if (!apiKey) {
    throw new Error(`API key not configured for ${config.name}. Please add your API key in Settings.`);
  }
  
  // Build the context prompt (page content - sent only on first message)
  const contextPrompt = buildContextPrompt(pageContent);
  
  // Build current query prompt
  const queryPrompt = buildQueryPrompt(query, pageContent);
  
  // Make API request based on provider
  let response, data, responseText;
  
  if (model === 'gemini') {
    // Gemini uses a different API format
    // Build conversation contents array
    const contents = [];
    
    // Add system context as first user message if no history
    if (chatHistory.length === 0) {
      contents.push({
        role: 'user',
        parts: [{ text: `You are a helpful assistant analyzing this webpage. Be concise and direct.\n\n${contextPrompt}` }]
      });
      contents.push({
        role: 'model',
        parts: [{ text: 'I understand. I\'ll help you analyze this webpage content. What would you like to know?' }]
      });
    }
    
    // Add chat history
    for (const msg of chatHistory) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    }
    
    // Build current message parts
    const parts = [{ text: queryPrompt }];
    
    // Add images for vision analysis (Gemini supports vision)
    const imagesWithBase64 = (pageContent.images || [])
      .filter(img => img.base64)
      .slice(0, 5); // Limit to 5 images
    
    if (imagesWithBase64.length > 0) {
      for (const img of imagesWithBase64) {
        const match = img.base64.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          parts.push({
            inline_data: {
              mime_type: match[1],
              data: match[2]
            }
          });
        }
      }
    }
    
    // Add current query
    contents.push({
      role: 'user',
      parts: parts
    });
    
    response = await fetch(`${config.endpoint}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: contents,
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
    // Build messages array
    const messages = [
      {
        role: 'system',
        content: `You are a helpful assistant that analyzes webpage content. Be concise and direct.\n\n${contextPrompt}`
      }
    ];
    
    // Add chat history
    for (const msg of chatHistory) {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    }
    
    // Add current query
    messages.push({
      role: 'user',
      content: queryPrompt
    });
    
    response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: messages,
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
 * Builds context prompt with page content (used in system message)
 * @param {Object} pageContent - Extracted page content
 * @returns {string} - Formatted context
 */
function buildContextPrompt(pageContent) {
  let prompt = `Webpage: ${pageContent.title}\nURL: ${pageContent.url}\n\n`;
  
  // Content summary
  const maxContentLength = 10000; // ~2500 tokens
  let content = pageContent.textContent || '';
  if (content.length > maxContentLength) {
    content = content.substring(0, maxContentLength) + '...';
  }
  
  // Add structure summary (headings)
  if (pageContent.structuredContent?.headings?.length > 0) {
    const headings = pageContent.structuredContent.headings
      .slice(0, 10)
      .map(h => h.text)
      .join(', ');
    prompt += `Topics: ${headings}\n\n`;
  }
  
  prompt += `Content:\n${content}`;
  
  return prompt;
}

/**
 * Builds query prompt for current user message
 * @param {string} query - User's question
 * @param {Object} pageContent - Extracted page content
 * @returns {string} - Formatted query
 */
function buildQueryPrompt(query, pageContent) {
  let prompt = query;
  
  // Add image info if relevant to query
  if (pageContent.images?.length > 0) {
    const imagesWithBase64 = pageContent.images.filter(img => img.base64);
    const imgDescs = pageContent.images
      .slice(0, 5)
      .filter(img => img.alt)
      .map(img => img.alt)
      .join('; ');
    
    if (imagesWithBase64.length > 0) {
      prompt += `\n\n[${imagesWithBase64.length} images attached]`;
    }
    if (imgDescs) {
      prompt += `\nImage descriptions: ${imgDescs}`;
    }
  }
  
  return prompt;
}

// ============================================================================
// INSTALLATION HANDLER
// ============================================================================

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Extension installed
  }
});

