// Debug script to check appliance data in browser console
// Run this in the browser console to see the actual data structure

console.log('=== Appliance Data Debug ===');

// Get React DevTools hook
const reactRoot = document.querySelector('#root')._reactRootContainer;
const hooks = reactRoot._internalRoot.current.memoizedState.element.props.children;

// Try to find appliances data
const checkAppliances = () => {
  const appliances = window.__APPLIANCES_DATA__ || [];
  
  console.log('Total appliances:', appliances.length);
  
  const nextcloudMac = appliances.find(app => app.name === 'Nextcloud-Mac');
  
  if (nextcloudMac) {
    console.log('\nNextcloud-Mac data:');
    console.log('- name:', nextcloudMac.name);
    console.log('- serviceStatus:', nextcloudMac.serviceStatus);
    console.log('- service_status:', nextcloudMac.service_status);
    console.log('- statusCommand:', nextcloudMac.statusCommand);
    console.log('- Full object:', nextcloudMac);
  } else {
    console.log('Nextcloud-Mac not found in appliances data');
  }
  
  // Check all services with status commands
  const servicesWithStatus = appliances.filter(app => app.statusCommand);
  console.log('\nServices with status commands:', servicesWithStatus.length);
  
  servicesWithStatus.forEach(app => {
    console.log(`- ${app.name}: serviceStatus=${app.serviceStatus}, service_status=${app.service_status}`);
  });
};

// Alternative method using localStorage or sessionStorage
const checkStorage = () => {
  console.log('\n=== Storage Check ===');
  const stored = localStorage.getItem('appliances') || sessionStorage.getItem('appliances');
  if (stored) {
    const data = JSON.parse(stored);
    console.log('Found appliances in storage:', data);
  }
};

// Check React component props
const checkReactProps = () => {
  console.log('\n=== React Props Check ===');
  
  // Find all elements with data-appliance-id
  document.querySelectorAll('[data-appliance-id]').forEach(el => {
    const id = el.getAttribute('data-appliance-id');
    const name = el.querySelector('.card-title')?.textContent;
    const statusBar = el.querySelector('.service-status-bar');
    
    if (name === 'Nextcloud-Mac' && statusBar) {
      console.log('Found Nextcloud-Mac card:');
      console.log('- Background color:', statusBar.style.backgroundColor);
      console.log('- Title:', statusBar.title);
      console.log('- Element:', statusBar);
    }
  });
};

// Execute checks
checkAppliances();
checkStorage();
checkReactProps();

// Listen for updates
console.log('\n=== Listening for SSE updates ===');
window.addEventListener('service_status_changed', (e) => {
  console.log('Service status changed:', e.detail || e);
});
