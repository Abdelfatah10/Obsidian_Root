// Phishing Shield - Background Service Worker
// Professional phishing detection with real-time protection

const DEFAULT_API_URL = 'http://localhost:3000/api';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const API_TIMEOUT = 10000; // 10 seconds

// URL analysis cache
const urlCache = new Map();

// Pending analysis tracker
const pendingAnalysis = new Map();

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
    console.log('Phishing Shield installed');
    
    // Set default settings
    const settings = await chrome.storage.sync.get(['apiUrl', 'enableRealTimeProtection', 'enableNotifications']);
    
    if (!settings.apiUrl) {
        await chrome.storage.sync.set({
            apiUrl: DEFAULT_API_URL,
            enableRealTimeProtection: true,
            enableNotifications: true,
            highlightLinks: true,
            whitelist: [],
            scanHistory: []
        });
    }
    
    // Create context menu
    try {
        chrome.contextMenus.removeAll();
        chrome.contextMenus.create({
            id: 'scanLink',
            title: '🔍 Scan link for phishing',
            contexts: ['link']
        });
        
        chrome.contextMenus.create({
            id: 'scanPage',
            title: '🛡️ Scan this page',
            contexts: ['page']
        });
    } catch (e) {
        console.error('Context menu error:', e);
    }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'scanLink') {
        const result = await analyzeUrl(info.linkUrl);
        showNotification(result, info.linkUrl);
    } else if (info.menuItemId === 'scanPage') {
        const result = await analyzeUrl(tab.url);
        showNotification(result, tab.url);
        updateBadge(tab.id, result);
    }
});

// Listen for tab updates - REAL-TIME PROTECTION
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // Trigger on loading state to show scanning badge early
    if (changeInfo.status === 'loading' && tab.url) {
        const settings = await chrome.storage.sync.get(['enableRealTimeProtection']);
        
        if (settings.enableRealTimeProtection && isValidUrl(tab.url)) {
            // Show scanning indicator
            updateBadge(tabId, { scanning: true });
        }
    }
    
    // Perform analysis when page completes loading
    if (changeInfo.status === 'complete' && tab.url) {
        const settings = await chrome.storage.sync.get(['enableRealTimeProtection']);
        
        if (settings.enableRealTimeProtection && isValidUrl(tab.url)) {
            try {
                const result = await analyzeUrl(tab.url);
                updateBadge(tabId, result);
                
                // Send result to content script
                try {
                    await chrome.tabs.sendMessage(tabId, {
                        action: 'analysisComplete',
                        data: result
                    });
                } catch (e) {
                    // Content script might not be ready
                }
                
                // Show warning for dangerous sites
                if (result.isPhishing) {
                    try {
                        await chrome.tabs.sendMessage(tabId, {
                            action: 'showWarning',
                            data: result
                        });
                    } catch (e) {
                        // Fallback to notification
                        showNotification(result, tab.url);
                    }
                }
            } catch (error) {
                console.error('Analysis error:', error);
                updateBadge(tabId, { error: true });
            }
        }
    }
});

// Listen for navigation events for faster detection
chrome.webNavigation.onCommitted.addListener(async (details) => {
    if (details.frameId !== 0) return; // Only main frame
    
    const settings = await chrome.storage.sync.get(['enableRealTimeProtection']);
    
    if (settings.enableRealTimeProtection && isValidUrl(details.url)) {
        updateBadge(details.tabId, { scanning: true });
    }
});

// Handle tab activation
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        
        if (tab.url && isValidUrl(tab.url)) {
            const cached = urlCache.get(tab.url);
            if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
                updateBadge(activeInfo.tabId, cached.result);
            }
        }
    } catch (e) {
        // Tab might not exist
    }
});

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    handleMessage(request, sender).then(sendResponse);
    return true;
});

