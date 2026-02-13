// Obsidian Guard – Background Service Worker
// Real-time phishing detection: every URL is checked automatically.

const DEFAULT_API_URL = 'https://obsidian-production-5918.up.railway.app/api';
const CACHE_DURATION  = 30 * 60 * 1000; // 30 min
const API_TIMEOUT     = 10_000;          // 10 s

// In-memory caches
const urlCache       = new Map();
const pendingAnalysis = new Map();
const bypassedUrls    = new Set();

/* ────────────────────── INSTALL ────────────────────── */
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Obsidian Guard installed');

  const s = await chrome.storage.sync.get(['apiUrl']);
  if (!s.apiUrl) {
    await chrome.storage.sync.set({
      apiUrl: DEFAULT_API_URL,
      enableRealTimeProtection: true,
      enableNotifications: true,
      blockDangerousSites: true,
      whitelist: [],
      scanHistory: [],
    });
  }

  // Context menus
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'scanLink', title: '🔍 Scan link with Obsidian Guard', contexts: ['link'] });
    chrome.contextMenus.create({ id: 'scanPage', title: '🛡️ Scan this page',                 contexts: ['page'] });
  });
});

/* ─────────────── CONTEXT MENUS ─────────────── */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const url = info.menuItemId === 'scanLink' ? info.linkUrl : tab.url;
  const result = await analyzeUrl(url);
  showNotification(result, url);
  if (tab.id) updateBadge(tab.id, result);
});

/* ────── PRE-NAVIGATION: block before page loads ────── */
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return;
  const url = details.url;
  if (!isValidUrl(url)) return;

  // One-time bypass
  if (bypassedUrls.has(url)) { bypassedUrls.delete(url); return; }

  const settings = await chrome.storage.sync.get(['enableRealTimeProtection', 'blockDangerousSites', 'whitelist']);
  if (!settings.enableRealTimeProtection) return;

  // Whitelist check
  try { if ((settings.whitelist || []).includes(new URL(url).hostname)) return; } catch {}

  updateBadge(details.tabId, { scanning: true });

  try {
    const result = await analyzeUrl(url);

    // ── BLOCK if dangerous ──
    if (settings.blockDangerousSites && result.isPhishing && result.score >= 60) {
      const warningUrl =
        chrome.runtime.getURL('src/warning.html') +
        '?url='     + encodeURIComponent(url) +
        '&score='   + Math.round(result.score) +
        '&reasons=' + encodeURIComponent(buildReasons(result));

      chrome.tabs.update(details.tabId, { url: warningUrl });
      showNotification(result, url);
      return;
    }

    updateBadge(details.tabId, result);
  } catch (err) {
    console.error('Pre-nav analysis error:', err);
    updateBadge(details.tabId, { error: true });
  }
});

/* ────── PAGE COMPLETE: send result to content script ────── */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url && isValidUrl(tab.url)) {
    updateBadge(tabId, { scanning: true });
  }

  if (changeInfo.status === 'complete' && tab.url && isValidUrl(tab.url)) {
    const settings = await chrome.storage.sync.get(['enableRealTimeProtection']);
    if (!settings.enableRealTimeProtection) return;

    try {
      const result = await analyzeUrl(tab.url);
      updateBadge(tabId, result);

      // Tell content script to show the status banner
      try {
        await chrome.tabs.sendMessage(tabId, { action: 'showStatusBanner', data: result });
      } catch {}
    } catch (err) {
      console.error('Tab-update analysis error:', err);
      updateBadge(tabId, { error: true });
    }
  }
});

/* ── Restore badge when switching tabs ── */
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url && isValidUrl(tab.url)) {
      const cached = urlCache.get(tab.url);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        updateBadge(tabId, cached.result);
      }
    }
  } catch {}
});

/* ────────────── MESSAGE ROUTER ────────────── */
chrome.runtime.onMessage.addListener((req, _sender, sendResponse) => {
  handleMessage(req).then(sendResponse);
  return true;
});

