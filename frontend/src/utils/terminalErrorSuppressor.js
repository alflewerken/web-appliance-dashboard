// Terminal Error Suppressor
// This script is injected into the terminal iframe to suppress non-critical errors

(function() {
    'use strict';
    
    // Wait for iframe to be ready
    function setupErrorSuppression() {
        const terminalIframe = document.getElementById('ttyd-terminal-iframe');
        
        if (!terminalIframe) {
            // Try again in 100ms
            setTimeout(setupErrorSuppression, 100);
            return;
        }
        
        // Inject script into iframe
        try {
            const iframeDoc = terminalIframe.contentDocument || terminalIframe.contentWindow.document;
            
            if (!iframeDoc) {
                console.log('[Terminal] Waiting for iframe document...');
                setTimeout(setupErrorSuppression, 100);
                return;
            }
            
            // Check if we already injected
            if (iframeDoc.querySelector('#error-suppressor')) {
                return;
            }
            
            const script = iframeDoc.createElement('script');
            script.id = 'error-suppressor';
            script.textContent = `
                (function() {
                    // Override fetch to handle token requests
                    const originalFetch = window.fetch;
                    window.fetch = function(...args) {
                        const url = args[0];
                        
                        if (typeof url === 'string' && url.includes('/terminal/token')) {
                            return Promise.resolve(new Response(JSON.stringify({
                                success: true,
                                token: 'not-required'
                            }), {
                                status: 200,
                                headers: { 'Content-Type': 'application/json' }
                            }));
                        }
                        
                        return originalFetch.apply(this, args);
                    };
                    
                    // Suppress console warnings
                    const originalWarn = console.warn;
                    console.warn = function(...args) {
                        const msg = args[0] ? String(args[0]) : '';
                        if (msg.includes('maybe unknown option')) return;
                        if (msg.includes('WebGL renderer loaded')) {
                            console.log('[ttyd]', msg);
                            return;
                        }
                        return originalWarn.apply(console, args);
                    };
                    
                    // Suppress console errors
                    const originalError = console.error;
                    console.error = function(...args) {
                        const msg = args[0] ? String(args[0]) : '';
                        if (msg.includes('Source-Map-Fehler') || msg.includes('Source-Map-Error')) return;
                        return originalError.apply(console, args);
                    };
                    
                    // Reduce ttyd verbosity
                    const originalLog = console.log;
                    console.log = function(...args) {
                        const msg = args[0] ? String(args[0]) : '';
                        if (msg.includes('[ttyd]') && 
                            (msg.includes('option:') || 
                             msg.includes('setting Unicode version') ||
                             msg.includes('WebGL renderer'))) {
                            return;
                        }
                        return originalLog.apply(console, args);
                    };
                })();
            `;
            
            // Insert at the beginning of head or body
            const target = iframeDoc.head || iframeDoc.body;
            if (target) {
                target.insertBefore(script, target.firstChild);
                console.log('[Terminal] Error suppression activated');
            }
            
        } catch (e) {
            // Cross-origin iframe, try a different approach
            console.log('[Terminal] Cross-origin iframe detected, using alternative approach');
            
            // Override in parent window
            const originalWarn = console.warn;
            console.warn = function(...args) {
                const msg = args[0] ? String(args[0]) : '';
                if (msg.includes('maybe unknown option')) return;
                return originalWarn.apply(console, args);
            };
            
            const originalError = console.error;
            console.error = function(...args) {
                const msg = args[0] ? String(args[0]) : '';
                if (msg.includes('Source-Map-Fehler')) return;
                return originalError.apply(console, args);
            };
        }
    }
    
    // Start the process
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupErrorSuppression);
    } else {
        setupErrorSuppression();
    }
})();