async function handleMessage(request, sender) {
    switch (request.action) {
        case 'analyzeUrl':
            return await analyzeUrl(request.url);
        
        case 'analyzeEmail':
            return await analyzeEmail(request.emailContent);
        
        case 'getStatus':
            return await getExtensionStatus();
        
        case 'getScanHistory':
            return await getScanHistory();
        
        case 'clearCache':
            urlCache.clear();
            return { success: true };
        
        case 'clearHistory':
            await chrome.storage.sync.set({ scanHistory: [] });
            return { success: true };
        
        case 'addToWhitelist':
            return await addToWhitelist(request.url);
        
        case 'removeFromWhitelist':
            return await removeFromWhitelist(request.hostname);
        
        case 'getWhitelist':
            const settings = await chrome.storage.sync.get(['whitelist']);
            return settings.whitelist || [];
        
        case 'checkCurrentTab':
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && tab.url) {
                if (!isValidUrl(tab.url)) {
                    return { isProtected: true, reason: 'Chrome internal page' };
                }
                const result = await analyzeUrl(tab.url);
                updateBadge(tab.id, result);
                return result;
            }
            return { error: 'No active tab' };
        
        case 'forceRescan':
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (activeTab && activeTab.url) {
                urlCache.delete(activeTab.url);
                const result = await analyzeUrl(activeTab.url);
                updateBadge(activeTab.id, result);
                return result;
            }
            return { error: 'No active tab' };
        
        case 'testConnection':
            return await testApiConnection();
        
        default:
            return { error: 'Unknown action' };
    }
}

// Check if URL should be analyzed
function isValidUrl(url) {
    if (!url) return false;
    
    const invalidPrefixes = [
        'chrome://',
        'chrome-extension://',
        'edge://',
        'about:',
        'file://',
        'devtools://',
        'view-source:',
        'data:'
    ];
    
    return !invalidPrefixes.some(prefix => url.startsWith(prefix));
}

// Analyze URL for phishing
async function analyzeUrl(url) {
    if (!url || !isValidUrl(url)) {
        return { isPhishing: false, score: 0, reason: 'Internal URL', isProtected: true };
    }
    
    // Check cache
    const cached = urlCache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.result;
    }
    
    // Check if already analyzing this URL
    if (pendingAnalysis.has(url)) {
        return await pendingAnalysis.get(url);
    }
    
    // Start analysis
    const analysisPromise = performAnalysis(url);
    pendingAnalysis.set(url, analysisPromise);
    
    try {
        const result = await analysisPromise;
        pendingAnalysis.delete(url);
        return result;
    } catch (error) {
        pendingAnalysis.delete(url);
        throw error;
    }
}

async function performAnalysis(url) {
    // Check whitelist
    const settings = await chrome.storage.sync.get(['whitelist', 'apiUrl']);
    const whitelist = settings.whitelist || [];
    
    try {
        const urlObj = new URL(url);
        if (whitelist.includes(urlObj.hostname)) {
            const result = { isPhishing: false, score: 0, reason: 'Trusted site (whitelisted)', whitelisted: true };
            urlCache.set(url, { result, timestamp: Date.now() });
            return result;
        }
    } catch (e) {
        // Invalid URL
    }
    
    // Perform local analysis first
    const localResult = performLocalAnalysis(url);
    
    // Try API analysis
    try {
        const apiResult = await callPhishingAPI(url, settings.apiUrl || DEFAULT_API_URL);
        const result = mergeResults(localResult, apiResult);
        
        // Cache the result
        urlCache.set(url, { result, timestamp: Date.now() });
        
        // Save to history
        await saveScanHistory(url, result);
        
        return result;
    } catch (error) {
        console.error('API error:', error);
        // Fall back to local analysis only
        localResult.apiError = true;
        urlCache.set(url, { result: localResult, timestamp: Date.now() });
        await saveScanHistory(url, localResult);
        return localResult;
    }
}