async function handleMessage(req) {
  switch (req.action) {
    case 'analyzeUrl':        return analyzeUrl(req.url);
    case 'getStatus':         return getExtensionStatus();
    case 'getScanHistory':    return getScanHistory();
    case 'clearCache':        urlCache.clear(); return { success: true };
    case 'clearHistory':      await chrome.storage.sync.set({ scanHistory: [] }); return { success: true };
    case 'addToWhitelist':    return addToWhitelist(req.url);
    case 'removeFromWhitelist': return removeFromWhitelist(req.hostname);
    case 'getWhitelist':      return (await chrome.storage.sync.get(['whitelist'])).whitelist || [];
    case 'testConnection':
    case 'testApiConnection': return testApiConnection();

    case 'checkCurrentTab': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url || !isValidUrl(tab.url)) return { isProtected: true, reason: 'Chrome page' };
      const result = await analyzeUrl(tab.url);
      updateBadge(tab.id, result);
      return result;
    }

    case 'forceRescan': {
      const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!t?.url) return { error: 'No active tab' };
      urlCache.delete(t.url);
      const r = await analyzeUrl(t.url);
      updateBadge(t.id, r);
      // Push banner to content
      try { await chrome.tabs.sendMessage(t.id, { action: 'showStatusBanner', data: r }); } catch {}
      return r;
    }

    case 'proceedToBlockedSite':
      if (req.url) { bypassedUrls.add(req.url); return { success: true }; }
      return { success: false };

    default: return { error: 'Unknown action' };
  }
}

/* ══════════════════════════════════════════════
   ANALYSIS ENGINE
   ══════════════════════════════════════════════ */

function isValidUrl(url) {
  if (!url) return false;
  return !['chrome://', 'chrome-extension://', 'edge://', 'about:', 'file://', 'devtools://', 'view-source:', 'data:'].some(p => url.startsWith(p));
}

async function analyzeUrl(url) {
  if (!url || !isValidUrl(url)) return { isPhishing: false, score: 0, isProtected: true };

  const cached = urlCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) return cached.result;

  if (pendingAnalysis.has(url)) return pendingAnalysis.get(url);

  const promise = _performAnalysis(url);
  pendingAnalysis.set(url, promise);
  try { return await promise; } finally { pendingAnalysis.delete(url); }
}

async function _performAnalysis(url) {
  const settings = await chrome.storage.sync.get(['whitelist', 'apiUrl']);
  try { if ((settings.whitelist || []).includes(new URL(url).hostname)) {
    const r = { isPhishing: false, score: 0, whitelisted: true }; urlCache.set(url, { result: r, timestamp: Date.now() }); return r;
  }} catch {}

  const local = localAnalysis(url);

  try {
    const api = await callApi(url, settings.apiUrl || DEFAULT_API_URL);
    const merged = mergeResults(local, api);
    urlCache.set(url, { result: merged, timestamp: Date.now() });
    await saveHistory(url, merged);
    return merged;
  } catch {
    local.apiError = true;
    urlCache.set(url, { result: local, timestamp: Date.now() });
    await saveHistory(url, local);
    return local;
  }
}

