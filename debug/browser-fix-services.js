// Browser Debug Script - Fix Services Loading
// Füge dieses Script in die Browser-Konsole ein

(async function fixServices() {
  console.log('🔧 Fixing Services Loading...');
  
  // 1. Clear all caches
  console.log('\n1. Clearing caches...');
  
  // Clear service worker cache if exists
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for(let registration of registrations) {
      registration.unregister();
      console.log('   Service Worker unregistered');
    }
  }
  
  // 2. Get current token
  const token = localStorage.getItem('token');
  console.log('\n2. Current token:', token ? `${token.substring(0, 20)}...` : 'No token');
  
  // 3. Test API directly
  console.log('\n3. Testing API directly...');
  try {
    const response = await fetch('/api/services', {
      method: 'GET',
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      cache: 'no-store'
    });
    
    console.log('   Status:', response.status);
    console.log('   Status Text:', response.statusText);
    
    if (response.status === 502) {
      console.log('   ❌ 502 Bad Gateway - Backend might be down');
      
      // Try health check
      const healthResponse = await fetch('/api/health', { cache: 'no-store' });
      console.log('   Health check:', healthResponse.status);
      
      if (healthResponse.ok) {
        const health = await healthResponse.json();
        console.log('   Health data:', health);
      }
    } else if (response.ok) {
      const data = await response.json();
      console.log('   ✅ Services loaded:', data.services?.length || 0);
      console.log('   First service:', data.services?.[0]);
    } else {
      const error = await response.text();
      console.log('   Error:', error);
    }
  } catch (err) {
    console.error('   Fetch error:', err);
  }
  
  // 4. Try alternative endpoints
  console.log('\n4. Testing alternative endpoints...');
  const endpoints = ['/api/appliances', '/api/services/check-all', '/api/health'];
  
  for (const endpoint of endpoints) {
    try {
      const resp = await fetch(endpoint, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        },
        cache: 'no-store'
      });
      console.log(`   ${endpoint}: ${resp.status} ${resp.statusText}`);
    } catch (err) {
      console.log(`   ${endpoint}: Error - ${err.message}`);
    }
  }
  
  // 5. Force reload without cache
  console.log('\n5. To force reload without cache:');
  console.log('   - Chrome/Edge: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)');
  console.log('   - Or open DevTools, right-click reload button, select "Empty Cache and Hard Reload"');
  
  // 6. Manual reload function
  window.reloadServices = async function() {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/services', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache'
      },
      cache: 'reload'
    });
    const data = await response.json();
    console.log('Services:', data);
    return data;
  };
  
  console.log('\n✅ Debug complete. Run window.reloadServices() to manually load services.');
})();