// Local URL analysis (heuristics)
function performLocalAnalysis(url) {
    const result = {
        isPhishing: false,
        score: 0,
        indicators: [],
        reason: '',
        analysisType: 'local'
    };
    
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        const path = urlObj.pathname.toLowerCase();
        const fullUrl = url.toLowerCase();
        
        // Check for IP address instead of domain
        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
            result.score += 30;
            result.indicators.push('IP address used instead of domain name');
        }
        
        // Check for suspicious TLDs
        const suspiciousTLDs = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.work', '.click', '.loan', '.download'];
        if (suspiciousTLDs.some(tld => hostname.endsWith(tld))) {
            result.score += 20;
            result.indicators.push('Suspicious top-level domain');
        }
        
        // Check for excessive subdomains
        const subdomainCount = hostname.split('.').length - 2;
        if (subdomainCount > 3) {
            result.score += 15;
            result.indicators.push('Excessive number of subdomains');
        }
        
        // Check for brand impersonation
        const brands = [
            { name: 'paypal', domains: ['paypal.com'] },
            { name: 'amazon', domains: ['amazon.com', 'amazon.co.uk', 'amazon.de'] },
            { name: 'google', domains: ['google.com', 'google.co.uk', 'googleapis.com'] },
            { name: 'microsoft', domains: ['microsoft.com', 'live.com', 'outlook.com'] },
            { name: 'apple', domains: ['apple.com', 'icloud.com'] },
            { name: 'facebook', domains: ['facebook.com', 'fb.com'] },
            { name: 'netflix', domains: ['netflix.com'] },
            { name: 'instagram', domains: ['instagram.com'] },
            { name: 'twitter', domains: ['twitter.com', 'x.com'] },
            { name: 'linkedin', domains: ['linkedin.com'] },
            { name: 'bank', domains: [] },
            { name: 'secure', domains: [] },
            { name: 'login', domains: [] },
            { name: 'account', domains: [] },
            { name: 'verify', domains: [] }
        ];
        
        for (const brand of brands) {
            const isLegitDomain = brand.domains.some(d => hostname === d || hostname.endsWith('.' + d));
            if (hostname.includes(brand.name) && !isLegitDomain) {
                result.score += 35;
                result.indicators.push(`Possible ${brand.name} impersonation`);
                break;
            }
        }
        
        // Check for suspicious keywords in path
        const suspiciousKeywords = ['login', 'signin', 'verify', 'secure', 'account', 'update', 'confirm', 'banking', 'password', 'credential'];
        const keywordsInPath = suspiciousKeywords.filter(kw => path.includes(kw));
        if (keywordsInPath.length >= 2) {
            result.score += 15;
            result.indicators.push('Multiple sensitive keywords in URL');
        }
        
        // Check for unusual port
        if (urlObj.port && !['80', '443', ''].includes(urlObj.port)) {
            result.score += 10;
            result.indicators.push('Non-standard port number');
        }
        
        // Check URL length
        if (url.length > 100) {
            result.score += 10;
            result.indicators.push('Unusually long URL');
        }
        
        // Check for @ symbol in URL
        if (fullUrl.includes('@') && !fullUrl.includes('mailto:')) {
            result.score += 25;
            result.indicators.push('URL contains @ symbol');
        }
        
        // Check for double slashes in path
        if (path.includes('//')) {
            result.score += 10;
            result.indicators.push('Unusual URL structure');
        }
        
        // Check for hexadecimal characters
        const hexMatches = url.match(/%[0-9a-fA-F]{2}/g);
        if (hexMatches && hexMatches.length > 5) {
            result.score += 15;
            result.indicators.push('Excessive URL encoding');
        }
        
        // Check for non-HTTPS
        if (urlObj.protocol !== 'https:') {
            result.score += 10;
            result.indicators.push('Not using secure HTTPS connection');
        }
        
        // Check for homograph attacks (mixed scripts)
        if (/[^\x00-\x7F]/.test(hostname)) {
            result.score += 25;
            result.indicators.push('Non-ASCII characters in domain (possible homograph attack)');
        }
        
        // Determine threat level
        result.isPhishing = result.score >= 50;
        
        if (result.score >= 70) {
            result.reason = 'High risk - Multiple phishing indicators detected';
            result.threatLevel = 'high';
        } else if (result.score >= 50) {
            result.reason = 'Medium risk - Suspicious characteristics found';
            result.threatLevel = 'medium';
        } else if (result.score >= 25) {
            result.reason = 'Low risk - Some suspicious indicators';
            result.threatLevel = 'low';
        } else {
            result.reason = 'Site appears safe';
            result.threatLevel = 'safe';
        }
        
    } catch (error) {
        console.error('Local analysis error:', error);
    }
    
    return result;
}

// Call backend API for analysis
async function callPhishingAPI(url, apiUrl) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
    
    try {
        const response = await fetch(`${apiUrl}/phishing/v1/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        data.analysisType = 'ai';
        return data;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

// Test API connection
async function testApiConnection() {
    const settings = await chrome.storage.sync.get(['apiUrl']);
    const apiUrl = settings.apiUrl || DEFAULT_API_URL;
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${apiUrl.replace('/api', '')}/health`, {
            method: 'GET',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            return { connected: true, apiUrl };
        }
        return { connected: false, error: `Server returned ${response.status}` };
    } catch (error) {
        return { connected: false, error: error.message };
    }
}

