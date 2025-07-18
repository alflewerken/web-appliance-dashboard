// Debug-Skript für Terminal-Probleme in der Mac-App
// Füge dies in die Browser-Konsole ein, wenn die Mac-App läuft

console.log('=== Terminal Debug Info ===');

// Überprüfe alle iframes
const iframes = document.querySelectorAll('iframe');
console.log('Anzahl iframes:', iframes.length);
iframes.forEach((iframe, index) => {
  console.log(`iframe ${index}:`, {
    src: iframe.src,
    id: iframe.id,
    className: iframe.className
  });
});

// Überprüfe Terminal-Container
const terminalContainers = document.querySelectorAll('[class*="terminal"]');
console.log('Terminal-Container gefunden:', terminalContainers.length);

// Überwache neue Fenster
const originalOpen = window.open;
window.open = function(...args) {
  console.log('window.open aufgerufen mit:', args);
  return originalOpen.apply(window, args);
};

// Überwache Navigation
window.addEventListener('beforeunload', (e) => {
  console.log('Navigation erkannt');
});

console.log('Debug-Skript aktiv');
