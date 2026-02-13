// Phishing Shield - Popup Script

document.addEventListener('DOMContentLoaded', async function() {
    // Elements
    const statusIcon = document.getElementById('status-icon');
    const statusText = document.getElementById('status-text');
    const threatLevel = document.getElementById('threat-level');
    const currentUrl = document.getElementById('current-url');
    const scoreFill = document.getElementById('score-fill');
    const scoreValue = document.getElementById('score-value');
    const analysisType = document.getElementById('analysis-type');
    const indicatorsSection = document.getElementById('indicators-section');
    const indicatorsList = document.getElementById('indicators-list');
    const indicatorCount = document.getElementById('indicator-count');
    const aiSection = document.getElementById('ai-section');
    const aiAnalysis = document.getElementById('ai-analysis');
    const scanBtn = document.getElementById('scan-btn');
    const whitelistBtn = document.getElementById('whitelist-btn');
    const reportBtn = document.getElementById('report-btn');
    const totalScans = document.getElementById('total-scans');
    const threatsBlocked = document.getElementById('threats-blocked');
    const whitelistCount = document.getElementById('whitelist-count');
    const cacheCount = document.getElementById('cache-count');
    const protectionToggle = document.getElementById('protection-toggle');
    const notificationsToggle = document.getElementById('notifications-toggle');
    const historyLink = document.getElementById('history-link');
    const settingsLink = document.getElementById('settings-link');
    const apiStatus = document.getElementById('api-status');
    
    // Initialize
    await loadSettings();
    await checkApiStatus();
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
    
    // Check API status
    async function checkApiStatus() {
        try {
            const response = await sendMessage({ action: 'testApiConnection' });
            if (response && response.connected) {
                apiStatus.classList.add('connected');
                apiStatus.title = 'API Connected';
            } else {
                apiStatus.classList.add('disconnected');
                apiStatus.title = 'API Offline - Using local analysis';
            }
        } catch (error) {
            apiStatus.classList.add('disconnected');
            apiStatus.title = 'API Offline - Using local analysis';
        }
    }
    
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
        // Reset classes
        const siteStatus = document.getElementById('site-status');
        siteStatus.classList.remove('safe', 'warning', 'danger', 'protected', 'trusted');
        
        if (!result || result.error) {
            statusIcon.textContent = '🔒';
            statusText.textContent = 'Protected page';
            threatLevel.textContent = '';
            currentUrl.textContent = 'Chrome internal page';
            siteStatus.classList.add('protected');
            analysisType.textContent = '';
            return;
        }
        
        // Get and display current URL
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                try {
                    const url = new URL(tabs[0].url);
                    currentUrl.textContent = url.hostname;
                } catch (e) {
                    currentUrl.textContent = 'Unknown';
                }
            }
        });
        
        // Update status based on result
        const score = result.score || 0;
        
        if (result.whitelisted) {
            statusIcon.textContent = '⭐';
            statusText.textContent = 'Trusted Site';
            threatLevel.textContent = 'Whitelisted';
            threatLevel.className = 'threat-level safe';
            siteStatus.classList.add('trusted');
        } else if (result.isPhishing || score >= 70) {
            statusIcon.textContent = '🚨';
            statusText.textContent = 'DANGER!';
            threatLevel.textContent = 'High Risk';
            threatLevel.className = 'threat-level danger';
            siteStatus.classList.add('danger');
        } else if (score >= 40) {
            statusIcon.textContent = '⚠️';
            statusText.textContent = 'Suspicious';
            threatLevel.textContent = 'Medium Risk';
            threatLevel.className = 'threat-level warning';
            siteStatus.classList.add('warning');
        } else if (score >= 20) {
            statusIcon.textContent = '🤔';
            statusText.textContent = 'Caution';
            threatLevel.textContent = 'Low Risk';
            threatLevel.className = 'threat-level caution';
            siteStatus.classList.add('warning');
        } else {
            statusIcon.textContent = '✅';
            statusText.textContent = 'Safe';
            threatLevel.textContent = 'No Threats';
            threatLevel.className = 'threat-level safe';
            siteStatus.classList.add('safe');
        }
        
        // Update score
        scoreValue.textContent = `${score}%`;
        scoreFill.style.width = `${Math.min(score, 100)}%`;
        
        if (score >= 70) {
            scoreFill.className = 'score-fill danger';
        } else if (score >= 40) {
            scoreFill.className = 'score-fill warning';
        } else if (score >= 20) {
            scoreFill.className = 'score-fill caution';
        } else {
            scoreFill.className = 'score-fill safe';
        }
        
        // Show analysis type
        if (result.analysisType) {
            analysisType.textContent = result.analysisType === 'api' ? '🌐 API Analysis' : '💻 Local Analysis';
            analysisType.className = 'analysis-type ' + result.analysisType;
        } else {
            analysisType.textContent = '';
        }
        
        // Show indicators if any
        if (result.indicators && result.indicators.length > 0) {
            indicatorsSection.classList.remove('hidden');
            indicatorCount.textContent = result.indicators.length;
            indicatorsList.innerHTML = result.indicators
                .slice(0, 5) // Show max 5 indicators
                .map(ind => `<li>${escapeHtml(ind)}</li>`)
                .join('');
            
            if (result.indicators.length > 5) {
                indicatorsList.innerHTML += `<li class="more">+${result.indicators.length - 5} more...</li>`;
            }
        } else {
            indicatorsSection.classList.add('hidden');
        }
        
        // Show AI analysis if available
        if (result.aiAnalysis) {
            aiSection.classList.remove('hidden');
            aiAnalysis.textContent = result.aiAnalysis;
        } else {
            aiSection.classList.add('hidden');
        }
    }
    
    // Load statistics
    async function loadStats() {
        try {
            const status = await sendMessage({ action: 'getStatus' });
            
            if (status) {
                totalScans.textContent = status.todayScans || 0;
                threatsBlocked.textContent = status.todayThreats || 0;
                whitelistCount.textContent = status.whitelistCount || 0;
                cacheCount.textContent = status.cacheSize || 0;
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }
    
    // Scan current page
    async function scanCurrentPage() {
        scanBtn.disabled = true;
        scanBtn.innerHTML = '<span>🔄</span> Scanning...';
        scanBtn.classList.add('scanning');
        
        // Show scanning state
        statusIcon.textContent = '🔄';
        statusText.textContent = 'Scanning...';
        
        try {
            const response = await sendMessage({ action: 'checkCurrentTab' });
            updateUI(response);
            await loadStats();
            showNotification('Scan complete!', 'success');
        } catch (error) {
            console.error('Scan error:', error);
            showNotification('Scan failed', 'error');
        } finally {
            scanBtn.disabled = false;
            scanBtn.innerHTML = '<span>🔍</span> Scan Now';
            scanBtn.classList.remove('scanning');
        }
    }
    
    // Add current site to whitelist
    async function addCurrentToWhitelist() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (tab && tab.url) {
            whitelistBtn.disabled = true;
            
            try {
                const response = await sendMessage({
                    action: 'addToWhitelist',
                    url: tab.url
                });
                
                if (response && response.success) {
                    showNotification(`${response.hostname} added to trusted list!`, 'success');
                    await loadStats();
                    await checkCurrentTab();
                } else {
                    showNotification('Failed to add site', 'error');
                }
            } catch (error) {
                showNotification('Error: ' + error.message, 'error');
            } finally {
                whitelistBtn.disabled = false;
            }
        }
    }
    
    // Report suspicious site
    async function reportSite() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (tab && tab.url) {
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
        showNotification(
            notificationsToggle.checked ? 'Notifications enabled' : 'Notifications disabled',
            'info'
        );
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