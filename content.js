/**
 * Content Script - Auto-extracts ALL text from webpages including scrolled content
 * Optimized for Wikipedia and article-style pages
 * Runs automatically on every page visit and captures lazy-loaded content
 */

// ============================================================================
// GLOBAL STATE
// ============================================================================

// Store all extracted content (accumulates as user scrolls)
let extractedContent = {
  title: '',
  url: '',
  textContent: '',
  images: [],
  structuredContent: { headings: [], lists: [], tables: [], paragraphs: [] },
  extractedAt: '',
  scrollPositions: [],
  isComplete: false
};

// Track previously seen text to avoid duplicates
let seenTextBlocks = new Set();

// ============================================================================
// AUTO-EXTRACTION ON PAGE LOAD
// ============================================================================

/**
 * Initialize extraction when page loads
 */
function initAutoExtraction() {
  console.log('PageSage: Auto-extraction initialized');
  
  // Initial extraction
  extractedContent.title = document.title;
  extractedContent.url = window.location.href;
  extractedContent.extractedAt = new Date().toISOString();
  
  // Detect site type and extract accordingly
  extractAllContent();
  
  // Set up scroll listener for lazy-loaded content
  setupScrollListener();
  
  // Set up mutation observer for dynamically added content
  setupMutationObserver();
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAutoExtraction);
} else {
  initAutoExtraction();
}

// Also run after full page load (images, etc.)
window.addEventListener('load', () => {
  setTimeout(extractAllContent, 1000);
});

// ============================================================================
// SCROLL-BASED EXTRACTION
// ============================================================================

let scrollTimeout = null;
let lastScrollPosition = 0;

function setupScrollListener() {
  window.addEventListener('scroll', () => {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    
    scrollTimeout = setTimeout(() => {
      const currentPosition = window.scrollY;
      
      if (Math.abs(currentPosition - lastScrollPosition) > 100) {
        extractAllContent();
        lastScrollPosition = currentPosition;
        
        extractedContent.scrollPositions.push({
          position: currentPosition,
          timestamp: new Date().toISOString()
        });
      }
      
      if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 100) {
        extractedContent.isComplete = true;
        console.log('PageSage: Page fully scrolled - extraction complete');
      }
    }, 200);
  });
}

// ============================================================================
// MUTATION OBSERVER FOR DYNAMIC CONTENT
// ============================================================================

function setupMutationObserver() {
  const observer = new MutationObserver((mutations) => {
    let hasNewContent = false;
    
    mutations.forEach(mutation => {
      if (mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const text = node.textContent?.trim();
            if (text && text.length > 50) {
              hasNewContent = true;
            }
          }
        });
      }
    });
    
    if (hasNewContent) {
      setTimeout(extractAllContent, 500);
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// ============================================================================
// AUTO-SCROLL FUNCTION
// ============================================================================

async function autoScrollPage() {
  console.log('PageSage: Starting auto-scroll...');
  
  const scrollStep = window.innerHeight * 0.8;
  const maxScrolls = 50;
  let scrollCount = 0;
  
  return new Promise((resolve) => {
    const scrollInterval = setInterval(() => {
      window.scrollBy(0, scrollStep);
      scrollCount++;
      
      if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 50 
          || scrollCount >= maxScrolls) {
        clearInterval(scrollInterval);
        window.scrollTo(0, 0);
        extractedContent.isComplete = true;
        console.log(`PageSage: Auto-scroll complete (${scrollCount} scrolls)`);
        resolve();
      }
    }, 300);
  });
}

// ============================================================================
// MAIN CONTENT EXTRACTION - OPTIMIZED FOR ARTICLES
// ============================================================================

/**
 * Extract all content from the page
 * Uses multiple strategies to capture everything
 */
