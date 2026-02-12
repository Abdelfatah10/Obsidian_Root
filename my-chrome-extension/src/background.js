// Phishing Shield - Background Service Worker
// Handles URL analysis, API communication, and phishing detection

const DEFAULT_API_URL = 'http://localhost:3000/api';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// URL analysis cache
const urlCache = new Map();

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
            whitelist: [],
            scanHistory: []
        });
    }
    
    // Create context menu
    chrome.contextMenus.create({
        id: 'scanLink',
        title: 'Scan link for phishing',
        contexts: ['link']
    });
    
    chrome.contextMenus.create({
        id: 'scanPage',
        title: 'Scan this page',
        contexts: ['page']
    });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'scanLink') {
        const result = await analyzeUrl(info.linkUrl);
        showNotification(result);
    } else if (info.menuItemId === 'scanPage') {
        const result = await analyzeUrl(tab.url);
        showNotification(result);
        updateBadge(tab.id, result);
    }
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        const settings = await chrome.storage.sync.get(['enableRealTimeProtection']);
        
        if (settings.enableRealTimeProtection) {
            const result = await analyzeUrl(tab.url);
            updateBadge(tabId, result);
            
            if (result.isPhishing) {
                // Send warning to content script
                chrome.tabs.sendMessage(tabId, {
                    action: 'showWarning',
                    data: result
                });
            }
        }
    }
});

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    handleMessage(request, sender).then(sendResponse);
    return true; // Keep message channel open for async response
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
        
        case 'addToWhitelist':
            return await addToWhitelist(request.url);
        
        case 'checkCurrentTab':
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && tab.url) {
                const result = await analyzeUrl(tab.url);
                updateBadge(tab.id, result);
                return result;
            }
            return { error: 'No active tab' };
        
        default:
            return { error: 'Unknown action' };
    }
}

// Analyze URL for phishing
async function analyzeUrl(url) {
    if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
        return { isPhishing: false, score: 0, reason: 'Internal URL' };
    }
    
    // Check cache
    const cached = urlCache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.result;
    }
    
    // Check whitelist
    const settings = await chrome.storage.sync.get(['whitelist', 'apiUrl']);
    const whitelist = settings.whitelist || [];
    
    try {
        const urlObj = new URL(url);
        if (whitelist.includes(urlObj.hostname)) {
            return { isPhishing: false, score: 0, reason: 'Whitelisted' };
        }
    } catch (e) {
        // Invalid URL
    }
    
    // Perform local analysis first
    const localResult = performLocalAnalysis(url);
    
    // Try API analysis
    try {
        const apiResult = await callPhishingAPI(url, settings.apiUrl);
        const result = mergeResults(localResult, apiResult);
        
        // Cache the result
        urlCache.set(url, { result, timestamp: Date.now() });
        
        // Save to history
        await saveScanHistory(url, result);
        
        return result;
    } catch (error) {
        console.error('API error:', error);
        // Fall back to local analysis only
        urlCache.set(url, { result: localResult, timestamp: Date.now() });
        return localResult;
    }
}

