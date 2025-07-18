// Injiziere dieses Skript in die Mac-App, um Terminal-Links zu fixen
(function() {
  // Erkenne ob wir in der Electron-App laufen
  const isElectron = window.navigator.userAgent.includes('Electron');
  
  if (!isElectron) return;
  
  console.log('Mac-App Terminal-Fix aktiviert');
  
  // Überwache alle Klicks
  document.addEventListener('click', function(e) {
    let target = e.target;
    
    // Finde das nächste Link-Element
    while (target && target.tagName !== 'A' && target.tagName !== 'BUTTON') {
      target = target.parentElement;
    }
    
    if (!target) return;
    
    // Prüfe ob es ein Terminal-Button ist
    const isTerminalButton = 
      target.textContent?.includes('Terminal') ||
      target.querySelector?.('[class*="terminal"]') ||
      target.closest?.('[class*="terminal-button"]') ||
      target.closest?.('[title*="Terminal"]');
    
    if (isTerminalButton) {
      console.log('Terminal-Button erkannt');
      e.preventDefault();
      e.stopPropagation();
      
      // Öffne Terminal in neuem Fenster statt iframe
      window.open('http://localhost:9081/terminal/', '_blank', 'width=1000,height=700');
    }
  }, true);
  
  // Override für React-Portal basierte Terminals
  const originalCreatePortal = window.ReactDOM?.createPortal;
  if (originalCreatePortal) {
    window.ReactDOM.createPortal = function(element, container) {
      // Prüfe ob es ein Terminal-Portal ist
      if (element?.props?.className?.includes('terminal')) {
        console.log('Terminal-Portal erkannt, öffne in neuem Fenster');
        window.open('http://localhost:9081/terminal/', '_blank', 'width=1000,height=700');
        return null;
      }
      return originalCreatePortal.apply(this, arguments);
    };
  }
})();