/* ── LOCAL HEURISTIC ANALYSIS ── */
function localAnalysis(url) {
  const r = { isPhishing: false, score: 0, indicators: [], reason: '', analysisType: 'local' };
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    const p = u.pathname.toLowerCase();

    // IP address
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h))                { r.score += 30; r.indicators.push('IP address used instead of domain'); r.hasIPAddress = true; }
    // Suspicious TLD
    if (['.tk','.ml','.ga','.cf','.gq','.xyz','.top','.work','.click','.loan','.download'].some(t => h.endsWith(t)))
                                                             { r.score += 20; r.indicators.push('Suspicious TLD'); r.suspiciousTLD = true; }
    // Excessive subdomains
    if (h.split('.').length - 2 > 3)                         { r.score += 15; r.indicators.push('Excessive subdomains'); r.tooManySubdomains = true; }
    // Brand impersonation
    const brands = ['paypal','amazon','google','microsoft','apple','facebook','netflix','instagram','twitter','linkedin','chase','wellsfargo','bankofamerica'];
    for (const b of brands) {
      const legit = ({ paypal:['paypal.com'], amazon:['amazon.com','amazon.co.uk'], google:['google.com','googleapis.com'], microsoft:['microsoft.com','live.com','outlook.com'], apple:['apple.com','icloud.com'], facebook:['facebook.com','fb.com'], netflix:['netflix.com'], instagram:['instagram.com'], twitter:['twitter.com','x.com'], linkedin:['linkedin.com'], chase:['chase.com'], wellsfargo:['wellsfargo.com'], bankofamerica:['bankofamerica.com'] })[b] || [];
      if (h.includes(b) && !legit.some(d => h === d || h.endsWith('.' + d))) { r.score += 35; r.indicators.push(`Possible ${b} impersonation`); r.typosquatting = true; break; }
    }
    // Suspicious path keywords
    const kws = ['login','signin','verify','secure','account','update','confirm','banking','password','credential'];
    if (kws.filter(k => p.includes(k)).length >= 2) { r.score += 15; r.indicators.push('Multiple sensitive keywords in URL'); r.suspiciousKeywords = true; }
    // Non-standard port
    if (u.port && !['80','443',''].includes(u.port)) { r.score += 10; r.indicators.push('Non-standard port'); }
    // Long URL
    if (url.length > 100)                            { r.score += 10; r.indicators.push('Unusually long URL'); }
    // @ symbol
    if (url.includes('@') && !url.includes('mailto:')){ r.score += 25; r.indicators.push('@ symbol in URL'); }
    // No HTTPS
    if (u.protocol !== 'https:')                     { r.score += 10; r.indicators.push('No HTTPS'); r.noSSL = true; }
    // Homograph
    if (/[^\x00-\x7F]/.test(h))                     { r.score += 25; r.indicators.push('Non-ASCII domain (homograph risk)'); }
    // Hex encoding
    if ((url.match(/%[0-9a-fA-F]{2}/g) || []).length > 5) { r.score += 15; r.indicators.push('Excessive URL encoding'); }

    r.score = Math.min(r.score, 100);
    r.isPhishing = r.score >= 50;
    r.threatLevel = r.score >= 70 ? 'high' : r.score >= 50 ? 'medium' : r.score >= 25 ? 'low' : 'safe';
    r.reason = r.score >= 70 ? 'High risk – multiple phishing indicators' : r.score >= 50 ? 'Medium risk – suspicious signals' : r.score >= 25 ? 'Low risk – minor flags' : 'Site appears safe';
  } catch {}
  return r;
}

