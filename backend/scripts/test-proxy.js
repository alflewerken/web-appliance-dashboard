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
    console.log(`${colors.blue}=== Backend Proxy Test ===${colors.reset}\n`);
    
    try {
        // 1. Services abrufen
        console.log(`${colors.yellow}1. Fetching user services...${colors.reset}`);
        const servicesRes = await client.get('/services/my');
        const services = servicesRes.data;
        console.log(`${colors.green}✓ Found ${services.length} services${colors.reset}`);
        
        if (services.length === 0) {
            console.log(`${colors.red}No services found. Please create a service first.${colors.reset}`);
            return;
        }
        
        const testService = services[0];
        console.log(`${colors.blue}Testing with service: ${testService.name} (ID: ${testService.id})${colors.reset}\n`);
        
        // 2. Health Check
        console.log(`${colors.yellow}2. Testing health check...${colors.reset}`);
        try {
            const healthRes = await client.get(`/services/${testService.id}/health`);
            console.log(`${colors.green}✓ Health status: ${healthRes.data.status}${colors.reset}`);
        } catch (error) {
            console.log(`${colors.red}✗ Health check failed: ${error.message}${colors.reset}`);
        }
        
        // 3. Proxy Web Interface
        console.log(`\n${colors.yellow}3. Testing web interface proxy...${colors.reset}`);
        try {
            const proxyRes = await client.get(`/services/${testService.id}/proxy/`, {
                maxRedirects: 0,
                validateStatus: status => status < 500
            });
            console.log(`${colors.green}✓ Proxy response: ${proxyRes.status} ${proxyRes.statusText}${colors.reset}`);
        } catch (error) {
            console.log(`${colors.red}✗ Proxy failed: ${error.message}${colors.reset}`);
        }
        
        // 4. File Browser (nur für SSH-Services)
        if (testService.type === 'ssh') {
            console.log(`\n${colors.yellow}4. Testing file browser...${colors.reset}`);
            try {
                const filesRes = await client.get(`/services/${testService.id}/files/`);
                console.log(`${colors.green}✓ Found ${filesRes.data.files.length} files/directories${colors.reset}`);
            } catch (error) {
                console.log(`${colors.red}✗ File browser failed: ${error.message}${colors.reset}`);
            }
        }
        
        // 5. WebSocket Terminal Test
        if (testService.type === 'ssh') {
            console.log(`\n${colors.yellow}5. Testing WebSocket terminal...${colors.reset}`);
            testWebSocket(testService.id, 'terminal');
        }
        
        // 6. Metrics
        console.log(`\n${colors.yellow}6. Testing metrics endpoint...${colors.reset}`);
        try {
            const metricsRes = await client.get('/services/metrics');
            console.log(`${colors.green}✓ Metrics retrieved:${colors.reset}`);
            console.log(`  - SSH Connections: ${metricsRes.data.connections.ssh}`);
            console.log(`  - SFTP Sessions: ${metricsRes.data.connections.sftp}`);
            console.log(`  - VNC Sessions: ${metricsRes.data.connections.vnc}`);
        } catch (error) {
            console.log(`${colors.red}✗ Metrics failed (admin only?): ${error.message}${colors.reset}`);
        }
        
    } catch (error) {
        console.error(`${colors.red}Test failed:${colors.reset}`, error.message);
    }
}

function testWebSocket(serviceId, type) {
    const wsUrl = `ws://localhost:3001/api/services/${serviceId}/${type}?token=${TOKEN}`;
    console.log(`Connecting to: ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl);
    
    ws.on('open', () => {
        console.log(`${colors.green}✓ WebSocket connected${colors.reset}`);
        
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
        console.log(`${colors.blue}WebSocket received: ${data.toString().trim()}${colors.reset}`);
    });
    
    ws.on('error', (error) => {
        console.log(`${colors.red}✗ WebSocket error: ${error.message}${colors.reset}`);
    });
    
    ws.on('close', () => {
        console.log(`${colors.yellow}WebSocket closed${colors.reset}`);
    });
}

// Test ausführen
testProxyEndpoints().then(() => {
    console.log(`\n${colors.green}Test completed!${colors.reset}`);
}).catch(error => {
    console.error(`${colors.red}Test error:${colors.reset}`, error);
    process.exit(1);
});