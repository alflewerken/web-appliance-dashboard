// Quick Fix für Terminal in macOS App
// Dieses Script kann direkt in der Browser-Console ausgeführt werden

(function() {
    // Override die React-Component-Methode
    const interval = setInterval(() => {
        const components = document.querySelectorAll('[class*="appliance-card"], [class*="service-card"]');
        if (components.length > 0) {
            clearInterval(interval);
            console.log('Quick Fix: Überschreibe Terminal-Buttons...');
            
            // Event Delegation für alle Terminal-Buttons
            document.body.addEventListener('click', (e) => {
                const btn = e.target.closest('.terminal-btn, button[title*="Terminal"]');
                if (btn) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Öffne Terminal direkt
                    const params = new URLSearchParams({
                        host: 'localhost',
                        user: 'root',
                        port: '22',
                        token: localStorage.getItem('token') || ''
                    });
                    
                    window.open(
                        `http://localhost:9081/terminal-dynamic.html?${params}`,
                        '_terminal_window',
                        'width=1000,height=700'
                    );
                    
                    console.log('Quick Fix: Terminal geöffnet');
                }
            }, true);
            
            console.log('Quick Fix: Terminal-Handler installiert');
        }
    }, 500);
})();
