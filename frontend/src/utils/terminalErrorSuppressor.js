// Terminal Error Suppressor
// This script suppresses non-critical terminal-related console errors and warnings

(function() {
    'use strict';
    
    // Override console methods immediately to catch early errors
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalLog = console.log;
    
    // Common terminal-related messages to suppress
    const suppressPatterns = [
        // xterm.js warnings
        'maybe unknown option',
        'WebGL renderer',
        'Unknown ESC control sequence',
        'Cannot read properties of undefined',
        'parsing error',
        
        // ttyd specific
        '[ttyd]',
        'setting Unicode version',
        
        // WebSocket related
        'WebSocket is already in CLOSING or CLOSED state',
        'Failed to execute \'send\' on \'WebSocket\'',
        
        // Source map warnings
        'Source-Map-Fehler',
        'Source-Map-Error',
        'DevTools failed to load source map',
        
        // Other terminal related
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed',
        'Non-Error promise rejection captured',
        
        // Browser compatibility
        'Deprecation warning',
        'registerProtocolHandler',
    ];
    
    // Override console.warn
    console.warn = function(...args) {
        const msg = args[0] ? String(args[0]) : '';
        for (const pattern of suppressPatterns) {
            if (msg.includes(pattern)) return;
        }
        return originalWarn.apply(console, args);
    };
    
    // Override console.error  
    console.error = function(...args) {
        const msg = args[0] ? String(args[0]) : '';
        for (const pattern of suppressPatterns) {
            if (msg.includes(pattern)) return;
        }
        // Also suppress xterm.js specific errors
        if (msg.includes('xterm') && msg.includes('Cannot')) return;
        if (msg.includes('ttyd') && msg.includes('error')) return;
        
        return originalError.apply(console, args);
    };
    
    // Override console.log for verbose ttyd messages
    console.log = function(...args) {
        const msg = args[0] ? String(args[0]) : '';
        if (msg.includes('[ttyd]') && 
            (msg.includes('option:') || 
             msg.includes('setting Unicode version') ||
             msg.includes('WebGL renderer') ||
             msg.includes('connected') ||
             msg.includes('disconnected'))) {
            return;
        }
        return originalLog.apply(console, args);
    };
    
    // Wait for iframe to be ready and inject suppression there too
    function setupIframeSuppression() {
        const terminalIframe = document.getElementById('ttyd-terminal-iframe');
        
        if (!terminalIframe) {
            // Try again in 100ms if terminal not yet loaded
            setTimeout(setupIframeSuppression, 100);
            return;
        }
        
        // Try to inject into iframe
        try {
            const iframeWindow = terminalIframe.contentWindow;
            if (!iframeWindow) return;
            
            // Check if we already injected
            if (iframeWindow.__errorSuppressorInjected) return;
            iframeWindow.__errorSuppressorInjected = true;
            
            // Override iframe's console methods
            const iframeOriginalWarn = iframeWindow.console.warn;
            const iframeOriginalError = iframeWindow.console.error;
            const iframeOriginalLog = iframeWindow.console.log;
            
            iframeWindow.console.warn = function(...args) {
                const msg = args[0] ? String(args[0]) : '';
                for (const pattern of suppressPatterns) {
                    if (msg.includes(pattern)) return;
                }
                return iframeOriginalWarn.apply(iframeWindow.console, args);
            };
            
            iframeWindow.console.error = function(...args) {
                const msg = args[0] ? String(args[0]) : '';
                for (const pattern of suppressPatterns) {
                    if (msg.includes(pattern)) return;
                }
                if (msg.includes('xterm') && msg.includes('Cannot')) return;
                if (msg.includes('ttyd') && msg.includes('error')) return;
                return iframeOriginalError.apply(iframeWindow.console, args);
            };
            
            iframeWindow.console.log = function(...args) {
                const msg = args[0] ? String(args[0]) : '';
                if (msg.includes('[ttyd]')) return;
                return iframeOriginalLog.apply(iframeWindow.console, args);
            };
            
        } catch (e) {
            // Cross-origin iframe - can't access it directly
            // Our parent window overrides should still catch most messages
        }
    }
    
    // Start the iframe suppression process
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupIframeSuppression);
    } else {
        setupIframeSuppression();
    }
    
    // Also try to catch errors via global error handler
    window.addEventListener('error', function(event) {
        if (event.message) {
            for (const pattern of suppressPatterns) {
                if (event.message.includes(pattern)) {
                    event.preventDefault();
                    return false;
                }
            }
        }
    }, true);
    
    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', function(event) {
        if (event.reason && event.reason.message) {
            for (const pattern of suppressPatterns) {
                if (event.reason.message.includes(pattern)) {
                    event.preventDefault();
                    return false;
                }
            }
        }
    }, true);
})();
