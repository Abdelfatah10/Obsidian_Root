// Phishing Shield - Content Script
// Scans page content and displays warnings for phishing attempts

(function() {
    'use strict';
    
    let warningDisplayed = false;
    
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
            
            default:
                sendResponse({ error: 'Unknown action' });
        }
        return true;
    });
    
    // Scan page content for phishing indicators
    function scanPageContent() {
        const result = {
            forms: [],
            links: [],
            suspiciousElements: [],
            score: 0
        };
        
        // Scan forms
        const forms = document.querySelectorAll('form');
        forms.forEach((form, index) => {
            const formData = {
                action: form.action,
                method: form.method,
                hasPasswordField: !!form.querySelector('input[type="password"]'),
                hasEmailField: !!form.querySelector('input[type="email"]'),
                inputCount: form.querySelectorAll('input').length
            };
            
            // Check if form submits to different domain
            try {
                const formUrl = new URL(form.action);
                if (formUrl.hostname !== window.location.hostname) {
                    formData.crossDomain = true;
                    result.score += 25;
                    result.suspiciousElements.push({
                        type: 'form',
                        reason: 'Form submits to different domain',
                        element: `Form #${index + 1}`
                    });
                }
            } catch (e) {
                // Invalid URL or relative path
            }
            
            // Password field without HTTPS
            if (formData.hasPasswordField && window.location.protocol !== 'https:') {
                result.score += 30;
                result.suspiciousElements.push({
                    type: 'form',
                    reason: 'Password field on non-HTTPS page',
                    element: `Form #${index + 1}`
                });
            }
            
            result.forms.push(formData);
        });
        
        // Scan links
        const links = document.querySelectorAll('a[href]');
        const suspiciousLinks = [];
        
        links.forEach(link => {
            const href = link.href;
            const text = link.textContent.toLowerCase();
            
            // Check for mismatched link text and URL
            if (href.startsWith('http')) {
                try {
                    const urlObj = new URL(href);
                    const displayedUrl = text.match(/https?:\/\/[^\s]+/i);
                    
                    if (displayedUrl) {
                        const displayedUrlObj = new URL(displayedUrl[0]);
                        if (displayedUrlObj.hostname !== urlObj.hostname) {
                            suspiciousLinks.push({
                                displayText: text.substring(0, 50),
                                actualUrl: href,
                                reason: 'Link text shows different URL than actual destination'
                            });
                            result.score += 20;
                        }
                    }
                } catch (e) {
                    // Invalid URL
                }
            }
            
            // Check for data: or javascript: URLs
            if (href.startsWith('data:') || href.startsWith('javascript:')) {
                suspiciousLinks.push({
                    displayText: text.substring(0, 50),
                    actualUrl: href.substring(0, 100),
                    reason: 'Potentially malicious URL scheme'
                });
                result.score += 15;
            }
        });
        
        result.links = suspiciousLinks;
        
        // Check for login forms mimicking popular services
        const pageText = document.body.innerText.toLowerCase();
        const brands = ['paypal', 'amazon', 'google', 'microsoft', 'apple', 'facebook', 'netflix', 'bank of america', 'chase', 'wells fargo'];
        
        brands.forEach(brand => {
            if (pageText.includes(brand) && !window.location.hostname.includes(brand.replace(' ', ''))) {
                result.suspiciousElements.push({
                    type: 'content',
                    reason: `Page mentions "${brand}" but is not on ${brand} domain`,
                    element: 'Page content'
                });
                result.score += 15;
            }
        });
        
        // Check for hidden iframes
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach((iframe, index) => {
            const style = window.getComputedStyle(iframe);
            if (style.display === 'none' || style.visibility === 'hidden' || 
                parseInt(style.width) < 10 || parseInt(style.height) < 10) {
                result.suspiciousElements.push({
                    type: 'iframe',
                    reason: 'Hidden iframe detected',
                    element: `Iframe #${index + 1}`
                });
                result.score += 20;
            }
        });
        
        // Check page title vs domain
        const title = document.title.toLowerCase();
        brands.forEach(brand => {
            if (title.includes(brand) && !window.location.hostname.includes(brand.replace(' ', ''))) {
                result.suspiciousElements.push({
                    type: 'title',
                    reason: `Page title mentions "${brand}" but domain doesn't match`,
                    element: 'Page title'
                });
                result.score += 20;
            }
        });
        
        result.isPhishing = result.score >= 40;
        
        return result;
    }
    
    // Show phishing warning overlay
    function showPhishingWarning(data) {
        if (warningDisplayed) return;
        
        warningDisplayed = true;
        
        // Create warning overlay
        const overlay = document.createElement('div');
        overlay.id = 'phishing-shield-warning';
        overlay.innerHTML = `
            <div class="phishing-shield-modal">
                <div class="phishing-shield-header">
                    <span class="phishing-shield-icon">⚠️</span>
                    <h2>Phishing Warning!</h2>
                </div>
                <div class="phishing-shield-content">
                    <p class="phishing-shield-main-message">
                        <strong>This website may be attempting to steal your personal information.</strong>
                    </p>
                    <p class="phishing-shield-reason">${escapeHtml(data.reason || 'Suspicious activity detected')}</p>
                    
                    <div class="phishing-shield-indicators">
                        <h3>Warning Indicators:</h3>
                        <ul>
                            ${(data.indicators || []).map(ind => `<li>${escapeHtml(ind)}</li>`).join('')}
                        </ul>
                    </div>
                    
                    <div class="phishing-shield-score">
                        Risk Score: <span class="score-value">${data.score || 0}/100</span>
                    </div>
                </div>
                <div class="phishing-shield-actions">
                    <button id="phishing-shield-back" class="btn-primary">← Go Back to Safety</button>
                    <button id="phishing-shield-proceed" class="btn-secondary">Proceed Anyway (Not Recommended)</button>
                    <button id="phishing-shield-whitelist" class="btn-tertiary">Trust this site</button>
                </div>
                <div class="phishing-shield-footer">
                    Protected by Phishing Shield
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
                background: rgba(0, 0, 0, 0.9);
                z-index: 2147483647;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            }
            
            .phishing-shield-modal {
                background: #fff;
                border-radius: 12px;
                max-width: 550px;
                width: 90%;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            }
            
            .phishing-shield-header {
                background: linear-gradient(135deg, #dc3545, #c82333);
                color: white;
                padding: 24px;
                text-align: center;
                border-radius: 12px 12px 0 0;
            }
            
            .phishing-shield-icon {
                font-size: 48px;
                display: block;
                margin-bottom: 12px;
            }
            
            .phishing-shield-header h2 {
                margin: 0;
                font-size: 24px;
                font-weight: 600;
            }
            
            .phishing-shield-content {
                padding: 24px;
            }
            
            .phishing-shield-main-message {
                font-size: 16px;
                color: #333;
                margin-bottom: 16px;
                line-height: 1.5;
            }
            
            .phishing-shield-reason {
                background: #fff3cd;
                border-left: 4px solid #ffc107;
                padding: 12px;
                margin-bottom: 16px;
                color: #856404;
                font-size: 14px;
            }
            
            .phishing-shield-indicators {
                background: #f8f9fa;
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 16px;
            }
            
            .phishing-shield-indicators h3 {
                font-size: 14px;
                font-weight: 600;
                color: #333;
                margin: 0 0 12px 0;
            }
            
            .phishing-shield-indicators ul {
                margin: 0;
                padding-left: 20px;
            }
            
            .phishing-shield-indicators li {
                color: #666;
                font-size: 13px;
                margin-bottom: 8px;
                line-height: 1.4;
            }
            
            .phishing-shield-score {
                text-align: center;
                font-size: 14px;
                color: #666;
            }
            
            .phishing-shield-score .score-value {
                font-weight: bold;
                color: #dc3545;
                font-size: 18px;
            }
            
            .phishing-shield-actions {
                padding: 0 24px 24px;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            
            .phishing-shield-actions button {
                padding: 12px 24px;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .btn-primary {
                background: #28a745;
                color: white;
            }
            
            .btn-primary:hover {
                background: #218838;
            }
            
            .btn-secondary {
                background: #6c757d;
                color: white;
            }
            
            .btn-secondary:hover {
                background: #5a6268;
            }
            
            .btn-tertiary {
                background: transparent;
                color: #666;
                border: 1px solid #ddd !important;
            }
            
            .btn-tertiary:hover {
                background: #f8f9fa;
            }
            
            .phishing-shield-footer {
                text-align: center;
                padding: 12px;
                background: #f8f9fa;
                color: #999;
                font-size: 12px;
                border-radius: 0 0 12px 12px;
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
                if (response.success) {
                    hideWarning();
                    alert('This site has been added to your whitelist.');
                }
            });
        });
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