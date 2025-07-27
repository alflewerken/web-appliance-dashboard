// Proxy Test Suite
// Run with: npm test tests/proxy.test.js

const axios = require('axios');
const WebSocket = require('ws');

const BASE_URL = process.env.API_URL || 'http://localhost:3000/api';
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || 'your-test-jwt-token';

// Test configuration
const TEST_SERVICE_ID = 1;

// Helper function for authenticated requests
const authRequest = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`
    }
});

// Test cases
async function runTests() {
    console.log('Starting Proxy Tests...\n');

    // Test 1: Get service access info
    try {
        console.log('Test 1: Get service access info');
        const response = await authRequest.get(`/services/${TEST_SERVICE_ID}/access-info`);
        console.log('✓ Access info retrieved:', response.data);
    } catch (error) {
        console.error('✗ Failed:', error.response?.data || error.message);
    }

    // Test 2: Web proxy request
    try {
        console.log('\nTest 2: Web proxy request');
        const response = await authRequest.get(`/services/${TEST_SERVICE_ID}/proxy/`);
        console.log('✓ Proxy request successful, status:', response.status);
    } catch (error) {
        console.error('✗ Failed:', error.response?.data || error.message);
    }

    // Test 3: Terminal WebSocket connection
    console.log('\nTest 3: Terminal WebSocket connection');
    await testWebSocketTerminal();

    // Test 4: File listing
    try {
        console.log('\nTest 4: File listing via SFTP');
        const response = await authRequest.get(`/services/${TEST_SERVICE_ID}/files/?list=true`);
        console.log('✓ Files listed:', response.data.files.length, 'items');
    } catch (error) {
        console.error('✗ Failed:', error.response?.data || error.message);
    }

    // Test 5: VNC session creation
    try {
        console.log('\nTest 5: VNC session creation');
        const response = await authRequest.post(`/services/${TEST_SERVICE_ID}/vnc`, {
            type: 'vnc'
        });
        console.log('✓ VNC session created:', response.data.token);
    } catch (error) {
        console.error('✗ Failed:', error.response?.data || error.message);
    }

    // Test 6: Cache statistics
    try {
        console.log('\nTest 6: Get cache statistics');
        const response = await authRequest.get('/services/cache/stats');
        console.log('✓ Cache stats:', response.data);
    } catch (error) {
        console.error('✗ Failed:', error.response?.data || error.message);
    }

    console.log('\nTests completed!');
}

// WebSocket terminal test
function testWebSocketTerminal() {
    return new Promise((resolve) => {
        const ws = new WebSocket(
            `ws://localhost:3000/api/services/${TEST_SERVICE_ID}/terminal`,
            {
                headers: {
                    'Authorization': `Bearer ${AUTH_TOKEN}`
                }
            }
        );

        ws.on('open', () => {
            console.log('✓ WebSocket connected');
            ws.send('echo "Test successful"\n');
        });

        ws.on('message', (data) => {
            console.log('✓ Received:', data.toString().trim());
            ws.close();
        });

        ws.on('close', () => {
            resolve();
        });

        ws.on('error', (error) => {
            console.error('✗ WebSocket error:', error.message);
            resolve();
        });

        // Timeout after 5 seconds
        setTimeout(() => {
            ws.close();
            resolve();
        }, 5000);
    });
}

// Run tests
runTests().catch(console.error);