// Local URL analysis (heuristics)
function performLocalAnalysis(url) {
    const result = {
        isPhishing: false,
        score: 0,
        indicators: [],
        reason: ''
    };
    
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        const path = urlObj.pathname.toLowerCase();
        
        // Check for IP address instead of domain
        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
            result.score += 30;
            result.indicators.push('IP address used instead of domain name');
        }
        
        // Check for suspicious TLDs
        const suspiciousTLDs = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.work', '.click'];
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
        const brands = ['paypal', 'amazon', 'google', 'microsoft', 'apple', 'facebook', 'netflix', 'bank', 'secure', 'login', 'account', 'verify'];
        const brandInSubdomain = brands.some(brand => {
            const mainDomain = hostname.split('.').slice(-2).join('.');
            return hostname.includes(brand) && !mainDomain.includes(brand);
        });
        
        if (brandInSubdomain) {
            result.score += 35;
            result.indicators.push('Possible brand impersonation in subdomain');
        }
        
        // Check for suspicious keywords in path
        const suspiciousKeywords = ['login', 'signin', 'verify', 'secure', 'account', 'update', 'confirm', 'banking', 'password'];
        const keywordsInPath = suspiciousKeywords.filter(kw => path.includes(kw));
        if (keywordsInPath.length >= 2) {
            result.score += 15;
            result.indicators.push('Suspicious keywords in URL path');
        }
        
        // Check for unusual port
        if (urlObj.port && !['80', '443', ''].includes(urlObj.port)) {
            result.score += 10;
            result.indicators.push('Unusual port number');
        }
        
        // Check URL length
        if (url.length > 100) {
            result.score += 10;
            result.indicators.push('Unusually long URL');
        }
        
        // Check for @ symbol in URL
        if (url.includes('@')) {
            result.score += 25;
            result.indicators.push('URL contains @ symbol (possible credential theft)');
        }
        
        // Check for double slashes in path
        if (path.includes('//')) {
            result.score += 10;
            result.indicators.push('Double slashes in URL path');
        }
        
        // Check for hexadecimal characters
        if (/%[0-9a-fA-F]{2}/.test(url) && url.match(/%[0-9a-fA-F]{2}/g).length > 5) {
            result.score += 15;
            result.indicators.push('Excessive URL encoding');
        }
        
        // Determine if phishing based on score
        result.isPhishing = result.score >= 50;
        
        if (result.score >= 70) {
            result.reason = 'High risk - Multiple phishing indicators detected';
        } else if (result.score >= 50) {
            result.reason = 'Medium risk - Suspicious characteristics found';
        } else if (result.score >= 25) {
            result.reason = 'Low risk - Some suspicious indicators';
        } else {
            result.reason = 'Safe - No significant threats detected';
        }
        
    } catch (error) {
        console.error('Local analysis error:', error);
    }
    
    return result;
}

// Call backend API for analysis
async function callPhishingAPI(url, apiUrl) {
    const response = await fetch(`${apiUrl}/phishing/analyze`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url })
    });
    
    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
}

// Analyze email content for phishing
async function analyzeEmail(emailContent) {
    const settings = await chrome.storage.sync.get(['apiUrl']);
    
    try {
        const response = await fetch(`${settings.apiUrl}/phishing/analyze-email`, {
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
    const urgencyWords = ['urgent', 'immediately', 'suspended', 'locked', 'verify now', 'act now', 'expire'];
    urgencyWords.forEach(word => {
        if (lowerContent.includes(word)) {
            result.score += 10;
            result.indicators.push(`Urgency keyword: "${word}"`);
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
        'security alert'
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
        if (urlAnalysis.isPhishing) {
            result.score += 30;
            result.indicators.push(`Suspicious URL found: ${url}`);
        }
    });
    
    result.isPhishing = result.score >= 40;
    
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
        aiAnalysis: apiResult.aiAnalysis || null
    };
}

// Update extension badge
function updateBadge(tabId, result) {
    if (result.isPhishing) {
        chrome.action.setBadgeText({ text: '!', tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#FF0000', tabId });
    } else if (result.score >= 25) {
        chrome.action.setBadgeText({ text: '?', tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#FFA500', tabId });
    } else {
        chrome.action.setBadgeText({ text: '✓', tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#00AA00', tabId });
    }
}

// Show notification
async function showNotification(result) {
    const settings = await chrome.storage.sync.get(['enableNotifications']);
    
    if (settings.enableNotifications && result.isPhishing) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'Phishing Warning!',
            message: result.reason || 'This site may be a phishing attempt.',
            priority: 2
        });
    }
}

// Save scan to history
async function saveScanHistory(url, result) {
    const settings = await chrome.storage.sync.get(['scanHistory']);
    const history = settings.scanHistory || [];
    
    history.unshift({
        url,
        result,
        timestamp: Date.now()
    });
    
    // Keep only last 100 entries
    if (history.length > 100) {
        history.splice(100);
    }
    
    await chrome.storage.sync.set({ scanHistory: history });
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
        
        return { success: true, hostname };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Get extension status
async function getExtensionStatus() {
    const settings = await chrome.storage.sync.get(['enableRealTimeProtection', 'enableNotifications', 'whitelist', 'scanHistory']);
    
    return {
        realTimeProtection: settings.enableRealTimeProtection !== false,
        notifications: settings.enableNotifications !== false,
        whitelistCount: (settings.whitelist || []).length,
        totalScans: (settings.scanHistory || []).length,
        cacheSize: urlCache.size
    };
}