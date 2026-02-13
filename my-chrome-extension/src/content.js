// Obsidian Guard – Content Script
// Shows a status banner on every page after analysis completes.

(function () {
  'use strict';

  const BANNER_DURATION = 4500; // ms before auto-hide
  let bannerEl = null;
  let hideTimer = null;
  let lastResult = null;

  /* ─── Message listener ─── */
  chrome.runtime.onMessage.addListener((req, _sender, sendResponse) => {
    switch (req.action) {
      case 'showStatusBanner':
        lastResult = req.data;
        showBanner(req.data);
        sendResponse({ success: true });
        break;
      case 'showWarning':
        lastResult = req.data;
        showBanner(req.data);
        sendResponse({ success: true });
        break;
      case 'hideWarning':
        removeBanner();
        sendResponse({ success: true });
        break;
      case 'getLastScan':
        sendResponse(lastResult);
        break;
      case 'scanPage':
        sendResponse(scanPageContent());
        break;
      default:
        sendResponse({ error: 'Unknown action' });
    }
    return true;
  });

  /* ════════════════════════════════════════════
     STATUS BANNER  (Shadow DOM – fully isolated)
     ════════════════════════════════════════════ */

  function showBanner(result) {
    removeBanner(); // clear any existing

    if (!result || result.isProtected) return;

    // Determine style
    let icon, text, bgFrom, bgTo, borderColor;
    const score = result.score ?? 0;

    if (result.whitelisted) {
      icon = '★';
      text = 'Trusted Site';
      bgFrom = '#0d6efd'; bgTo = '#0b5394'; borderColor = '#339af0';
    } else if (result.isPhishing || score >= 70) {
      icon = '✕';
      text = `Threat Detected  \u2022  Risk ${score}%`;
      bgFrom = '#dc3545'; bgTo = '#b02a37'; borderColor = '#f87171';
    } else if (score >= 40) {
      icon = '\u26A0';
      text = `Suspicious  \u2022  Risk ${score}%`;
      bgFrom = '#e67e22'; bgTo = '#c0601a'; borderColor = '#f0a050';
    } else {
      icon = '✓';
      text = 'Verified Safe';
      bgFrom = '#16a34a'; bgTo = '#0f7a36'; borderColor = '#4ade80';
    }

    // Build DOM – completely isolated with shadow DOM
    const host = document.createElement('div');
    host.id = 'obsidian-guard-banner-host';
    host.style.cssText = 'all:initial !important; position:fixed !important; top:12px !important; right:12px !important; z-index:2147483647 !important; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif !important; pointer-events:auto !important;';

    const shadow = host.attachShadow({ mode: 'closed' });

    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .banner {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 18px 10px 14px;
          border-radius: 12px;
          background: linear-gradient(135deg, ${bgFrom}, ${bgTo});
          border: 1px solid ${borderColor};
          box-shadow: 0 8px 32px rgba(0,0,0,.35), 0 0 0 1px rgba(255,255,255,.08) inset;
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: .3px;
          backdrop-filter: blur(10px);
          opacity: 0;
          transform: translateX(60px);
          animation: slideIn .35s cubic-bezier(.16,1,.3,1) forwards;
          cursor: default;
          user-select: none;
          min-width: 170px;
        }
        .banner.hide {
          animation: slideOut .3s ease-in forwards;
        }
        .icon {
          font-size: 18px;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,.18);
          border-radius: 8px;
          flex-shrink: 0;
        }
        .text { white-space: nowrap; }
        .shield {
          font-size: 11px;
          opacity: .7;
          margin-left: auto;
          padding-left: 8px;
        }
        .close {
          margin-left: 4px;
          cursor: pointer;
          opacity: .6;
          font-size: 14px;
          line-height: 1;
          transition: opacity .15s;
          padding: 2px;
        }
        .close:hover { opacity: 1; }
        @keyframes slideIn {
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideOut {
          to { opacity: 0; transform: translateX(60px); }
        }
      </style>
      <div class="banner" id="b">
        <span class="icon">${icon}</span>
        <span class="text">${text}</span>
        <span class="shield">\uD83D\uDEE1\uFE0F</span>
        <span class="close" id="x">\u2715</span>
      </div>
    `;

    document.documentElement.appendChild(host);
    bannerEl = host;

    // Close button
    shadow.getElementById('x').addEventListener('click', () => removeBanner());

    // Auto-hide
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => removeBanner(), BANNER_DURATION);
  }

  function removeBanner() {
    clearTimeout(hideTimer);
    if (!bannerEl) return;
    try {
      const shadow = bannerEl.shadowRoot;
      if (shadow) {
        const b = shadow.getElementById('b');
        if (b) {
          b.classList.add('hide');
          setTimeout(() => { try { bannerEl?.remove(); } catch {} bannerEl = null; }, 350);
          return;
        }
      }
      bannerEl.remove();
    } catch {}
    bannerEl = null;
  }

  /* ════════════════════════════════════════════
     LIGHTWEIGHT PAGE SCAN (for background)
     ════════════════════════════════════════════ */

  function scanPageContent() {
    const r = { score: 0, indicators: [], isPhishing: false };
    try {
      // Password forms without HTTPS
      const forms = document.querySelectorAll('form');
      let hasPwField = false;
      forms.forEach(f => {
        if (f.querySelector('input[type="password"]')) hasPwField = true;
      });
      if (hasPwField && location.protocol !== 'https:') {
        r.score += 25;
        r.indicators.push('Login form on non-HTTPS page');
      }

      // External form action
      forms.forEach(f => {
        if (f.action) {
          try {
            const dest = new URL(f.action, location.href);
            if (dest.hostname !== location.hostname) {
              r.score += 20;
              r.indicators.push('Form submits to external domain');
            }
          } catch {}
        }
      });

      // Urgency language
      const bodyText = (document.body?.innerText || '').toLowerCase();
      const urgency = ['verify your account', 'confirm your identity', 'suspended', 'unauthorized', 'act now', 'click here immediately', 'your account will be'];
      const hits = urgency.filter(u => bodyText.includes(u));
      if (hits.length >= 2) {
        r.score += 20;
        r.indicators.push('Urgency / fear language detected');
      }

      // Hidden iframes
      const iframes = document.querySelectorAll('iframe');
      let hidden = 0;
      iframes.forEach(f => {
        const s = getComputedStyle(f);
        if (s.display === 'none' || s.visibility === 'hidden' || (parseInt(s.width) <= 1 && parseInt(s.height) <= 1)) hidden++;
      });
      if (hidden > 0) {
        r.score += 15;
        r.indicators.push('Hidden iframe(s) detected');
      }

      r.score = Math.min(r.score, 100);
      r.isPhishing = r.score >= 40;
    } catch {}
    return r;
  }
})();