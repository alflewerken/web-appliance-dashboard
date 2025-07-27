// Debug Helper for File Upload
// Füge dieses Script in die Browser-Konsole ein, um den Upload zu debuggen

(function debugFileUpload() {
  console.log('🔍 File Upload Debug Helper');
  console.log('=========================');
  
  // 1. Check if token exists
  const token = localStorage.getItem('token');
  console.log('1. Auth Token:', token ? `✅ Found (${token.substring(0, 20)}...)` : '❌ Not found');
  
  // 2. Find upload buttons
  const uploadButtons = document.querySelectorAll('[title*="Datei"], [title*="Upload"], .file-transfer-button');
  console.log('2. Upload Buttons found:', uploadButtons.length);
  uploadButtons.forEach((btn, i) => {
    console.log(`   Button ${i}:`, btn.className, btn.title || 'No title');
  });
  
  // 3. Check if SSHFileUpload component exists
  const hasSSHUpload = !!window.SSHFileUpload || !!document.querySelector('[class*="ssh-file-upload"]');
  console.log('3. SSHFileUpload component:', hasSSHUpload ? '✅ Found' : '❌ Not found');
  
  // 4. Test upload endpoint
  console.log('\n4. Testing upload endpoint...');
  fetch('/api/ssh/upload-test', {
    method: 'POST',
    headers: {
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    }
  })
  .then(res => res.json())
  .then(data => console.log('   Upload test response:', data))
  .catch(err => console.error('   Upload test error:', err));
  
  // 5. Manual file upload test
  console.log('\n5. To test manual upload:');
  console.log(`
// Create test file
const file = new File(['Test content'], 'test.txt', { type: 'text/plain' });
const formData = new FormData();
formData.append('file', file);
formData.append('hostId', '5');
formData.append('targetPath', '/tmp');

// Upload
fetch('/api/ssh/upload', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${token || 'YOUR_TOKEN'}'
  },
  body: formData
})
.then(res => res.json())
.then(console.log)
.catch(console.error);
  `);
  
  // 6. Check React DevTools
  console.log('\n6. Additional checks:');
  console.log('   - Is React DevTools installed?', !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__);
  console.log('   - Current URL:', window.location.href);
  console.log('   - API Base URL:', window.location.origin);
})();