/* ── BACKEND API CALL ── */
async function callApi(url, apiUrl) {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), API_TIMEOUT);
  try {
    const resp = await fetch(`${apiUrl}/phishing/v1/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: ctrl.signal,
    });
    clearTimeout(tid);
    if (!resp.ok) throw new Error(`API ${resp.status}`);
    const data = await resp.json();
    data.analysisType = 'ai';
    return data;
  } catch (e) { clearTimeout(tid); throw e; }
}

async function testApiConnection() {
  const s = await chrome.storage.sync.get(['apiUrl']);
  const base = (s.apiUrl || DEFAULT_API_URL).replace('/api', '');
  try {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 5000);
    const resp = await fetch(`${base}/health`, { signal: ctrl.signal });
    clearTimeout(tid);
    return { connected: resp.ok, apiUrl: s.apiUrl || DEFAULT_API_URL };
  } catch (e) { return { connected: false, error: e.message }; }
}

function mergeResults(local, api) {
  if (!api) return local;
  const score = Math.max(local.score, api.score || 0);
  const indicators = [...new Set([...local.indicators, ...(api.indicators || [])])];
  return {
    isPhishing: score >= 50 || api.isPhishing,
    score,
    indicators,
    reason:      api.reason || local.reason,
    threatLevel: score >= 70 ? 'high' : score >= 50 ? 'medium' : score >= 25 ? 'low' : 'safe',
    aiAnalysis:  api.aiAnalysis || null,
    analysisType: api.analysisType || local.analysisType,
    // flags
    typosquatting: local.typosquatting, suspiciousTLD: local.suspiciousTLD,
    hasIPAddress: local.hasIPAddress, tooManySubdomains: local.tooManySubdomains,
    suspiciousKeywords: local.suspiciousKeywords, noSSL: local.noSSL,
  };
}

/* ── HELPERS ── */
function buildReasons(r) {
  const list = [];
  if (r.typosquatting)       list.push('URL mimics a trusted brand (typosquatting)');
  if (r.suspiciousTLD)       list.push('Suspicious domain extension');
  if (r.hasIPAddress)        list.push('Raw IP address instead of domain');
  if (r.tooManySubdomains)   list.push('Excessive subdomain depth');
  if (r.suspiciousKeywords)  list.push('Phishing keywords detected');
  if (r.noSSL)               list.push('Missing HTTPS security');
  if (r.indicators?.length)  r.indicators.forEach(i => { if (!list.includes(i)) list.push(i); });
  return list.length ? list.join('|') : 'Suspicious URL patterns detected';
}

function updateBadge(tabId, result) {
  if (!tabId) return;
  if (result.scanning)   { chrome.action.setBadgeText({ text: '…', tabId }); chrome.action.setBadgeBackgroundColor({ color: '#6c757d', tabId }); return; }
  if (result.error)      { chrome.action.setBadgeText({ text: '!', tabId }); chrome.action.setBadgeBackgroundColor({ color: '#ffc107', tabId }); return; }
  if (result.isProtected){ chrome.action.setBadgeText({ text: '',  tabId }); return; }
  if (result.whitelisted){ chrome.action.setBadgeText({ text: '★', tabId }); chrome.action.setBadgeBackgroundColor({ color: '#17a2b8', tabId }); return; }

  if (result.isPhishing || result.score >= 70) {
    chrome.action.setBadgeText({ text: '✕', tabId }); chrome.action.setBadgeBackgroundColor({ color: '#dc3545', tabId });
  } else if (result.score >= 40) {
    chrome.action.setBadgeText({ text: '!', tabId }); chrome.action.setBadgeBackgroundColor({ color: '#fd7e14', tabId });
  } else {
    chrome.action.setBadgeText({ text: '✓', tabId }); chrome.action.setBadgeBackgroundColor({ color: '#22c55e', tabId });
  }
}

async function showNotification(result, url) {
  const s = await chrome.storage.sync.get(['enableNotifications']);
  if (!s.enableNotifications) return;
  if (result.score < 40) return;
  try {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: result.score >= 70 ? '🚨 Phishing Alert!' : '⚠️ Suspicious Site',
      message: `Risk ${result.score}% – ${new URL(url).hostname}`,
      priority: 2,
      requireInteraction: result.isPhishing,
    });
  } catch {}
}

async function saveHistory(url, result) {
  try {
    const s = await chrome.storage.sync.get(['scanHistory']);
    const h = s.scanHistory || [];
    const existing = h.findIndex(x => x.url === url && Date.now() - x.timestamp < 60000);
    if (existing >= 0) h[existing] = { url, result, timestamp: Date.now() };
    else h.unshift({ url, result, timestamp: Date.now() });
    if (h.length > 200) h.splice(200);
    await chrome.storage.sync.set({ scanHistory: h });
  } catch {}
}

async function getScanHistory() {
  return (await chrome.storage.sync.get(['scanHistory'])).scanHistory || [];
}

async function addToWhitelist(url) {
  try {
    const hostname = new URL(url).hostname;
    const s = await chrome.storage.sync.get(['whitelist']);
    const wl = s.whitelist || [];
    if (!wl.includes(hostname)) { wl.push(hostname); await chrome.storage.sync.set({ whitelist: wl }); }
    urlCache.delete(url);
    return { success: true, hostname };
  } catch (e) { return { success: false, error: e.message }; }
}

async function removeFromWhitelist(hostname) {
  const s = await chrome.storage.sync.get(['whitelist']);
  const wl = s.whitelist || [];
  const i = wl.indexOf(hostname);
  if (i > -1) { wl.splice(i, 1); await chrome.storage.sync.set({ whitelist: wl }); }
  return { success: true };
}

async function getExtensionStatus() {
  const s = await chrome.storage.sync.get(['enableRealTimeProtection','enableNotifications','whitelist','scanHistory','apiUrl']);
  const h = s.scanHistory || [];
  const today = new Date().setHours(0,0,0,0);
  return {
    realTimeProtection: s.enableRealTimeProtection !== false,
    notifications: s.enableNotifications !== false,
    whitelistCount: (s.whitelist || []).length,
    totalScans: h.length,
    threatsDetected: h.filter(x => x.result?.isPhishing).length,
    todayScans: h.filter(x => x.timestamp >= today).length,
    todayThreats: h.filter(x => x.timestamp >= today && x.result?.isPhishing).length,
    cacheSize: urlCache.size,
    apiUrl: s.apiUrl || DEFAULT_API_URL,
  };
}