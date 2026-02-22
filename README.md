# PageSage

AI-powered Chrome/Edge extension to query and summarize webpage content using multiple AI providers.

## Features

- Instant page summaries
- Ask custom questions about page content
- Key points extraction
- **Image analysis with Gemini** (vision AI analyzes actual images on the page)
- Multiple AI providers: Groq (Llama), Google Gemini, OpenAI ChatGPT, xAI Grok
- Pop-out window mode (stays open when clicking outside)

## Installation

1. Go to `chrome://extensions/` (or `edge://extensions/`)
2. Enable **Developer mode**
3. Click **Load unpacked** → select this folder

## Setup

1. Click the extension icon → ⚙️ Settings
2. Select your AI provider:
   - **Groq (FREE)**: Get API key from [Groq Console](https://console.groq.com/keys) - text only
   - **Gemini (FREE + Vision)**: Get API key from [Google AI Studio](https://aistudio.google.com/apikey) - analyzes images!
   - **OpenAI**: Get API key from [OpenAI Platform](https://platform.openai.com/api-keys) - text only
   - **Grok**: Get API key from [xAI Console](https://console.x.ai) - text only
3. Paste your API key and save

## Usage

Click the extension icon on any webpage, then:
- Use quick action buttons for summaries, key points, or image descriptions
- Type custom questions and press Send (or `Ctrl/Cmd + Enter`)
- Click ⤈ to open in a standalone window that stays open

**For image analysis:** Select Gemini as your provider, then ask questions like:
- "Describe the images on this page"
- "What does the diagram show?"
- "Explain the infographic"

## Tech Stack

- Chrome Extension (Manifest V3)
- Multiple AI APIs (Groq, Gemini, OpenAI, Grok)

## Privacy

This extension:
- Does NOT collect or store any personal data
- API keys are stored locally in your browser
- Page content is sent only to your selected AI provider

## License

MIT
