# Privacy Policy for PageSage

**Last Updated: February 22, 2026**

## Overview
PageSage is a browser extension that helps users analyze webpage content using AI. This privacy policy explains how we handle your data.

## Data Collection

### What We Collect
When you use PageSage, the extension collects:
- **Webpage Content**: Text, headings, and image metadata from pages you choose to analyze
- **Your Questions**: Queries you type to ask about the webpage
- **API Keys**: Your personal API keys for AI services (stored locally only)

### What We DON'T Collect
- Browsing history
- Personal information
- Data from pages you don't analyze
- Cookies or tracking data

## Data Storage
All data is stored **locally on your device** using Chrome's built-in storage API:
- API keys for AI providers (Groq, Google Gemini, OpenAI, xAI)
- Your theme preference (dark/light mode)
- Chat history per webpage URL

**We do not have servers. We do not store any of your data.**

## Data Transmission
When you ask a question about a webpage:
1. The webpage content and your question are sent **directly** to your chosen AI provider
2. Data travels over secure HTTPS connections
3. No data passes through PageSage servers (we don't have any)

### Third-Party AI Services
PageSage connects to these AI providers based on your selection:
- **Groq** (api.groq.com) - [Groq Privacy Policy](https://groq.com/privacy-policy/)
- **Google Gemini** (generativelanguage.googleapis.com) - [Google Privacy Policy](https://policies.google.com/privacy)
- **OpenAI** (api.openai.com) - [OpenAI Privacy Policy](https://openai.com/privacy/)
- **xAI** (api.x.ai) - [xAI Privacy Policy](https://x.ai/privacy)

You are responsible for reviewing and accepting the privacy policies of whichever AI service you choose to use.

## Data Deletion
- **Chat History**: Click the "Clear" button in the extension to delete chat history for the current page
- **All Data**: Uninstalling PageSage removes all stored data from your device
- **API Keys**: You can remove your API keys anytime in Settings

## Permissions Explained
| Permission | Why We Need It |
|------------|----------------|
| activeTab | To read content from the page you're viewing when you click the extension |
| scripting | To extract text and images from webpages |
| storage | To save your settings and chat history locally |
| host permissions | To work on any website you want to analyze |

## Children's Privacy
PageSage is not intended for children under 13. We do not knowingly collect data from children.

## Changes to This Policy
We may update this privacy policy occasionally. Changes will be reflected in the "Last Updated" date above.

## Contact
If you have questions about this privacy policy, please open an issue on our GitHub repository.

## Open Source
PageSage is open source. You can review our code to verify our privacy practices.

---

*This extension is provided "as is" without warranty. Your use of third-party AI services is subject to their respective terms and privacy policies.*
