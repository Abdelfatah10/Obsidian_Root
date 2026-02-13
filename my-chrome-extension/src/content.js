// Phishing Shield - Content Script
// Scans page content and displays warnings for phishing attempts

(function() {
    'use strict';
    
    let warningDisplayed = false;
    let lastScanResult = null;
    const SCAN_DEBOUNCE = 1000;
    let scanTimeout = null;
    
    // Extended brand list for detection
    const BRAND_PATTERNS = {
        'paypal': ['paypal.com', 'paypal-'],
        'amazon': ['amazon.com', 'amazon.co', 'aws.amazon'],
        'google': ['google.com', 'googleapis.com', 'gstatic.com'],
        'microsoft': ['microsoft.com', 'microsoftonline.com', 'live.com', 'outlook.com'],
        'apple': ['apple.com', 'icloud.com'],
        'facebook': ['facebook.com', 'fb.com', 'instagram.com'],
        'netflix': ['netflix.com'],
        'chase': ['chase.com'],
        'wellsfargo': ['wellsfargo.com', 'wf.com'],
        'bankofamerica': ['bankofamerica.com', 'bofa.com'],
        'dropbox': ['dropbox.com'],
        'linkedin': ['linkedin.com'],
        'twitter': ['twitter.com', 'x.com'],
        'whatsapp': ['whatsapp.com', 'web.whatsapp.com']
    };
    
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        switch (request.action) {
            case 'showWarning':
                showPhishingWarning(request.data);
                sendResponse({ success: true });
                break;
            
            case 'scanPage':
                const pageData = scanPageContent();
                sendResponse(pageData);
                break;
            
            case 'hideWarning':
                hideWarning();
                sendResponse({ success: true });
                break;
            
            case 'getLastScan':
                sendResponse(lastScanResult);
                break;
            
            default:
                sendResponse({ error: 'Unknown action' });
        }
        return true;
    });
    
    // Check if domain belongs to a brand
    function isDomainLegitimate(hostname, brand) {
        const patterns = BRAND_PATTERNS[brand.toLowerCase().replace(/\s/g, '')];
        if (!patterns) return false;
        return patterns.some(pattern => hostname.includes(pattern));
    }
    
    // Scan page content for phishing indicators
    function scanPageContent() {
        const result = {
            url: window.location.href,
            hostname: window.location.hostname,
            forms: [],
            links: [],
            suspiciousElements: [],
            indicators: [],
            score: 0,
            timestamp: Date.now()
        };
        
        const hostname = window.location.hostname.toLowerCase();
        
        // 1. Check SSL
        if (window.location.protocol !== 'https:') {
            result.score += 15;
            result.indicators.push('Page is not using HTTPS');
        }
        
        // 2. Scan forms
        const forms = document.querySelectorAll('form');
        forms.forEach((form, index) => {
            const formData = analyzeForm(form, index, result);
            result.forms.push(formData);
        });
        
        // 3. Scan links for mismatches
        const suspiciousLinks = analyzeSuspiciousLinks();
        result.links = suspiciousLinks;
        if (suspiciousLinks.length > 0) {
            result.score += Math.min(suspiciousLinks.length * 10, 30);
            result.indicators.push(`${suspiciousLinks.length} suspicious links detected`);
        }
        
        // 4. Brand impersonation check
        const brandCheck = checkBrandImpersonation(hostname);
        if (brandCheck.impersonating) {
            result.score += 35;
            result.indicators.push(`Possible ${brandCheck.brand} impersonation`);
            result.suspiciousElements.push({
                type: 'impersonation',
                reason: `Page appears to impersonate ${brandCheck.brand}`,
                element: 'Page content'
            });
        }
        
        // 5. Check for hidden elements
        const hiddenElements = checkHiddenElements();
        if (hiddenElements.length > 0) {
            result.score += hiddenElements.length * 10;
            hiddenElements.forEach(el => {
                result.indicators.push(el.reason);
                result.suspiciousElements.push(el);
            });
        }
        
        // 6. Check for urgency language
        const urgencyCheck = checkUrgencyLanguage();
        if (urgencyCheck.found) {
            result.score += 15;
            result.indicators.push('Urgency language detected');
        }
        
        // 7. Check for data harvesting scripts
        const scriptCheck = checkSuspiciousScripts();
        if (scriptCheck.suspicious) {
            result.score += 20;
            result.indicators.push('Suspicious scripts detected');
        }
        
        // 8. Domain age/reputation indicators
        const domainCheck = analyzeDomain(hostname);
        result.score += domainCheck.score;
        domainCheck.indicators.forEach(ind => result.indicators.push(ind));
        
        result.score = Math.min(result.score, 100);
        result.isPhishing = result.score >= 40;
        result.threatLevel = result.score >= 70 ? 'high' : result.score >= 40 ? 'medium' : result.score >= 20 ? 'low' : 'safe';
        
        lastScanResult = result;
        return result;
    }
    
    // Analyze a form for suspicious patterns
    function analyzeForm(form, index, result) {
        const formData = {
            action: form.action,
            method: form.method,
            hasPasswordField: !!form.querySelector('input[type="password"]'),
            hasEmailField: !!form.querySelector('input[type="email"], input[name*="email"], input[name*="user"]'),
            hasCreditCardField: !!form.querySelector('input[autocomplete="cc-number"], input[name*="card"], input[name*="credit"]'),
            hasSSNField: !!form.querySelector('input[name*="ssn"], input[name*="social"]'),
            inputCount: form.querySelectorAll('input').length
        };
        
        // Cross-domain form submission
        if (form.action) {
            try {
                const formUrl = new URL(form.action);
                if (formUrl.hostname !== window.location.hostname) {
                    formData.crossDomain = true;
                    result.score += 25;
                    result.indicators.push('Form submits to different domain');
                    result.suspiciousElements.push({
                        type: 'form',
                        reason: `Form submits to ${formUrl.hostname}`,
                        element: `Form #${index + 1}`
                    });
                }
            } catch (e) {}
        }
        
        // Password field without HTTPS
        if (formData.hasPasswordField && window.location.protocol !== 'https:') {
            result.score += 30;
            result.indicators.push('Password field on insecure page');
        }
        
        // Sensitive data collection
        if (formData.hasCreditCardField || formData.hasSSNField) {
            result.score += 20;
            result.indicators.push('Form collects sensitive financial data');
        }
        
        return formData;
    }
    // Analyze suspicious links
    function analyzeSuspiciousLinks() {
        const suspiciousLinks = [];
        const links = document.querySelectorAll('a[href]');
        
        links.forEach(link => {
            const href = link.href;
            const text = link.textContent.toLowerCase().trim();
            
            if (!href.startsWith('http')) return;
            
            try {
                const urlObj = new URL(href);
                
                // Check for mismatched display URL
                const displayedUrl = text.match(/https?:\/\/[^\s]+/i);
                if (displayedUrl) {
                    const displayedUrlObj = new URL(displayedUrl[0]);
                    if (displayedUrlObj.hostname !== urlObj.hostname) {
                        suspiciousLinks.push({
                            displayText: text.substring(0, 50),
                            actualUrl: href,
                            reason: 'Link text shows different URL'
                        });
                    }
                }
                
                // Check for suspicious URL patterns
                if (urlObj.hostname.match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/)) {
                    suspiciousLinks.push({
                        displayText: text.substring(0, 50),
                        actualUrl: href,
                        reason: 'Link uses IP address'
                    });
                }
                
                // Very long subdomain
                const subdomain = urlObj.hostname.split('.').slice(0, -2).join('.');
                if (subdomain.length > 30) {
                    suspiciousLinks.push({
                        displayText: text.substring(0, 50),
                        actualUrl: href,
                        reason: 'Suspicious long subdomain'
                    });
                }
                
            } catch (e) {}
            
            // Dangerous URL schemes
            if (href.startsWith('data:') || href.startsWith('javascript:')) {
                suspiciousLinks.push({
                    displayText: text.substring(0, 50),
                    actualUrl: href.substring(0, 100),
                    reason: 'Potentially malicious URL scheme'
                });
            }
        });
        
        return suspiciousLinks;
    }
    
    // Check for brand impersonation
    function checkBrandImpersonation(hostname) {
        const pageText = (document.body.innerText + ' ' + document.title).toLowerCase();
        
        for (const [brand, domains] of Object.entries(BRAND_PATTERNS)) {
            // Check if brand is mentioned but domain doesn't match
            if (pageText.includes(brand) && !isDomainLegitimate(hostname, brand)) {
                // Extra check: does the page have login/payment forms?
                const hasLoginForm = !!document.querySelector('input[type="password"]');
                const hasCardForm = !!document.querySelector('input[name*="card"], input[autocomplete*="cc"]');
                
                if (hasLoginForm || hasCardForm) {
                    return { impersonating: true, brand: brand.charAt(0).toUpperCase() + brand.slice(1) };
                }
            }
        }
        
        return { impersonating: false };
    }
    
    // Check for hidden elements
    function checkHiddenElements() {
        const suspicious = [];
        
        // Hidden iframes
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach((iframe, index) => {
            const style = window.getComputedStyle(iframe);
            if (style.display === 'none' || style.visibility === 'hidden' || 
                parseInt(style.width) < 10 || parseInt(style.height) < 10) {
                suspicious.push({
                    type: 'iframe',
                    reason: 'Hidden iframe detected',
                    element: `Iframe #${index + 1}`
                });
            }
        });
        
        // Hidden forms
        const forms = document.querySelectorAll('form');
        forms.forEach((form, index) => {
            const style = window.getComputedStyle(form);
            if ((style.display === 'none' || style.visibility === 'hidden') && 
                form.querySelector('input[type="password"], input[type="email"]')) {
                suspicious.push({
                    type: 'form',
                    reason: 'Hidden form with input fields',
                    element: `Form #${index + 1}`
                });
            }
        });
        
        return suspicious;
    }
    
    // Check for urgency language
    function checkUrgencyLanguage() {
        const pageText = document.body.innerText.toLowerCase();
        const urgencyPhrases = [
            'account will be suspended',
            'verify immediately',
            'action required',
            'your account has been limited',
            'unusual activity',
            'update your information now',
            'confirm within 24 hours',
            'your account is at risk',
            'urgent action needed'
        ];
        
        const found = urgencyPhrases.filter(phrase => pageText.includes(phrase));
        return { found: found.length > 0, phrases: found };
    }
    
    // Check for suspicious scripts
    function checkSuspiciousScripts() {
        const scripts = document.querySelectorAll('script');
        let suspicious = false;
        
        scripts.forEach(script => {
            const content = script.textContent || '';
            // Check for keyloggers or form hijacking
            if (content.includes('onkeypress') || content.includes('onkeydown') ||
                content.includes('FormData') && content.includes('fetch')) {
                suspicious = true;
            }
        });
        
        return { suspicious };
    }
    
    // Analyze domain characteristics
    function analyzeDomain(hostname) {
        const result = { score: 0, indicators: [] };
        
        // Check for IP address
        if (hostname.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
            result.score += 25;
            result.indicators.push('Domain is an IP address');
        }
        
        // Check for excessive hyphens
        if ((hostname.match(/-/g) || []).length > 3) {
            result.score += 10;
            result.indicators.push('Domain has many hyphens');
        }
        
        // Check for suspicious TLDs
        const suspiciousTLDs = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.club', '.work', '.loan'];
        if (suspiciousTLDs.some(tld => hostname.endsWith(tld))) {
            result.score += 15;
            result.indicators.push('Suspicious domain extension');
        }
        
        // Check for brand names in subdomain with different main domain
        const parts = hostname.split('.');
        if (parts.length > 2) {
            const subdomain = parts.slice(0, -2).join('.');
            for (const brand of Object.keys(BRAND_PATTERNS)) {
                if (subdomain.includes(brand) && !isDomainLegitimate(hostname, brand)) {
                    result.score += 20;
                    result.indicators.push(`Brand name "${brand}" in suspicious subdomain`);
                    break;
                }
            }
        }
        
        return result;
    }
    
    // Show phishing warning overlay
    function showPhishingWarning(data) {
        if (warningDisplayed) return;
        
        warningDisplayed = true;
        
        const score = data.score || 0;
        const threatClass = score >= 70 ? 'critical' : score >= 40 ? 'warning' : 'caution';
        const threatText = score >= 70 ? 'HIGH RISK' : score >= 40 ? 'SUSPICIOUS' : 'CAUTION';
        
        // Create warning overlay
        const overlay = document.createElement('div');
        overlay.id = 'phishing-shield-warning';
        overlay.innerHTML = `
            <div class="phishing-shield-modal ${threatClass}">
                <div class="phishing-shield-header">
                    <div class="phishing-shield-icon-container">
                        <span class="phishing-shield-icon">${score >= 70 ? '🚨' : '⚠️'}</span>
                    </div>
                    <h2>Phishing Alert</h2>
                    <span class="threat-badge">${threatText}</span>
                </div>
                <div class="phishing-shield-content">
                    <div class="risk-meter">
                        <div class="risk-meter-label">Risk Level</div>
                        <div class="risk-meter-bar">
                            <div class="risk-meter-fill" style="width: ${Math.min(score, 100)}%"></div>
                        </div>
                        <div class="risk-meter-value">${score}%</div>
                    </div>
                    
                    <p class="phishing-shield-main-message">
                        This website may be attempting to steal your personal information.
                    </p>
                    
                    ${data.reason ? `<div class="phishing-shield-reason">${escapeHtml(data.reason)}</div>` : ''}
                    
                    ${(data.indicators && data.indicators.length > 0) ? `
                        <div class="phishing-shield-indicators">
                            <h3>🔍 Detected Issues</h3>
                            <ul>
                                ${data.indicators.slice(0, 6).map(ind => `<li>${escapeHtml(ind)}</li>`).join('')}
                            </ul>
                            ${data.indicators.length > 6 ? `<span class="more-indicators">+${data.indicators.length - 6} more</span>` : ''}
                        </div>
                    ` : ''}
                    
                    <div class="phishing-shield-tips">
                        <h4>🛡️ Stay Safe</h4>
                        <ul>
                            <li>Don't enter personal information</li>
                            <li>Check the URL carefully</li>
                            <li>When in doubt, go directly to the official website</li>
                        </ul>
                    </div>
                </div>
                <div class="phishing-shield-actions">
                    <button id="phishing-shield-back" class="btn-safe">
                        <span>←</span> Go Back to Safety
                    </button>
                    <div class="secondary-actions">
                        <button id="phishing-shield-proceed" class="btn-proceed">Continue Anyway</button>
                        <button id="phishing-shield-whitelist" class="btn-trust">Trust Site</button>
                    </div>
                </div>
                <div class="phishing-shield-footer">
                    <span class="shield-logo">🛡️</span> Protected by Phishing Shield
                </div>
            </div>
        `;
        
        // Add styles
        const styles = document.createElement('style');
        styles.textContent = `
            #phishing-shield-warning {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.92);
                z-index: 2147483647;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                animation: fadeIn 0.3s ease;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            .phishing-shield-modal {
                background: #1a1a2e;
                border-radius: 16px;
                max-width: 480px;
                width: 90%;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5);
                animation: slideUp 0.4s ease;
                color: #fff;
            }
            
            .phishing-shield-modal.critical {
                border: 2px solid #dc3545;
                box-shadow: 0 0 40px rgba(220, 53, 69, 0.3);
            }
            
            .phishing-shield-modal.warning {
                border: 2px solid #ffc107;
            }
            
            @keyframes slideUp {
                from { transform: translateY(30px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            
            .phishing-shield-header {
                background: linear-gradient(135deg, #dc3545, #c82333);
                padding: 24px;
                text-align: center;
                border-radius: 14px 14px 0 0;
                position: relative;
            }
            
            .phishing-shield-modal.warning .phishing-shield-header {
                background: linear-gradient(135deg, #ffc107, #e0a800);
            }
            
            .phishing-shield-icon-container {
                width: 64px;
                height: 64px;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 12px;
            }
            
            .phishing-shield-icon {
                font-size: 36px;
            }
            
            .phishing-shield-header h2 {
                margin: 0;
                font-size: 22px;
                font-weight: 600;
                color: #fff;
            }
            
            .threat-badge {
                display: inline-block;
                background: rgba(0, 0, 0, 0.3);
                padding: 4px 12px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 600;
                margin-top: 8px;
                letter-spacing: 1px;
            }
            
            .phishing-shield-content {
                padding: 20px;
            }
            
            .risk-meter {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 16px;
                padding: 12px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 8px;
            }
            
            .risk-meter-label {
                font-size: 12px;
                color: rgba(255, 255, 255, 0.7);
                min-width: 70px;
            }
            
            .risk-meter-bar {
                flex: 1;
                height: 8px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 4px;
                overflow: hidden;
            }
            
            .risk-meter-fill {
                height: 100%;
                background: linear-gradient(90deg, #ffc107, #dc3545);
                border-radius: 4px;
                transition: width 0.5s ease;
            }
            
            .risk-meter-value {
                font-size: 16px;
                font-weight: 700;
                color: #dc3545;
                min-width: 40px;
                text-align: right;
            }
            
            .phishing-shield-main-message {
                font-size: 15px;
                color: rgba(255, 255, 255, 0.9);
                margin-bottom: 16px;
                line-height: 1.5;
                text-align: center;
            }
            
            .phishing-shield-reason {
                background: rgba(255, 193, 7, 0.15);
                border-left: 3px solid #ffc107;
                padding: 10px 14px;
                margin-bottom: 16px;
                color: #ffc107;
                font-size: 13px;
                border-radius: 0 6px 6px 0;
            }
            
            .phishing-shield-indicators {
                background: rgba(255, 255, 255, 0.05);
                border-radius: 10px;
                padding: 14px;
                margin-bottom: 16px;
            }
            
            .phishing-shield-indicators h3 {
                font-size: 13px;
                font-weight: 600;
                color: #ffc107;
                margin: 0 0 10px 0;
            }
            
            .phishing-shield-indicators ul {
                margin: 0;
                padding-left: 18px;
            }
            
            .phishing-shield-indicators li {
                color: rgba(255, 255, 255, 0.8);
                font-size: 12px;
                margin-bottom: 6px;
                line-height: 1.4;
            }
            
            .more-indicators {
                display: block;
                font-size: 11px;
                color: rgba(255, 255, 255, 0.5);
                margin-top: 6px;
            }
            
            .phishing-shield-tips {
                background: rgba(40, 167, 69, 0.1);
                border-radius: 10px;
                padding: 14px;
            }
            
            .phishing-shield-tips h4 {
                font-size: 13px;
                font-weight: 600;
                color: #28a745;
                margin: 0 0 8px 0;
            }
            
            .phishing-shield-tips ul {
                margin: 0;
                padding-left: 18px;
            }
            
            .phishing-shield-tips li {
                color: rgba(255, 255, 255, 0.7);
                font-size: 12px;
                margin-bottom: 4px;
            }
            
            .phishing-shield-actions {
                padding: 0 20px 20px;
            }
            
            .phishing-shield-actions button {
                width: 100%;
                padding: 14px;
                border: none;
                border-radius: 10px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .btn-safe {
                background: linear-gradient(135deg, #28a745, #218838);
                color: white;
                margin-bottom: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }
            
            .btn-safe:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(40, 167, 69, 0.4);
            }
            
            .secondary-actions {
                display: flex;
                gap: 8px;
            }
            
            .btn-proceed, .btn-trust {
                flex: 1;
                background: rgba(255, 255, 255, 0.1);
                color: rgba(255, 255, 255, 0.7);
                font-size: 12px;
                padding: 10px;
            }
            
            .btn-proceed:hover, .btn-trust:hover {
                background: rgba(255, 255, 255, 0.15);
                color: #fff;
            }
            
            .phishing-shield-footer {
                text-align: center;
                padding: 14px;
                background: rgba(255, 255, 255, 0.03);
                color: rgba(255, 255, 255, 0.5);
                font-size: 11px;
                border-radius: 0 0 14px 14px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
            }
            
            .shield-logo {
                font-size: 14px;
            }
        `;
        
        document.head.appendChild(styles);
        document.body.appendChild(overlay);
        
        // Event listeners
        document.getElementById('phishing-shield-back').addEventListener('click', () => {
            history.back();
        });
        
        document.getElementById('phishing-shield-proceed').addEventListener('click', () => {
            hideWarning();
        });
        
        document.getElementById('phishing-shield-whitelist').addEventListener('click', () => {
            chrome.runtime.sendMessage({
                action: 'addToWhitelist',
                url: window.location.href
            }, (response) => {
                if (response && response.success) {
                    hideWarning();
                    showToast('Site added to trusted list', 'success');
                }
            });
        });
    }
    
    // Show toast notification
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `phishing-shield-toast ${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 24px;
            background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
            color: white;
            border-radius: 8px;
            font-size: 14px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            z-index: 2147483647;
            animation: slideUp 0.3s ease;
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
    
    // Hide warning overlay
    function hideWarning() {
        const warning = document.getElementById('phishing-shield-warning');
        if (warning) {
            warning.remove();
            warningDisplayed = false;
        }
    }
    
    // Escape HTML to prevent XSS
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Highlight suspicious links on page
    function highlightSuspiciousLinks() {
        const links = document.querySelectorAll('a[href]');
        
        links.forEach(link => {
            const href = link.href;
            const text = link.textContent.toLowerCase();
            
            // Check for mismatched URLs
            if (href.startsWith('http')) {
                const displayedUrl = text.match(/https?:\/\/[^\s]+/i);
                if (displayedUrl) {
                    try {
                        const actualUrl = new URL(href);
                        const displayedUrlObj = new URL(displayedUrl[0]);
                        
                        if (actualUrl.hostname !== displayedUrlObj.hostname) {
                            link.style.outline = '2px solid #ff6600';
                            link.title = `Warning: Link shows ${displayedUrlObj.hostname} but goes to ${actualUrl.hostname}`;
                        }
                    } catch (e) {
                        // Invalid URL
                    }
                }
            }
        });
    }
    
    // Initialize on page load
    function init() {
        // Small delay to ensure page is fully loaded  
        setTimeout(() => {
            // Perform initial page scan
            const pageData = scanPageContent();
            
            // If page looks suspicious, notify background script
            if (pageData.isPhishing) {
                chrome.runtime.sendMessage({
                    action: 'analyzeUrl',
                    url: window.location.href
                });
            }
            
            // Optionally highlight suspicious links
            chrome.storage.sync.get(['highlightLinks'], (settings) => {
                if (settings.highlightLinks) {
                    highlightSuspiciousLinks();
                }
            });
        }, 500);
    }
    
    // Run initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();