function extractAllContent() {
  // Find the main content area
  const mainContent = findMainContent();
  
  if (mainContent) {
    // Extract from main content area (better for Wikipedia, articles)
    extractFromElement(mainContent);
  } else {
    // Fallback: extract from entire body
    extractFromBody();
  }
  
  // Always update structured content
  updateStructuredContent();
  updateImages();
  
  extractedContent.extractedAt = new Date().toISOString();
  console.log(`PageSage: Extracted ${extractedContent.textContent.length} chars`);
}

/**
 * Find the main content area of the page
 * Works with Wikipedia, Medium, news sites, etc.
 */
function findMainContent() {
  // Priority selectors for main content
  const contentSelectors = [
    // Wikipedia
    '#mw-content-text',
    '#bodyContent',
    '.mw-parser-output',
    // Generic article selectors
    'article',
    '[role="main"]',
    'main',
    '.article-content',
    '.post-content',
    '.entry-content',
    '.content-area',
    '#content',
    '.main-content',
    // Medium
    '.postArticle-content',
    // News sites
    '.story-body',
    '.article-body'
  ];
  
  for (const selector of contentSelectors) {
    const el = document.querySelector(selector);
    if (el && el.textContent.trim().length > 500) {
      console.log(`PageSage: Found main content via "${selector}"`);
      return el;
    }
  }
  
  return null;
}

/**
 * Extract content from a specific element (main content area)
 */
function extractFromElement(element) {
  // Get all paragraphs
  const paragraphs = element.querySelectorAll('p');
  paragraphs.forEach(p => {
    const text = cleanText(p.textContent);
    if (text.length > 20 && !isDuplicate(text)) {
      addText(text);
      extractedContent.structuredContent.paragraphs.push(text);
    }
  });
  
  // Get all headings
  element.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
    const text = cleanText(h.textContent);
    if (text && !isDuplicate(text)) {
      addText(`\n## ${text}\n`);
    }
  });
  
  // Get all list items
  element.querySelectorAll('li').forEach(li => {
    // Skip nested lists - only get direct text
    const directText = getDirectText(li);
    if (directText.length > 10 && !isDuplicate(directText)) {
      addText(`• ${directText}`);
    }
  });
  
  // Get table data
  element.querySelectorAll('table').forEach(table => {
    const tableText = extractTableText(table);
    if (tableText && !isDuplicate(tableText)) {
      addText(tableText);
    }
  });
  
  // Get blockquotes
  element.querySelectorAll('blockquote').forEach(bq => {
    const text = cleanText(bq.textContent);
    if (text.length > 20 && !isDuplicate(text)) {
      addText(`> ${text}`);
    }
  });
  
  // Get definition lists (common in Wikipedia)
  element.querySelectorAll('dd').forEach(dd => {
    const text = cleanText(dd.textContent);
    if (text.length > 20 && !isDuplicate(text)) {
      addText(text);
    }
  });
}

/**
 * Fallback: Extract from entire document body
 */
function extractFromBody() {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        
        // Skip unwanted elements
        const tagName = parent.tagName.toLowerCase();
        if (['script', 'style', 'noscript', 'iframe', 'svg', 'nav', 'footer', 'header'].includes(tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Skip hidden elements
        const style = window.getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Only accept substantial text
        const text = node.textContent.trim();
        if (text.length < 10) return NodeFilter.FILTER_REJECT;
        
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  while (walker.nextNode()) {
    const text = cleanText(walker.currentNode.textContent);
    if (text.length > 10 && !isDuplicate(text)) {
      addText(text);
    }
  }
}

/**
 * Clean text by removing extra whitespace
 */
function cleanText(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();
}

/**
 * Get direct text content (not from nested children)
 */
function getDirectText(element) {
  let text = '';
  element.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // Include inline elements like links, spans
      const tagName = node.tagName.toLowerCase();
      if (['a', 'span', 'strong', 'em', 'b', 'i', 'sup', 'sub'].includes(tagName)) {
        text += node.textContent;
      }
    }
  });
  return cleanText(text);
}

/**
 * Extract text from a table
 */
