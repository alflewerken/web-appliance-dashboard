// Kopiere diesen Text manuell in die Console
// oder tippe: allow pasting

// Terminal-Fix für macOS App
const oldBody = document.body;
const newBody = oldBody.cloneNode(true);
oldBody.parentNode.replaceChild(newBody, oldBody);

document.body.addEventListener('click', function(e) {
  let btn = e.target;
  while (btn && btn !== document.body) {
    if (btn.classList && (btn.classList.contains('terminal-btn') || 
        btn.title && btn.title.includes('Terminal'))) {
      
      e.preventDefault();
      e.stopPropagation();
      
      const params = new URLSearchParams({
        host: 'host.docker.internal',
        user: 'alflewerken',
        port: '22',
        token: localStorage.getItem('token') || ''
      });
      
      window.open(
        'http://localhost:9081/terminal-dynamic.html?' + params.toString(),
        'terminal_' + Date.now(),
        'width=1000,height=700'
      );
      
      console.log('Terminal geöffnet!');
      return false;
    }
    btn = btn.parentElement;
  }
}, true);

console.log('Terminal-Fix aktiv!');
