// SOFORT-FIX für Terminal in macOS App
// Kopiere diesen Code und füge ihn in die Browser-Console ein

(function() {
  console.log('🚀 Terminal-Sofortfix wird angewendet...');
  
  // Entferne alle problematischen Event-Listener
  const oldBody = document.body;
  const newBody = oldBody.cloneNode(true);
  oldBody.parentNode.replaceChild(newBody, oldBody);
  
  // Installiere sauberen Handler
  let terminalOpened = false;
  
  document.body.addEventListener('click', function(e) {
    // Finde Terminal-Button
    let btn = e.target;
    while (btn && btn !== document.body) {
      if (btn.classList && 
          (btn.classList.contains('terminal-btn') || 
           btn.title && btn.title.includes('Terminal'))) {
        
        console.log('✅ Terminal-Button erkannt!');
        
        // Verhindere alles andere
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        if (!terminalOpened) {
          terminalOpened = true;
          
          // Öffne Terminal
          const win = window.open(
            'http://localhost:9081/terminal-dynamic.html?host=localhost&user=root&port=22',
            'terminal_' + Date.now(),
            'width=1000,height=700'
          );
          
          if (win) {
            console.log('✅ Terminal-Fenster geöffnet!');
          } else {
            console.error('❌ Popup-Blocker aktiv? Bitte erlauben Sie Popups für localhost:9081');
          }
          
          // Reset nach kurzer Zeit
          setTimeout(() => { terminalOpened = false; }, 1000);
        }
        
        return false;
      }
      btn = btn.parentElement;
    }
  }, true);
  
  console.log('✅ Terminal-Sofortfix installiert!');
  console.log('👉 Klicke jetzt auf einen Terminal-Button');
})();
