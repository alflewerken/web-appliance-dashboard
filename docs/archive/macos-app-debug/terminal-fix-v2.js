// Verbesserter Terminal-Fix mit Service-Daten-Extraktion
(function() {
  console.log('🚀 Terminal-Fix V2 mit Service-Daten...');
  
  // Entferne problematische Listener
  const oldBody = document.body;
  const newBody = oldBody.cloneNode(true);
  oldBody.parentNode.replaceChild(newBody, oldBody);
  
  // Hilfsfunktion um Service-Daten zu finden
  function findServiceData(element) {
    let serviceCard = element.closest('.appliance-card, .service-card, [class*="card"]');
    if (!serviceCard) return null;
    
    // Versuche Service-Name zu finden
    const titleEl = serviceCard.querySelector('h3, .card-title, [class*="title"]');
    const serviceName = titleEl ? titleEl.textContent.trim() : 'Unknown';
    
    console.log('Service gefunden:', serviceName);
    
    // Standard SSH-Daten basierend auf Service
    let sshData = {
      host: 'localhost',
      user: 'root',
      port: '22'
    };
    
    // Spezielle Konfigurationen für bekannte Services
    if (serviceName.toLowerCase().includes('mac')) {
      // Für Mac-Services verwende den lokalen Mac
      sshData = {
        host: 'localhost',
        user: 'alflewerken', // Dein Mac-Username
        port: '22'
      };
    } else if (serviceName.toLowerCase().includes('proxmox')) {
      sshData = {
        host: '192.168.178.70', // Proxmox IP aus deinem Screenshot
        user: 'root',
        port: '22'
      };
    }
    
    return { serviceName, sshData };
  }
  
  // Neuer Handler
  document.body.addEventListener('click', function(e) {
    let btn = e.target;
    while (btn && btn !== document.body) {
      if (btn.classList && (btn.classList.contains('terminal-btn') || 
          btn.title && btn.title.includes('Terminal'))) {
        
        e.preventDefault();
        e.stopPropagation();
        
        // Extrahiere Service-Daten
        const serviceInfo = findServiceData(btn);
        let params;
        
        if (serviceInfo && serviceInfo.sshData) {
          console.log('Verwende SSH-Daten:', serviceInfo.sshData);
          params = new URLSearchParams({
            host: serviceInfo.sshData.host,
            user: serviceInfo.sshData.user,
            port: serviceInfo.sshData.port,
            token: localStorage.getItem('token') || ''
          });
        } else {
          // Fallback
          params = new URLSearchParams({
            host: 'localhost',
            user: 'alflewerken',
            port: '22',
            token: localStorage.getItem('token') || ''
          });
        }
        
        const url = 'http://localhost:9081/terminal-dynamic.html?' + params.toString();
        console.log('Öffne Terminal:', url);
        
        window.open(url, 'terminal_' + Date.now(), 'width=1000,height=700');
        
        console.log('✅ Terminal für', serviceInfo?.serviceName || 'Service', 'geöffnet!');
        return false;
      }
      btn = btn.parentElement;
    }
  }, true);
  
  // Überschreibe auch handleTerminalOpen falls vorhanden
  if (window.handleTerminalOpen) {
    const original = window.handleTerminalOpen;
    window.handleTerminalOpen = function(appliance) {
      console.log('handleTerminalOpen überschrieben, Appliance:', appliance);
      
      let params = new URLSearchParams();
      
      // Versuche SSH-Daten aus der Appliance zu extrahieren
      if (appliance) {
        if (appliance.ssh_host) {
          params.append('host', appliance.ssh_host.hostname || 'localhost');
          params.append('user', appliance.ssh_host.username || 'root');
          params.append('port', appliance.ssh_host.port || '22');
        } else if (appliance.sshHost) {
          params.append('host', appliance.sshHost || 'localhost');
          params.append('user', appliance.sshUser || 'root');
          params.append('port', appliance.sshPort || '22');
        } else {
          // Fallback basierend auf Service-Name
          if (appliance.name && appliance.name.toLowerCase().includes('mac')) {
            params.append('host', 'localhost');
            params.append('user', 'alflewerken');
            params.append('port', '22');
          } else {
            params.append('host', 'localhost');
            params.append('user', 'root');
            params.append('port', '22');
          }
        }
      }
      
      params.append('token', localStorage.getItem('token') || '');
      
      const url = 'http://localhost:9081/terminal-dynamic.html?' + params.toString();
      window.open(url, '_blank', 'width=1000,height=700');
      
      return false; // Verhindere Modal
    };
  }
  
  console.log('✅ Terminal-Fix V2 installiert!');
  console.log('👉 SSH-Daten werden automatisch aus dem Service extrahiert');
})();
