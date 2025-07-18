const WebSocket = require('ws');

console.log('Testing WebSocket connection to terminal...');

const ws = new WebSocket('ws://localhost:3002/api/terminal-session');

ws.on('open', () => {
    console.log('✅ WebSocket connected!');
    
    // Send init message
    const initMsg = {
        type: 'init',
        authToken: 'test-token',
        applianceId: 1
    };
    
    console.log('Sending init message:', initMsg);
    ws.send(JSON.stringify(initMsg));
});

ws.on('message', (data) => {
    console.log('📨 Received:', data.toString());
});

ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
});

ws.on('close', (code, reason) => {
    console.log(`🔌 WebSocket closed - Code: ${code}, Reason: ${reason}`);
    process.exit();
});

// Timeout after 5 seconds
setTimeout(() => {
    console.log('⏱️ Timeout - closing connection');
    ws.close();
}, 5000);
