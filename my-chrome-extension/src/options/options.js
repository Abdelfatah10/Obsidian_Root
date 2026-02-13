// Phishing Shield - Options Script

document.addEventListener('DOMContentLoaded', async function() {
    // Elements
    const apiUrl = document.getElementById('apiUrl');
    const apiKey = document.getElementById('apiKey');
    const enableRealTimeProtection = document.getElementById('enableRealTimeProtection');
    const enableNotifications = document.getElementById('enableNotifications');
    const highlightLinks = document.getElementById('highlightLinks');
    const blockDangerousSites = document.getElementById('blockDangerousSites');
    const sensitivityLevel = document.getElementById('sensitivityLevel');
    const minimumScore = document.getElementById('minimumScore');
    const scoreDisplay = document.getElementById('scoreDisplay');
    const newWhitelistItem = document.getElementById('newWhitelistItem');
    const addWhitelistBtn = document.getElementById('addWhitelistBtn');
    const whitelistItems = document.getElementById('whitelistItems');
    const clearHistory = document.getElementById('clearHistory');
    const clearCache = document.getElementById('clearCache');
    const exportData = document.getElementById('exportData');
    const importData = document.getElementById('importData');
    const importFile = document.getElementById('importFile');
    const saveBtn = document.getElementById('saveBtn');
    const saveStatus = document.getElementById('saveStatus');
    const resetDefaults = document.getElementById('resetDefaults');
    
    // Default settings
    const defaultSettings = {
        apiUrl: 'https://obsidian-production-5918.up.railway.app/api',
        apiKey: '',
        enableRealTimeProtection: true,
        enableNotifications: true,
        highlightLinks: false,
        blockDangerousSites: true,
        sensitivityLevel: 'medium',
        minimumScore: 50,
        whitelist: []
    };
    
    // Load settings
    await loadSettings();
    
    // Event listeners
    minimumScore.addEventListener('input', () => {
        scoreDisplay.textContent = minimumScore.value;
    });
    
    addWhitelistBtn.addEventListener('click', addWhitelistEntry);
    newWhitelistItem.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addWhitelistEntry();
    });
    
    clearHistory.addEventListener('click', handleClearHistory);
    clearCache.addEventListener('click', handleClearCache);
    exportData.addEventListener('click', handleExport);
    importData.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', handleImport);
    saveBtn.addEventListener('click', saveSettings);
    resetDefaults.addEventListener('click', handleResetDefaults);
    
    // Load settings from storage
    async function loadSettings() {
        const settings = await chrome.storage.sync.get(Object.keys(defaultSettings));
        
        apiUrl.value = settings.apiUrl || defaultSettings.apiUrl;
        apiKey.value = settings.apiKey || '';
        enableRealTimeProtection.checked = settings.enableRealTimeProtection !== false;
        enableNotifications.checked = settings.enableNotifications !== false;
        highlightLinks.checked = settings.highlightLinks || false;
        blockDangerousSites.checked = settings.blockDangerousSites !== false;
        sensitivityLevel.value = settings.sensitivityLevel || 'medium';
        minimumScore.value = settings.minimumScore || 50;
        scoreDisplay.textContent = minimumScore.value;
        
        renderWhitelist(settings.whitelist || []);
    }
    
    // Save settings to storage
    async function saveSettings() {
        const settings = {
            apiUrl: apiUrl.value.trim() || defaultSettings.apiUrl,
            apiKey: apiKey.value.trim(),
            enableRealTimeProtection: enableRealTimeProtection.checked,
            enableNotifications: enableNotifications.checked,
            highlightLinks: highlightLinks.checked,
            blockDangerousSites: blockDangerousSites.checked,
            sensitivityLevel: sensitivityLevel.value,
            minimumScore: parseInt(minimumScore.value)
        };
        
        try {
            await chrome.storage.sync.set(settings);
            showSaveStatus('Settings saved successfully!', 'success');
        } catch (error) {
            showSaveStatus('Error saving settings: ' + error.message, 'error');
        }
    }
    
    // Render whitelist
    function renderWhitelist(whitelist) {
        whitelistItems.innerHTML = whitelist.map((domain, index) => `
            <li class="whitelist-item">
                <span class="domain">${escapeHtml(domain)}</span>
                <button class="btn-remove" data-index="${index}" title="Remove">×</button>
            </li>
        `).join('');
        
        // Add remove listeners
        whitelistItems.querySelectorAll('.btn-remove').forEach(btn => {
            btn.addEventListener('click', () => removeWhitelistEntry(parseInt(btn.dataset.index)));
        });
    }
    
    // Add whitelist entry
    async function addWhitelistEntry() {
        const domain = newWhitelistItem.value.trim().toLowerCase();
        
        if (!domain) return;
        
        // Validate domain format
        if (!/^[a-z0-9]+([-\.][a-z0-9]+)*\.[a-z]{2,}$/i.test(domain)) {
            showSaveStatus('Invalid domain format', 'error');
            return;
        }
        
        const settings = await chrome.storage.sync.get(['whitelist']);
        const whitelist = settings.whitelist || [];
        
        if (whitelist.includes(domain)) {
            showSaveStatus('Domain already in whitelist', 'error');
            return;
        }
        
        whitelist.push(domain);
        await chrome.storage.sync.set({ whitelist });
        
        newWhitelistItem.value = '';
        renderWhitelist(whitelist);
        showSaveStatus('Domain added to whitelist', 'success');
    }
    
    // Remove whitelist entry
    async function removeWhitelistEntry(index) {
        const settings = await chrome.storage.sync.get(['whitelist']);
        const whitelist = settings.whitelist || [];
        
        whitelist.splice(index, 1);
        await chrome.storage.sync.set({ whitelist });
        
        renderWhitelist(whitelist);
        showSaveStatus('Domain removed from whitelist', 'success');
    }
    
    // Clear scan history
    async function handleClearHistory() {
        if (confirm('Are you sure you want to clear all scan history?')) {
            await chrome.storage.sync.set({ scanHistory: [] });
            showSaveStatus('Scan history cleared', 'success');
        }
    }
    
    // Clear cache
    async function handleClearCache() {
        if (confirm('Are you sure you want to clear the URL cache?')) {
            await chrome.runtime.sendMessage({ action: 'clearCache' });
            showSaveStatus('Cache cleared', 'success');
        }
    }
    
    // Export settings
    async function handleExport() {
        const settings = await chrome.storage.sync.get(null);
        const dataStr = JSON.stringify(settings, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'phishing-shield-settings.json';
        a.click();
        
        URL.revokeObjectURL(url);
        showSaveStatus('Settings exported', 'success');
    }
    
    // Import settings
    async function handleImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            const settings = JSON.parse(text);
            
            // Validate imported data
            if (typeof settings !== 'object') {
                throw new Error('Invalid settings file');
            }
            
            await chrome.storage.sync.set(settings);
            await loadSettings();
            showSaveStatus('Settings imported successfully', 'success');
        } catch (error) {
            showSaveStatus('Error importing settings: ' + error.message, 'error');
        }
        
        // Reset file input
        event.target.value = '';
    }
    
    // Reset to defaults
    async function handleResetDefaults(e) {
        e.preventDefault();
        
        if (confirm('Are you sure you want to reset all settings to defaults?')) {
            await chrome.storage.sync.set(defaultSettings);
            await loadSettings();
            showSaveStatus('Settings reset to defaults', 'success');
        }
    }
    
    // Show save status
    function showSaveStatus(message, type) {
        saveStatus.textContent = message;
        saveStatus.className = `save-status ${type}`;
        
        setTimeout(() => {
            saveStatus.textContent = '';
            saveStatus.className = 'save-status';
        }, 3000);
    }
    
    // Escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});