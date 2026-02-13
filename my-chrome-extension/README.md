# 🧩 Obsidian Guard — Chrome Extension

> AI-powered real-time phishing detection browser extension that protects users while browsing and reports activity to enterprise dashboards.

---

## ✨ Features

- **Real-time URL Analysis** — Every page is scanned automatically before loading
- **Pre-navigation Blocking** — Dangerous sites are blocked before they load
- **Warning Pages** — Full-page warning with risk details for phishing sites
- **Risk Badge** — Color-coded badge on extension icon (✓ safe, ! warning, ✕ danger)
- **Local Heuristic Engine** — Client-side URL analysis (no API needed)
- **Backend AI Analysis** — Server-side scoring with ML model
- **Notifications** — Desktop alerts for detected threats
- **Whitelist** — Trust known-safe domains
- **Scan History** — Track all scanned URLs with results
- **Context Menu** — Right-click to scan any link or page
- **Enterprise Login** — Employees log in to link with their company
- **Activity Reporting** — URL visits and threats reported to enterprise dashboard
- **Configurable Settings** — API URL, sensitivity, protection toggles

---

## 📁 Project Structure

```
my-chrome-extension/
├── manifest.json              # Extension manifest (V3)
├── icons/                     # Extension icons (16, 48, 128px)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── src/
│   ├── background.js          # Service worker — URL analysis engine
│   ├── content.js             # Content script — in-page status banners
│   ├── content.css            # Styles for content script elements
│   ├── warning.html           # Full-page phishing warning
│   ├── popup/
│   │   ├── popup.html         # Popup UI
│   │   ├── popup.js           # Popup controller
│   │   └── popup.css          # Popup styles
│   └── options/
│       ├── options.html       # Settings page
│       ├── options.js         # Settings controller
│       └── options.css        # Settings styles
└── README.md
```

---

## 🚀 Installation

### Development Mode

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle top-right)
3. Click **Load unpacked**
4. Select the `my-chrome-extension/` folder
5. The Obsidian Guard icon appears in the toolbar

### Configuration

1. Right-click the extension icon → **Options**
2. Set the API URL: `http://localhost:3000/api` (default)
3. Configure protection settings as needed

---

## 🔍 How It Works

### Detection Pipeline

```
User navigates to URL
        │
        ▼
┌─────────────────┐
│  Whitelist check │──── Whitelisted? → Allow ✓
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Local Heuristics │ ← IP check, TLD, subdomains, brand impersonation,
└────────┬────────┘   keywords, port, URL length, HTTPS, encoding
         │
         ▼
┌─────────────────┐
│  Backend AI API  │ ← ML model + Gemini AI analysis
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Merge Results   │ → Score 0-100, indicators, threat level
└────────┬────────┘
         │
    ┌────┴────┐
    │ Score?  │
    ├─────────┤
    │  ≥ 60   │ → BLOCK → Warning page
    │  ≥ 40   │ → WARN  → Orange badge + notification
    │  < 40   │ → SAFE  → Green badge ✓
    └─────────┘
```

### Local Heuristic Checks

| Check | Points | Description |
|-------|--------|-------------|
| IP address as hostname | +30 | Raw IP instead of domain |
| Suspicious TLD | +20 | .tk, .ml, .ga, .xyz, etc. |
| Excessive subdomains | +15 | More than 3 subdomain levels |
| Brand impersonation | +35 | Domain contains brand name but isn't official |
| Suspicious keywords | +15 | login, verify, secure, account in path |
| Non-standard port | +10 | Not 80 or 443 |
| Long URL | +10 | Over 100 characters |
| @ symbol in URL | +25 | URL obfuscation technique |
| No HTTPS | +10 | Missing SSL |
| Non-ASCII domain | +25 | Homograph/IDN attack |
| Excessive encoding | +15 | Too many %XX sequences |

### Risk Levels

| Score | Level | Badge | Action |
|-------|-------|-------|--------|
| 0–24 | Safe | ✓ Green | Allow |
| 25–49 | Low | ✓ Green | Allow |
| 50–69 | Medium | ! Orange | Warn + notification |
| 70–100 | High | ✕ Red | Block + warning page |

---

## 🏢 Enterprise Integration

### Employee Login

Employees can log in through the extension popup using their email and invite token. Once logged in:

- The extension reports browsing activity to the enterprise dashboard
- URL visits, phishing detections, and blocked sites are tracked
- Enterprise admins can view real-time activity reports

### Activity Reporting

The extension sends activity data to the backend:

| Activity Type | Trigger |
|--------------|---------|
| `url_visit` | Employee visits a URL |
| `phishing_detected` | Phishing site detected |
| `site_blocked` | Dangerous site blocked |
| `extension_login` | Employee logs into extension |

---

## ⚙️ Settings

Access via right-click → Options, or extension popup settings gear.

| Setting | Default | Description |
|---------|---------|-------------|
| API URL | `http://localhost:3000/api` | Backend server URL |
| Real-time Protection | ON | Auto-scan every page |
| Notifications | ON | Desktop alerts for threats |
| Block Dangerous Sites | ON | Pre-navigation blocking |
| Whitelist | Empty | Trusted domains to skip |

### Import / Export

- **Export** settings as JSON for backup
- **Import** settings from JSON file
- **Reset** to defaults

---

## 🔧 Permissions

Defined in `manifest.json`:

| Permission | Reason |
|-----------|--------|
| `activeTab` | Access current tab URL |
| `storage` | Save settings, history, cache |
| `tabs` | Monitor tab navigation |
| `webNavigation` | Pre-navigation blocking |
| `notifications` | Threat alerts |
| `alarms` | Periodic tasks |
| `contextMenus` | Right-click scan options |

### Content Scripts

- Runs on all URLs (`<all_urls>`)
- Injects status banners showing scan results
- Displays visual indicators for threat levels

---

## 🛠️ Development

### Manifest V3

This extension uses Chrome Manifest V3 with:
- Service worker (`background.js`) instead of background page
- `chrome.action` API for popup and badges
- `chrome.storage.sync` for cross-device settings

### Debugging

1. Open `chrome://extensions/`
2. Click **service worker** link to open DevTools for background script
3. Right-click popup → Inspect for popup DevTools
4. Use console for `chrome.storage.sync.get()` to inspect state

### Reload After Changes

After modifying files:
1. Go to `chrome://extensions/`
2. Click the reload ↻ button on the extension card

---

## 📡 API Integration

The extension communicates with the backend:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/phishing/v1/analyze` | POST | Analyze URL for phishing |
| `/health` | GET | Test API connectivity |

### Cache

- URL analysis results are cached for **30 minutes**
- Prevents duplicate API calls for the same URL
- Cache can be cleared from popup or options
