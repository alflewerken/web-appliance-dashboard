// Quick Fix for FileTransferButton visibility
// Run this in browser console to debug

(function checkFileTransferButton() {
  console.log('🔍 Debugging FileTransferButton Visibility');
  console.log('=========================================');
  
  // 1. Find all appliance cards
  const cards = document.querySelectorAll('[class*="appliance-card"]');
  console.log(`\n1. Found ${cards.length} appliance cards`);
  
  // 2. Check each card for SSH connection
  cards.forEach((card, index) => {
    const nameEl = card.querySelector('[class*="card-title"], h3, .appliance-name');
    const name = nameEl ? nameEl.textContent : `Card ${index}`;
    
    // Look for any upload/transfer buttons
    const uploadBtn = card.querySelector('[class*="file-transfer"], [title*="Datei"], [title*="Upload"]');
    const hasButton = !!uploadBtn;
    
    console.log(`   ${name}: ${hasButton ? '✅ Has upload button' : '❌ No upload button'}`);
    
    if (!hasButton) {
      // Check if card has service control buttons (indicates SSH connection)
      const hasServiceControls = card.querySelector('[class*="service-control"]');
      if (hasServiceControls) {
        console.log(`      ⚠️  Has service controls but no upload button!`);
      }
    }
  });
  
  // 3. Check React props if available
  console.log('\n2. Checking React internals...');
  const reactRoot = document.querySelector('#root');
  if (reactRoot && reactRoot._reactRootContainer) {
    console.log('   React root found');
  }
  
  // 4. Manual test - add button to first card with service controls
  console.log('\n3. To manually add upload button to test:');
  console.log(`
const card = document.querySelector('[class*="service-control"]')?.closest('[class*="appliance-card"]');
if (card) {
  const controls = card.querySelector('[class*="service-control"]')?.parentElement;
  if (controls) {
    const btn = document.createElement('button');
    btn.className = 'file-transfer-button';
    btn.innerHTML = '<svg width="16" height="16"><path d="M7 10l5-5m0 0H8m4 0v4" stroke="currentColor"/></svg>';
    btn.title = 'Datei-Übertragung';
    btn.onclick = () => alert('Upload button clicked!');
    controls.appendChild(btn);
    console.log('✅ Button added!');
  }
}
  `);
  
  // 5. Check component registration
  console.log('\n4. Component checks:');
  console.log('   FileTransferButton:', typeof window.FileTransferButton);
  console.log('   SSHFileUpload:', typeof window.SSHFileUpload);
  
  // 6. Look for specific appliances
  console.log('\n5. Appliances with SSH (based on service controls):');
  document.querySelectorAll('[class*="service-control"]').forEach(el => {
    const card = el.closest('[class*="appliance-card"]');
    if (card) {
      const nameEl = card.querySelector('[class*="card-title"], h3, .appliance-name');
      const name = nameEl ? nameEl.textContent : 'Unknown';
      const hasUpload = !!card.querySelector('[class*="file-transfer"]');
      console.log(`   - ${name}: ${hasUpload ? 'Has upload' : 'NO UPLOAD BUTTON'}`);
    }
  });
})();
