// Phishing Shield - Popup Script

document.addEventListener('DOMContentLoaded', async function() {
    // Elements
    const statusIcon = document.getElementById('status-icon');
    const statusText = document.getElementById('status-text');
    const currentUrl = document.getElementById('current-url');
    const scoreFill = document.getElementById('score-fill');
    const scoreValue = document.getElementById('score-value');
    const indicatorsSection = document.getElementById('indicators-section');
    const indicatorsList = document.getElementById('indicators-list');
    const scanBtn = document.getElementById('scan-btn');
    const whitelistBtn = document.getElementById('whitelist-btn');
    const reportBtn = document.getElementById('report-btn');
    const totalScans = document.getElementById('total-scans');
    const threatsBlocked = document.getElementById('threats-blocked');
    const whitelistCount = document.getElementById('whitelist-count');
    const protectionToggle = document.getElementById('protection-toggle');
    const notificationsToggle = document.getElementById('notifications-toggle');
    const historyLink = document.getElementById('history-link');
    const settingsLink = document.getElementById('settings-link');
    
    // Initialize
    await loadSettings();
    await checkCurrentTab();
    await loadStats();
    
    // Event Listeners
    scanBtn.addEventListener('click', scanCurrentPage);
    whitelistBtn.addEventListener('click', addCurrentToWhitelist);
    reportBtn.addEventListener('click', reportSite);
    protectionToggle.addEventListener('change', toggleProtection);
    notificationsToggle.addEventListener('change', toggleNotifications);
    historyLink.addEventListener('click', openHistory);
    settingsLink.addEventListener('click', openSettings);
    
    // Load settings
    async function loadSettings() {
        const settings = await chrome.storage.sync.get([
            'enableRealTimeProtection',
            'enableNotifications'
        ]);
        
        protectionToggle.checked = settings.enableRealTimeProtection !== false;
        notificationsToggle.checked = settings.enableNotifications !== false;
    }
    
    // Check current tab
    async function checkCurrentTab() {
        try {
            const response = await sendMessage({ action: 'checkCurrentTab' });
            updateUI(response);
        } catch (error) {
            console.error('Error checking tab:', error);
            statusIcon.textContent = '❓';
            statusText.textContent = 'Unable to analyze';
        }
    }
    
    // Update UI with scan results
    function updateUI(result) {
        if (!result || result.error) {
            statusIcon.textContent = '🔒';
            statusText.textContent = 'Protected page';
            currentUrl.textContent = 'Chrome internal page';
            return;
        }
        
        // Get and display current URL
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                const url = new URL(tabs[0].url);
                currentUrl.textContent = url.hostname;
            }
        });
        
        // Update status based on result
        if (result.isPhishing) {
            statusIcon.textContent = '🚨';
            statusText.textContent = 'Dangerous Site!';
            document.getElementById('site-status').classList.add('danger');
        } else if (result.score >= 25) {
            statusIcon.textContent = '⚠️';
            statusText.textContent = 'Suspicious Site';
            document.getElementById('site-status').classList.add('warning');
        } else {
            statusIcon.textContent = '✅';
            statusText.textContent = 'Site Looks Safe';
            document.getElementById('site-status').classList.add('safe');
        }
        
        // Update score
        const score = result.score || 0;
        scoreValue.textContent = score;
        scoreFill.style.width = `${Math.min(score, 100)}%`;
        
        if (score >= 70) {
            scoreFill.style.backgroundColor = '#dc3545';
        } else if (score >= 40) {
            scoreFill.style.backgroundColor = '#ffc107';
        } else {
            scoreFill.style.backgroundColor = '#28a745';
        }
        
        // Show indicators if any
        if (result.indicators && result.indicators.length > 0) {
            indicatorsSection.classList.remove('hidden');
            indicatorsList.innerHTML = result.indicators
                .map(ind => `<li>${escapeHtml(ind)}</li>`)
                .join('');
        } else {
            indicatorsSection.classList.add('hidden');
        }
    }
    
    // Load statistics
    async function loadStats() {
        try {
            const status = await sendMessage({ action: 'getStatus' });
            const history = await sendMessage({ action: 'getScanHistory' });
            
            // Count today's scans
            const today = new Date().setHours(0, 0, 0, 0);
            const todayScans = history.filter(item => item.timestamp >= today).length;
            const blocked = history.filter(item => item.result && item.result.isPhishing).length;
            
            totalScans.textContent = todayScans;
            threatsBlocked.textContent = blocked;
            whitelistCount.textContent = status.whitelistCount || 0;
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }
    
    // Scan current page
    async function scanCurrentPage() {
        scanBtn.disabled = true;
        scanBtn.innerHTML = '<span>🔄</span> Scanning...';
        
        try {
            const response = await sendMessage({ action: 'checkCurrentTab' });
            updateUI(response);
            await loadStats();
        } catch (error) {
            console.error('Scan error:', error);
        } finally {
            scanBtn.disabled = false;
            scanBtn.innerHTML = '<span>🔍</span> Scan Page';
        }
    }
    
    // Add current site to whitelist
    async function addCurrentToWhitelist() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (tab && tab.url) {
            try {
                const response = await sendMessage({
                    action: 'addToWhitelist',
                    url: tab.url
                });
                
                if (response.success) {
                    showNotification('Site added to trusted list!', 'success');
                    await loadStats();
                    await checkCurrentTab();
                } else {
                    showNotification('Failed to add site', 'error');
                }
            } catch (error) {
                showNotification('Error: ' + error.message, 'error');
            }
        }
    }
    
    // Report suspicious site
    async function reportSite() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (tab && tab.url) {
            // Open report form or send to API
            const reportUrl = `https://safebrowsing.google.com/safebrowsing/report_phish/?url=${encodeURIComponent(tab.url)}`;
            chrome.tabs.create({ url: reportUrl });
        }
    }
    
    // Toggle protection
    async function toggleProtection() {
        await chrome.storage.sync.set({
            enableRealTimeProtection: protectionToggle.checked
        });
        showNotification(
            protectionToggle.checked ? 'Protection enabled' : 'Protection disabled',
            protectionToggle.checked ? 'success' : 'warning'
        );
    }
    
    // Toggle notifications
    async function toggleNotifications() {
        await chrome.storage.sync.set({
            enableNotifications: notificationsToggle.checked
        });
    }
    
    // Open history
    function openHistory(e) {
        e.preventDefault();
        chrome.tabs.create({ url: chrome.runtime.getURL('src/history/history.html') });
    }
    
    // Open settings
    function openSettings(e) {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
    }
    
    // Send message to background script
    function sendMessage(message) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
    }
    
    // Show notification in popup
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `popup-notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }
    
    // Escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});