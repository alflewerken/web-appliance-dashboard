// Terminal Error Suppressor
// Unterdrückt bekannte, harmlose Fehler vom ttyd Terminal

(function() {
    // Store original console methods
    const originalWarn = console.warn;
    const originalError = console.error;
    
    // Define patterns to suppress
    const suppressPatterns = [
        /ttyd.*fetch.*token.*SyntaxError/i,
        /Source-Map-Fehler.*app\.\w+\.js\.map/i,
        /Source-Map error.*app\.\w+\.js\.map/i,
        /ttyd.*WebGL renderer loaded/i,
        /ttyd.*setting Unicode version/i,
        /ttyd.*websocket connection opened/i
    ];
    
    // Override console.warn
    console.warn = function(...args) {
        const message = args.join(' ');
        const shouldSuppress = suppressPatterns.some(pattern => pattern.test(message));
        
        if (!shouldSuppress) {
            originalWarn.apply(console, args);
        }
    };
    
    // Override console.error for Source-Map errors
    const originalConsoleError = window.console.error;
    window.console.error = function(...args) {
        const message = args.join(' ');
        const shouldSuppress = suppressPatterns.some(pattern => pattern.test(message));
        
        if (!shouldSuppress) {
            originalConsoleError.apply(console, args);
        }
    };
    
    // Also suppress window error events for source maps
    window.addEventListener('error', function(event) {
        if (event.message && event.message.includes('Source-Map')) {
            event.preventDefault();
        }
    }, true);
})();