// Analyze email content for phishing
async function analyzeEmail(emailContent) {
    const settings = await chrome.storage.sync.get(['apiUrl']);
    
    try {
        const response = await fetch(`${settings.apiUrl}/phishing/v1/analyze-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content: emailContent })
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Email analysis error:', error);
        return performLocalEmailAnalysis(emailContent);
    }
}

// Local email analysis
function performLocalEmailAnalysis(content) {
    const result = {
        isPhishing: false,
        score: 0,
        indicators: []
    };
    
    const lowerContent = content.toLowerCase();
    
    // Check for urgency keywords
    const urgencyWords = ['urgent', 'immediately', 'suspended', 'locked', 'verify now', 'act now', 'expire', 'limited time', '24 hours', 'account will be'];
    urgencyWords.forEach(word => {
        if (lowerContent.includes(word)) {
            result.score += 10;
            result.indicators.push(`Urgency tactic: "${word}"`);
        }
    });
    
    // Check for suspicious phrases
    const suspiciousPhrases = [
        'verify your account',
        'confirm your identity',
        'update your information',
        'click here to',
        'your account has been',
        'unusual activity',
        'security alert',
        'we noticed',
        'unauthorized access',
        'confirm your payment'
    ];
    
    suspiciousPhrases.forEach(phrase => {
        if (lowerContent.includes(phrase)) {
            result.score += 15;
            result.indicators.push(`Suspicious phrase: "${phrase}"`);
        }
    });
    
    // Extract and analyze URLs
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
    const urls = content.match(urlRegex) || [];
    
    urls.forEach(url => {
        const urlAnalysis = performLocalAnalysis(url);
        if (urlAnalysis.score >= 30) {
            result.score += 20;
            result.indicators.push(`Suspicious link detected`);
        }
    });
    
    result.isPhishing = result.score >= 40;
    result.reason = result.isPhishing ? 'Email appears to be a phishing attempt' : 'Email appears safe';
    
    return result;
}

// Merge local and API results
function mergeResults(localResult, apiResult) {
    if (!apiResult) return localResult;
    
    const combinedScore = Math.max(localResult.score, apiResult.score || 0);
    const combinedIndicators = [...new Set([...localResult.indicators, ...(apiResult.indicators || [])])];
    
    return {
        isPhishing: combinedScore >= 50 || apiResult.isPhishing,
        score: combinedScore,
        indicators: combinedIndicators,
        reason: apiResult.reason || localResult.reason,
        threatLevel: combinedScore >= 70 ? 'high' : combinedScore >= 50 ? 'medium' : combinedScore >= 25 ? 'low' : 'safe',
        aiAnalysis: apiResult.aiAnalysis || null,
        analysisType: apiResult.analysisType || localResult.analysisType
    };
}

// Update extension badge
function updateBadge(tabId, result) {
    if (!tabId) return;
    
    if (result.scanning) {
        chrome.action.setBadgeText({ text: '...', tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#6c757d', tabId });
        chrome.action.setTitle({ title: 'Phishing Shield - Scanning...', tabId });
        return;
    }
    
    if (result.error) {
        chrome.action.setBadgeText({ text: '!', tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#ffc107', tabId });
        chrome.action.setTitle({ title: 'Phishing Shield - Analysis error', tabId });
        return;
    }
    
    if (result.isProtected) {
        chrome.action.setBadgeText({ text: '', tabId });
        chrome.action.setTitle({ title: 'Phishing Shield - Protected page', tabId });
        return;
    }
    
    if (result.whitelisted) {
        chrome.action.setBadgeText({ text: '★', tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#17a2b8', tabId });
        chrome.action.setTitle({ title: 'Phishing Shield - Trusted site', tabId });
        return;
    }
    
    if (result.isPhishing || result.score >= 70) {
        chrome.action.setBadgeText({ text: '!', tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#dc3545', tabId });
        chrome.action.setTitle({ title: `Phishing Shield - DANGER! Risk: ${result.score}%`, tabId });
    } else if (result.score >= 40) {
        chrome.action.setBadgeText({ text: '?', tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#fd7e14', tabId });
        chrome.action.setTitle({ title: `Phishing Shield - Warning. Risk: ${result.score}%`, tabId });
    } else if (result.score >= 20) {
        chrome.action.setBadgeText({ text: '~', tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#ffc107', tabId });
        chrome.action.setTitle({ title: `Phishing Shield - Caution. Risk: ${result.score}%`, tabId });
    } else {
        chrome.action.setBadgeText({ text: '✓', tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#28a745', tabId });
        chrome.action.setTitle({ title: `Phishing Shield - Safe. Risk: ${result.score}%`, tabId });
    }
}

// Show notification
async function showNotification(result, url) {
    const settings = await chrome.storage.sync.get(['enableNotifications']);
    
    if (!settings.enableNotifications) return;
    
    let title, message, iconUrl;
    
    if (result.isPhishing || result.score >= 70) {
        title = '🚨 Phishing Alert!';
        message = `High risk detected on this site. Score: ${result.score}%`;
        iconUrl = 'icons/icon128.png';
    } else if (result.score >= 40) {
        title = '⚠️ Suspicious Site';
        message = `This site has suspicious indicators. Score: ${result.score}%`;
        iconUrl = 'icons/icon128.png';
    } else {
        return; // Don't notify for safe sites
    }
    
    try {
        chrome.notifications.create({
            type: 'basic',
            iconUrl,
            title,
            message,
            priority: 2,
            requireInteraction: result.isPhishing
        });
    } catch (e) {
        console.error('Notification error:', e);
    }
}

// Save scan to history
async function saveScanHistory(url, result) {
    try {
        const settings = await chrome.storage.sync.get(['scanHistory']);
        const history = settings.scanHistory || [];
        
        // Don't duplicate recent entries
        const recentIndex = history.findIndex(h => h.url === url && Date.now() - h.timestamp < 60000);
        if (recentIndex >= 0) {
            history[recentIndex] = { url, result, timestamp: Date.now() };
        } else {
            history.unshift({ url, result, timestamp: Date.now() });
        }
        
        // Keep only last 200 entries
        if (history.length > 200) {
            history.splice(200);
        }
        
        await chrome.storage.sync.set({ scanHistory: history });
    } catch (e) {
        console.error('Error saving history:', e);
    }
}

// Get scan history
async function getScanHistory() {
    const settings = await chrome.storage.sync.get(['scanHistory']);
    return settings.scanHistory || [];
}

// Add URL to whitelist
async function addToWhitelist(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;
        
        const settings = await chrome.storage.sync.get(['whitelist']);
        const whitelist = settings.whitelist || [];
        
        if (!whitelist.includes(hostname)) {
            whitelist.push(hostname);
            await chrome.storage.sync.set({ whitelist });
        }
        
        // Clear cache for this URL
        urlCache.delete(url);
        
        return { success: true, hostname };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Remove from whitelist
async function removeFromWhitelist(hostname) {
    try {
        const settings = await chrome.storage.sync.get(['whitelist']);
        const whitelist = settings.whitelist || [];
        
        const index = whitelist.indexOf(hostname);
        if (index > -1) {
            whitelist.splice(index, 1);
            await chrome.storage.sync.set({ whitelist });
        }
        
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Get extension status
async function getExtensionStatus() {
    const settings = await chrome.storage.sync.get(['enableRealTimeProtection', 'enableNotifications', 'whitelist', 'scanHistory', 'apiUrl']);
    const history = settings.scanHistory || [];
    
    // Count threats from history
    const threatsDetected = history.filter(item => item.result && item.result.isPhishing).length;
    
    // Get today's scans
    const today = new Date().setHours(0, 0, 0, 0);
    const todayScans = history.filter(item => item.timestamp >= today).length;
    const todayThreats = history.filter(item => item.timestamp >= today && item.result && item.result.isPhishing).length;
    
    return {
        realTimeProtection: settings.enableRealTimeProtection !== false,
        notifications: settings.enableNotifications !== false,
        whitelistCount: (settings.whitelist || []).length,
        totalScans: history.length,
        threatsDetected,
        todayScans,
        todayThreats,
        cacheSize: urlCache.size,
        apiUrl: settings.apiUrl || DEFAULT_API_URL
    };
}