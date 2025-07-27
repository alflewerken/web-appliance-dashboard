// Debug Terminal Connection
// Teste die Terminal-Verbindung direkt

async function debugTerminal() {
  console.log('🔍 Terminal Debug Test');
  console.log('====================');
  
  // 1. Test Terminal URL
  const terminalUrl = 'http://localhost:9080/terminal/';
  console.log('\n1. Testing terminal endpoint:', terminalUrl);
  
  try {
    const response = await fetch(terminalUrl);
    console.log('   Status:', response.status);
    console.log('   OK:', response.ok);
  } catch (error) {
    console.error('   Error:', error.message);
  }
  
  // 2. Test with parameters
  const paramUrl = 'http://localhost:9080/terminal/?host=192.168.178.70&user=alflewerken&port=22';
  console.log('\n2. Testing with parameters:', paramUrl);
  console.log('   Open this URL in your browser to test');
  
  // 3. Create session via API
  console.log('\n3. Creating terminal session via API...');
  try {
    const sessionResponse = await fetch('http://localhost:9080/api/ssh/terminal-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        hostId: 5  // Host "mac"
      })
    });
    
    const result = await sessionResponse.json();
    console.log('   Response:', result);
  } catch (error) {
    console.error('   Error:', error.message);
  }
  
  console.log('\n====================');
  console.log('Test abgeschlossen');
  console.log('\nÖffne diese URL im Browser:');
  console.log(paramUrl);
}

// Run the test
debugTerminal();
