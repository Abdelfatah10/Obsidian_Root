// Obsidian Guard – Popup Script
document.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);

  const els = {
    apiDot:       $('api-dot'),
    statusIcon:   $('status-icon'),
    statusText:   $('status-text'),
    threatBadge:  $('threat-badge'),
    currentUrl:   $('current-url'),
    scoreFill:    $('score-fill'),
    scoreVal:     $('score-val'),
    analysisType: $('analysis-type'),
    indSection:   $('ind-section'),
    indCount:     $('ind-count'),
    indList:      $('ind-list'),
    aiSection:    $('ai-section'),
    aiText:       $('ai-text'),
    btnScan:      $('btn-scan'),
    btnTrust:     $('btn-trust'),
    sToday:       $('s-today'),
    sThreats:     $('s-threats'),
    sTrusted:     $('s-trusted'),
    sCache:       $('s-cache'),
    togProtect:   $('tog-protect'),
    togNotify:    $('tog-notify'),
    linkSettings: $('link-settings'),
  };

  await init();

  /* ── init ── */
  async function init() {
    loadSettings();
    checkApi();
    checkTab();
    loadStats();
    els.btnScan.addEventListener('click', rescan);
    els.btnTrust.addEventListener('click', trust);
    els.togProtect.addEventListener('change', () => chrome.storage.sync.set({ enableRealTimeProtection: els.togProtect.checked }));
    els.togNotify.addEventListener('change',  () => chrome.storage.sync.set({ enableNotifications: els.togNotify.checked }));
    els.linkSettings.addEventListener('click', e => { e.preventDefault(); chrome.runtime.openOptionsPage(); });
  }

  async function loadSettings() {
    const s = await chrome.storage.sync.get(['enableRealTimeProtection', 'enableNotifications']);
    els.togProtect.checked = s.enableRealTimeProtection !== false;
    els.togNotify.checked  = s.enableNotifications !== false;
  }

  async function checkApi() {
    try {
      const r = await msg({ action: 'testConnection' });
      els.apiDot.classList.toggle('online',  r?.connected);
      els.apiDot.classList.toggle('offline', !r?.connected);
      els.apiDot.title = r?.connected ? 'API connected' : 'API offline – local analysis only';
    } catch {
      els.apiDot.classList.add('offline');
    }
  }

  async function checkTab() {
    try { updateUI(await msg({ action: 'checkCurrentTab' })); }
    catch { els.statusText.textContent = 'Unable to analyze'; }
  }

  async function loadStats() {
    try {
      const s = await msg({ action: 'getStatus' });
      if (!s) return;
      els.sToday.textContent   = s.todayScans   || 0;
      els.sThreats.textContent = s.todayThreats  || 0;
      els.sTrusted.textContent = s.whitelistCount || 0;
      els.sCache.textContent   = s.cacheSize     || 0;
    } catch {}
  }

  /* ── actions ── */
  async function rescan() {
    els.btnScan.disabled = true;
    els.btnScan.textContent = '⏳ Scanning…';
    try {
      updateUI(await msg({ action: 'forceRescan' }));
      await loadStats();
    } catch {}
    els.btnScan.disabled = false;
    els.btnScan.textContent = '🔍 Scan';
  }

  async function trust() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;
    try {
      const r = await msg({ action: 'addToWhitelist', url: tab.url });
      if (r?.success) { await checkTab(); await loadStats(); }
    } catch {}
  }

  /* ── ui update ── */
  function updateUI(r) {
    const card = $('status-card');
    card.className = 'card';

    if (!r || r.error || r.isProtected) {
      els.statusIcon.textContent  = '🔒';
      els.statusText.textContent  = 'Protected page';
      els.threatBadge.textContent = '';
      els.currentUrl.textContent  = 'Chrome internal page';
      card.classList.add('protected');
      els.scoreFill.style.width   = '0%';
      els.scoreVal.textContent    = '0%';
      els.indSection.classList.add('hidden');
      els.aiSection.classList.add('hidden');
      els.analysisType.textContent = '';
      return;
    }

    // hostname
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      try { els.currentUrl.textContent = new URL(tabs[0].url).hostname; } catch {}
    });

    const score = r.score || 0;

    if (r.whitelisted) {
      els.statusIcon.textContent  = '⭐';
      els.statusText.textContent  = 'Trusted Site';
      els.threatBadge.textContent = 'WHITELISTED';
      els.threatBadge.className   = 'badge trusted';
      card.classList.add('trusted');
    } else if (r.isPhishing || score >= 70) {
      els.statusIcon.textContent  = '🚨';
      els.statusText.textContent  = 'DANGER!';
      els.threatBadge.textContent = 'HIGH RISK';
      els.threatBadge.className   = 'badge danger';
      card.classList.add('danger');
    } else if (score >= 40) {
      els.statusIcon.textContent  = '⚠️';
      els.statusText.textContent  = 'Suspicious';
      els.threatBadge.textContent = 'MEDIUM RISK';
      els.threatBadge.className   = 'badge warning';
      card.classList.add('warning');
    } else {
      els.statusIcon.textContent  = '✅';
      els.statusText.textContent  = 'Verified Safe';
      els.threatBadge.textContent = 'SAFE';
      els.threatBadge.className   = 'badge safe';
      card.classList.add('safe');
    }

    els.scoreVal.textContent  = score + '%';
    els.scoreFill.style.width = Math.min(score, 100) + '%';
    els.scoreFill.className   = 'fill ' + (score >= 70 ? 'danger' : score >= 40 ? 'warning' : 'safe');

    if (r.analysisType) {
      els.analysisType.textContent = r.analysisType === 'ai' ? '🌐 AI Analysis' : '💻 Local Analysis';
    } else { els.analysisType.textContent = ''; }

    // indicators
    if (r.indicators?.length) {
      els.indSection.classList.remove('hidden');
      els.indCount.textContent = r.indicators.length;
      els.indList.innerHTML = r.indicators.slice(0, 5).map(i => `<li>${esc(i)}</li>`).join('');
      if (r.indicators.length > 5) els.indList.innerHTML += `<li class="more">+${r.indicators.length - 5} more</li>`;
    } else { els.indSection.classList.add('hidden'); }

    // ai
    if (r.aiAnalysis) {
      els.aiSection.classList.remove('hidden');
      els.aiText.textContent = r.aiAnalysis;
    } else { els.aiSection.classList.add('hidden'); }
  }

  /* ── helpers ── */
  function msg(m) {
    return new Promise((res, rej) => chrome.runtime.sendMessage(m, r => chrome.runtime.lastError ? rej(chrome.runtime.lastError) : res(r)));
  }
  function esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
});