function extractTableText(table) {
  const rows = [];
  table.querySelectorAll('tr').forEach((tr, i) => {
    if (i > 20) return; // Limit rows
    
    const cells = [];
    tr.querySelectorAll('th, td').forEach(cell => {
      const text = cleanText(cell.textContent);
      if (text.length < 200) { // Skip cells with too much content
        cells.push(text);
      }
    });
    
    if (cells.length > 0) {
      rows.push(cells.join(' | '));
    }
  });
  
  return rows.join('\n');
}

/**
 * Check if text is duplicate
 */
function isDuplicate(text) {
  const hash = hashText(text);
  if (seenTextBlocks.has(hash)) {
    return true;
  }
  seenTextBlocks.add(hash);
  return false;
}

/**
 * Add text to extracted content
 */
function addText(text) {
  extractedContent.textContent += text + '\n';
}

/**
 * Simple hash function for deduplication
 */
function hashText(text) {
  let hash = 0;
  const sample = text.substring(0, 100);
  for (let i = 0; i < sample.length; i++) {
    hash = ((hash << 5) - hash) + sample.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

/**
 * Update structured content (headings, lists)
 */
function updateStructuredContent() {
  // Extract headings with hierarchy
  extractedContent.structuredContent.headings = [];
  document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
    const text = cleanText(heading.textContent);
    if (text && text.length < 200) {
      const existing = extractedContent.structuredContent.headings.find(h => h.text === text);
      if (!existing) {
        extractedContent.structuredContent.headings.push({
          level: parseInt(heading.tagName[1]),
          text: text
        });
      }
    }
  });
  
  // Extract lists
  extractedContent.structuredContent.lists = [];
  document.querySelectorAll('ul, ol').forEach((list, idx) => {
    if (idx >= 10) return;
    
    const items = [];
    list.querySelectorAll(':scope > li').forEach((li, liIdx) => {
      if (liIdx >= 20) return;
      const text = getDirectText(li);
      if (text.length > 5 && text.length < 500) {
        items.push(text);
      }
    });
    
    if (items.length > 0) {
      extractedContent.structuredContent.lists.push({
        type: list.tagName.toLowerCase(),
        items: items
      });
    }
  });
}

/**
 * Update images array
 */
function updateImages() {
  const existingSrcs = new Set(extractedContent.images.map(img => img.src));
  
  document.querySelectorAll('img').forEach(img => {
    if (img.naturalWidth < 100 || img.naturalHeight < 100) return;
    if (!img.src || existingSrcs.has(img.src)) return;
    if (img.src.includes('pixel') || img.src.includes('tracking')) return;
    
    const imageData = {
      src: img.src,
      alt: img.alt || '',
      title: img.title || '',
      width: img.naturalWidth,
      height: img.naturalHeight
    };
    
    try {
      imageData.base64 = getImageBase64(img);
    } catch (e) {
      // Cross-origin - skip base64
    }
    
    extractedContent.images.push(imageData);
  });
}

/**
 * Converts an image element to base64 string
 */
function getImageBase64(img) {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const MAX_DIMENSION = 512;
    let width = img.naturalWidth;
    let height = img.naturalHeight;
    
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
      width *= ratio;
      height *= ratio;
    }
    
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);
    
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch (e) {
    return null;
  }
}

// ============================================================================
// MESSAGE HANDLING
// ============================================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractContent') {
    // Return accumulated content (truncated for API)
    sendResponse({
      ...extractedContent,
      textContent: extractedContent.textContent.substring(0, 50000)
    });
  }
  
  if (request.action === 'autoScroll') {
    autoScrollPage().then(() => {
      sendResponse({ success: true, message: 'Auto-scroll complete' });
    });
    return true;
  }
  
  if (request.action === 'getFullContent') {
    sendResponse(extractedContent);
  }
  
  return true;
});

console.log('PageSage: Content script loaded - auto-extraction active');
