/**
 * Background Service Worker - Handles AI API communication
 * Uses Groq FREE API (30 requests/min, very fast!)
 */

// ============================================================================
// CONFIGURATION - GROQ FREE API
// ============================================================================

/**
 * Groq API Configuration - 100% FREE
 * 
 * FREE TIER (llama-3.3-70b-versatile):
 * - 30 requests per minute
 * - 15,000 tokens per minute
 * - Very fast inference (fastest in market)
 * - Get free API key: https://console.groq.com/keys
 */

const CONFIG = {
  // =========================================================================
  // FREE VERSION - Groq with Llama 3.3 70B (Default)
  // =========================================================================
  FREE: {
    model: 'llama-3.3-70b-versatile',  // Powerful free model
    maxTokens: 1500,                    // Increased for detailed responses
    temperature: 0.7,
    endpoint: 'https://api.groq.com/openai/v1/chat/completions'
  },
  
  // =========================================================================
  // ALTERNATIVE - Smaller/faster model (uncomment to use)
  // =========================================================================
  // FAST: {
  //   model: 'llama-3.1-8b-instant',   // Smaller, faster
  //   maxTokens: 500,
  //   temperature: 0.7,
  //   endpoint: 'https://api.groq.com/openai/v1/chat/completions'
  // }
};

// Current active configuration
const ACTIVE_CONFIG = CONFIG.FREE;

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
  
  // Handle API key storage
  if (request.action === 'saveApiKey') {
    chrome.storage.local.set({ groqApiKey: request.apiKey })
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  // Handle API key retrieval
  if (request.action === 'getApiKey') {
    chrome.storage.local.get(['groqApiKey'])
      .then(result => sendResponse({ success: true, apiKey: result.groqApiKey }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// ============================================================================
// AI QUERY HANDLING
// ============================================================================

/**
 * Main function to handle AI queries using Groq API
 * @param {Object} request - Request object containing query and page content
 * @returns {Promise<string>} - AI response
 */
async function handleAIQuery(request) {
  const { query, pageContent } = request;
  
  // Get API key from storage
  const { groqApiKey } = await chrome.storage.local.get(['groqApiKey']);
  
  if (!groqApiKey) {
    throw new Error('API key not configured. Get your FREE key from https://console.groq.com/keys');
  }
  
  // Build the prompt (keeping it short to save tokens)
  const prompt = buildPrompt(query, pageContent);
  
  // Make API request (Groq uses OpenAI-compatible format)
  const response = await fetch(ACTIVE_CONFIG.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${groqApiKey}`
    },
    body: JSON.stringify({
      model: ACTIVE_CONFIG.model,
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
      max_tokens: ACTIVE_CONFIG.maxTokens,
      temperature: ACTIVE_CONFIG.temperature
    })
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData.error?.message || `API request failed: ${response.status}`;
    throw new Error(errorMsg);
  }
  
  const data = await response.json();
  
  // Extract response text
  const responseText = data.choices?.[0]?.message?.content;
  
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

console.log('PageSage background service worker loaded (Groq API)');

