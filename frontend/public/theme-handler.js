// Theme Handler Script - wird automatisch beim Laden der Seite ausgeführt
(function() {

    // Funktion um Theme anzuwenden
    function applyTheme(themeMode) {

        // Entferne alle Theme-Klassen
        document.body.classList.remove('theme-light', 'theme-dark', 'theme-auto');
        
        // Füge neue Theme-Klasse hinzu
        document.body.classList.add(`theme-${themeMode}`);

    }
    
    // Theme aus LocalStorage laden (kein API-Call!)
    function loadThemeFromStorage() {
        try {
            // Versuche Theme aus LocalStorage zu laden
            const savedTheme = localStorage.getItem('dashboard-theme-mode');
            const themeMode = savedTheme || 'dark'; // Default: dark

            applyTheme(themeMode);
            return themeMode;
        } catch (error) {
            console.error('❌ Error loading theme from storage:', error);
            applyTheme('dark');
            return 'dark';
        }
    }
    
    // Theme beim Laden der Seite anwenden
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadThemeFromStorage);
    } else {
        loadThemeFromStorage();
    }
    
    // Listen for theme changes from the app
    window.addEventListener('storage', function(e) {
        if (e.key === 'dashboard-theme-mode' && e.newValue) {

            applyTheme(e.newValue);
        }
    });

})();
