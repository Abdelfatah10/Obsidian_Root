# Phishing Shield - Chrome Extension

AI-powered phishing detection extension that protects you from malicious websites and emails.

## Features

- 🛡️ **Real-time Protection**: Automatically scans websites as you browse
- 🔍 **URL Analysis**: Detects phishing indicators in URLs
- 📧 **Email Scanning**: Analyze suspicious emails for phishing attempts
- ⚠️ **Visual Warnings**: Clear warning overlays for dangerous sites
- 📊 **Risk Scoring**: See detailed risk scores and threat indicators
- ✅ **Whitelist**: Trust sites you know are safe
- 🔔 **Notifications**: Get alerted when threats are detected
- 📜 **Scan History**: Track your browsing security

## Installation

### Development Mode

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `my-chrome-extension` folder

### Production Build

1. Zip the extension folder (excluding `.git` and `node_modules`)
2. Upload to Chrome Web Store Developer Dashboard

## Project Structure

```
my-chrome-extension/
├── manifest.json           # Extension configuration
├── icons/                  # Extension icons (16, 48, 128px)
├── src/
│   ├── background.js       # Service worker - handles URL analysis
│   ├── content.js          # Page scanning and warning display
│   ├── content.css         # Styles for in-page elements
│   ├── popup/
│   │   ├── popup.html      # Popup UI
│   │   ├── popup.js        # Popup logic
│   │   └── popup.css       # Popup styles
│   └── options/
│       ├── options.html    # Settings page
│       ├── options.js      # Settings logic
│       └── options.css     # Settings styles
└── README.md
```

## Configuration

### API Settings

Configure the backend API URL in the extension options:

1. Right-click the extension icon
2. Select "Options"
3. Enter your API URL (default: `https://obsidian-production-5918.up.railway.app/api`)

### Backend Integration

This extension works with the Phishing Shield backend API.

Required API endpoints:
- `POST /api/phishing/analyze` - Analyze URL for phishing
- `POST /api/phishing/analyze-email` - Analyze email content

## Detection Methods

### Local Analysis (Heuristics)

- IP address instead of domain name
- Suspicious top-level domains (.tk, .ml, etc.)
- Excessive subdomains
- Brand impersonation in subdomains
- Suspicious keywords in URL path
- Unusual port numbers
- Long URLs
- @ symbol in URL
- Excessive URL encoding

### AI-Powered Analysis (Backend)

- Machine learning-based phishing detection
- Real-time threat intelligence
- Domain reputation checking

## Permissions

- `activeTab`: Access current tab information
- `storage`: Store settings and scan history
- `tabs`: Monitor tab navigation
- `webNavigation`: Track page loads
- `notifications`: Display security alerts
- `<all_urls>`: Scan any website

## Contributing

Feel free to submit issues or pull requests for improvements and bug fixes.

## License

This project is licensed under the MIT License.