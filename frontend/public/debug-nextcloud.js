// Erweiterte Debug-Funktion für Nextcloud-Mac
(function debugNextcloudMac() {
  console.log('=== NEXTCLOUD-MAC DEEP DEBUG ===');
  
  // Finde die Nextcloud-Mac Karte
  const cards = Array.from(document.querySelectorAll('.appliance-card'));
  const nextcloudCard = cards.find(card => 
    card.querySelector('.card-title')?.textContent === 'Nextcloud-Mac'
  );
  
  if (!nextcloudCard) {
    console.log('❌ Nextcloud-Mac card not found');
    return;
  }
  
  // React Fiber finden
  const reactFiberKey = Object.keys(nextcloudCard).find(key => 
    key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance')
  );
  
  if (reactFiberKey) {
    const fiber = nextcloudCard[reactFiberKey];
    let current = fiber;
    
    // Suche nach den Props
    while (current) {
      if (current.memoizedProps && current.memoizedProps.appliance) {
        const appliance = current.memoizedProps.appliance;
        console.log('Found appliance data:');
        console.log('- name:', appliance.name);
        console.log('- serviceStatus:', appliance.serviceStatus);
        console.log('- service_status:', appliance.service_status);
        console.log('- statusCommand:', appliance.statusCommand);
        console.log('- status_command:', appliance.status_command);
        console.log('- Full appliance object:', appliance);
        break;
      }
      current = current.return;
    }
  }
  
  // Status Bar Check
  const statusBar = nextcloudCard.querySelector('.service-status-bar');
  if (statusBar) {
    console.log('\nStatus Bar Info:');
    console.log('- Background color:', statusBar.style.backgroundColor);
    console.log('- RGB value:', window.getComputedStyle(statusBar).backgroundColor);
    console.log('- Title:', statusBar.title);
  }
  
  // Check localStorage/sessionStorage
  console.log('\nStorage Check:');
  ['localStorage', 'sessionStorage'].forEach(storage => {
    const keys = Object.keys(window[storage]);
    keys.forEach(key => {
      if (key.includes('appliance') || key.includes('nextcloud')) {
        console.log(`${storage}.${key}:`, window[storage].getItem(key));
      }
    });
  });
})();
