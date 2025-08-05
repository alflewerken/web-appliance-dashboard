// TTYD Configuration Override
// Verhindert unnötige Token-Fetches und unterdrückt nicht-kritische Warnungen

(function() {
    // Override fetch to prevent token endpoint calls
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const url = args[0];
        
        // Block ttyd token fetch attempts
        if (typeof url === 'string' && url.includes('/terminal/token')) {
            console.log('[TTYD] Token fetch blocked - not required for operation');
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

    // Suppress non-critical ttyd console warnings
    const originalConsoleWarn = console.warn;
    console.warn = function(...args) {
        const message = args[0];
        
        // Filter out known non-critical ttyd warnings
        if (typeof message === 'string') {
            // Suppress "maybe unknown option" warnings
            if (message.includes('maybe unknown option')) {
                return;
            }
            // Suppress WebGL renderer messages (info, not warning)
            if (message.includes('WebGL renderer loaded')) {
                console.log('[TTYD]', message);
                return;
            }
        }
        
        return originalConsoleWarn.apply(this, args);
    };

    // Suppress Source Map errors
    const originalConsoleError = console.error;
    console.error = function(...args) {
        const message = args[0];
        
        // Filter out Source Map errors
        if (typeof message === 'string' && message.includes('Source-Map-Fehler')) {
            return;
        }
        
        return originalConsoleError.apply(this, args);
    };
})();
