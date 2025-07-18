// Theme Handler Script - wird automatisch beim Laden der Seite ausgeführt
(function() {
    console.log('🎨 Theme Handler loaded');
    
    // Funktion um Theme anzuwenden
    function applyTheme(themeMode) {
        console.log('🎨 Applying theme:', themeMode);
        
        // Entferne alle Theme-Klassen
        document.body.classList.remove('theme-light', 'theme-dark', 'theme-auto');
        
        // Füge neue Theme-Klasse hinzu
        document.body.classList.add(`theme-${themeMode}`);
        
        console.log('✅ Theme applied:', themeMode);
    }
    
    // Theme aus LocalStorage laden (kein API-Call!)
    function loadThemeFromStorage() {
        try {
            // Versuche Theme aus LocalStorage zu laden
            const savedTheme = localStorage.getItem('dashboard-theme-mode');
            const themeMode = savedTheme || 'dark'; // Default: dark
            console.log('📊 Theme from storage:', themeMode);
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
            console.log('🔄 Theme changed via storage event:', e.newValue);
            applyTheme(e.newValue);
        }
    });
    
    console.log('✅ Theme Handler initialized');
})();
