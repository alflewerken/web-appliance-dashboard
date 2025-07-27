// Debug Upload Request in Browser
// Paste this in browser console while the upload modal is open

(function debugUpload() {
  console.log('🔍 Intercepting Upload Requests...');
  
  // Override fetch to log uploads
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const [url, options] = args;
    
    if (url.includes('/upload')) {
      console.log('📤 Upload Request Detected:');
      console.log('   URL:', url);
      console.log('   Method:', options?.method);
      console.log('   Headers:', options?.headers);
      
      if (options?.body instanceof FormData) {
        console.log('   FormData entries:');
        for (let [key, value] of options.body.entries()) {
          if (value instanceof File) {
            console.log(`     ${key}: File(${value.name}, ${value.size} bytes)`);
          } else {
            console.log(`     ${key}:`, value);
          }
        }
      }
    }
    
    return originalFetch.apply(this, args)
      .then(response => {
        if (url.includes('/upload')) {
          console.log('📥 Upload Response:');
          console.log('   Status:', response.status);
          console.log('   OK:', response.ok);
          
          // Clone response to read it
          const clone = response.clone();
          clone.json().then(data => {
            console.log('   Data:', data);
          }).catch(() => {
            clone.text().then(text => {
              console.log('   Text:', text);
            });
          });
        }
        return response;
      })
      .catch(error => {
        if (url.includes('/upload')) {
          console.error('❌ Upload Error:', error);
        }
        throw error;
      });
  };
  
  console.log('✅ Upload interceptor installed. Now try to upload a file.');
  
  // Also check for existing upload elements
  const uploadAreas = document.querySelectorAll('[class*="drop-zone"], [class*="file-upload"]');
  console.log(`\nFound ${uploadAreas.length} upload areas`);
  
  // Check for Nextcloud-Mac specifically
  const modal = document.querySelector('.file-transfer-modal');
  if (modal) {
    console.log('\n📋 Upload Modal Info:');
    const title = modal.querySelector('h3')?.textContent;
    console.log('   Title:', title);
    
    const pathInput = modal.querySelector('input[type="text"]');
    console.log('   Target Path:', pathInput?.value);
    
    const dropZone = modal.querySelector('[class*="drop-zone"]');
    console.log('   Drop Zone:', dropZone ? 'Found' : 'Not found');
  }
})();
