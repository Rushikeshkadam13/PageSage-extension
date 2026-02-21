# PageSage - AI-Powered Webpage Analysis Extension

A Chrome/Edge browser extension that uses **Groq FREE API** (Llama 3.3 70B) to analyze webpage content (text and images) and answer questions about it.

## Features

- **Quick Summaries**: Get instant summaries of any webpage
- **Custom Questions**: Ask anything about the page content
- **Image Analysis**: Analyze images on the page (FREE with Gemini!)
- **Key Points Extraction**: Extract main takeaways and highlights
- **Modern UI**: Clean, intuitive interface
- **100% FREE**: Uses Google Gemini's generous free tier

## Free Tier Limits

Google Gemini provides a generous free tier:
- **15 requests per minute**
- **1,500 requests per day**
- **1 million tokens per minute**
- **Vision/Image analysis included FREE!**

## Installation

### From Source (Developer Mode)

1. Clone or download this repository
2. Open Chrome/Edge and go to `chrome://extensions/` or `edge://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `PageSage` folder
6. The extension icon should appear in your toolbar

## Configuration

### Getting a FREE Google Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key (starts with `AIza`)

### Setting Up the Extension

1. Click the PageSage extension icon
2. Click the ⚙️ (settings) button
3. Paste your Gemini API key
4. Click "Save Settings"

## Usage

### Quick Actions

- **📝 Quick Summary**: Get a 2-3 sentence summary
- **🎯 What's This About?**: Understand the main topic
- **📌 Key Points**: Extract main takeaways
- **🖼️ Describe Images**: Get descriptions of page images

### Custom Questions

Type any question in the text area and press the send button (or Ctrl/Cmd + Enter).

Example questions:
- "What are the pros and cons mentioned?"
- "Summarize the conclusion"
- "What data or statistics are presented?"
- "Explain the main argument in simple terms"

## File Structure

```
PageSage/
├── manifest.json      # Extension configuration
├── popup.html         # Popup UI structure
├── popup.js           # Popup logic and interactions
├── background.js      # Service worker for API calls
├── content.js         # Content extraction script
├── README.md          # This file
└── icons/             # Extension icons
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## API Models

### Free Tier (Default) - gemini-1.5-flash
- Fast responses
- Text + Image analysis
- 500 token response limit (concise answers)

### Premium Tier (Optional) - gemini-1.5-pro
To enable the pro model (same free limits, better quality):

In `background.js`, uncomment the `PREMIUM` config and change:
```javascript
const ACTIVE_CONFIG = CONFIG.PREMIUM;  // Change from CONFIG.FREE
```

## Technical Details

### Content Extraction
- Extracts main text content (up to 10,000 characters)
- Captures up to 5 significant images (>100x100 pixels)
- Preserves page structure (headings, lists, tables)
- Filters out navigation, ads, and hidden elements

### API Communication
- Uses Chrome's message passing for popup-background communication
- API key stored securely in `chrome.storage.local`
- Handles rate limiting and error responses

## Troubleshooting

### "API key not configured"
- Make sure you've saved your API key in settings
- Check that the key starts with `AIza`
- Get a free key from [Google AI Studio](https://aistudio.google.com/app/apikey)

### "Unable to extract page content"
- Refresh the page and try again
- Some pages (like chrome:// pages) cannot be accessed

### Rate limit errors
- Free tier: 15 requests/minute, 1500/day
- Wait a minute and try again

### No response / Timeout
- Check your internet connection
- Try a shorter query

## Privacy

- Your API key is stored locally in your browser
- Page content is sent to Google Gemini for analysis
- No data is stored on external servers by this extension

## License

MIT License - Feel free to modify and distribute.

## Contributing

Contributions welcome! Please submit issues and pull requests on GitHub.