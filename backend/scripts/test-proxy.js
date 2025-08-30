/**
 * Test-Skript für Backend Proxy
 * 
 * Testet die verschiedenen Proxy-Funktionen
 */

const axios = require('axios');
const WebSocket = require('ws');

// Konfiguration
const API_URL = process.env.API_URL || 'http://localhost:3001/api';
const TOKEN = process.env.TEST_TOKEN || 'your-test-token-here';

// Axios-Client mit Auth
const client = axios.create({
    baseURL: API_URL,
    headers: {
        'Authorization': `Bearer ${TOKEN}`
    }
});

// Farben für Console-Output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m'
};

async function testProxyEndpoints() {

    try {
        // 1. Services abrufen

        const servicesRes = await client.get('/services/my');
        const services = servicesRes.data;

        if (services.length === 0) {

            return;
        }
        
        const testService = services[0];

        // 2. Health Check

        try {
            const healthRes = await client.get(`/services/${testService.id}/health`);

        } catch (error) {

        }
        
        // 3. Proxy Web Interface

        try {
            const proxyRes = await client.get(`/services/${testService.id}/proxy/`, {
                maxRedirects: 0,
                validateStatus: status => status < 500
            });

        } catch (error) {

        }
        
        // 4. File Browser (nur für SSH-Services)
        if (testService.type === 'ssh') {

            try {
                const filesRes = await client.get(`/services/${testService.id}/files/`);

            } catch (error) {

            }
        }
        
        // 5. WebSocket Terminal Test
        if (testService.type === 'ssh') {

            testWebSocket(testService.id, 'terminal');
        }
        
        // 6. Metrics

        try {
            const metricsRes = await client.get('/services/metrics');

        } catch (error) {

        }
        
    } catch (error) {
        console.error(`${colors.red}Test failed:${colors.reset}`, error.message);
    }
}

function testWebSocket(serviceId, type) {
    const wsUrl = `ws://localhost:3001/api/services/${serviceId}/${type}?token=${TOKEN}`;

    const ws = new WebSocket(wsUrl);
    
    ws.on('open', () => {

        // Test-Kommando senden
        if (type === 'terminal') {
            ws.send('echo "Hello from proxy test"\n');
        }
        
        // Nach 2 Sekunden schließen
        setTimeout(() => {
            ws.close();
        }, 2000);
    });
    
    ws.on('message', (data) => {

    });
    
    ws.on('error', (error) => {

    });
    
    ws.on('close', () => {

    });
}

// Test ausführen
testProxyEndpoints().then(() => {

}).catch(error => {
    console.error(`${colors.red}Test error:${colors.reset}`, error);
    process.exit(1);
});