/**
 * Test-Skript für Backend Proxy (angepasst für Appliances)
 */

const axios = require('axios');

// Konfiguration
const API_URL = process.env.API_URL || 'http://localhost:9080/api';
const USERNAME = process.env.TEST_USERNAME || 'admin';
const PASSWORD = process.env.TEST_PASSWORD || 'admin123';

// Farben für Console-Output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m'
};

async function login() {
    try {
        const response = await axios.post(`${API_URL}/auth/login`, {
            username: USERNAME,
            password: PASSWORD
        });
        return response.data.token;
    } catch (error) {
        throw new Error(`Login failed: ${error.message}`);
    }
}

async function testProxyEndpoints(token) {
    console.log(`${colors.blue}=== Backend Proxy Test (Appliances) ===${colors.reset}\n`);
    
    // Axios-Client mit Auth
    const client = axios.create({
        baseURL: API_URL,
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    
    try {
        // 1. Appliances abrufen
        console.log(`${colors.yellow}1. Fetching appliances...${colors.reset}`);
        const appliancesRes = await client.get('/appliances');
        const appliances = appliancesRes.data;
        console.log(`${colors.green}✓ Found ${appliances.length} appliances${colors.reset}`);
        
        if (appliances.length === 0) {
            console.log(`${colors.red}No appliances found. Please create an appliance first.${colors.reset}`);
            return;
        }
        
        const testAppliance = appliances[0];
        console.log(`${colors.blue}Testing with appliance: ${testAppliance.name} (ID: ${testAppliance.id})${colors.reset}\n`);
        
        // 2. Health Check
        console.log(`${colors.yellow}2. Testing health check...${colors.reset}`);
        try {
            const healthRes = await client.get(`/appliances/${testAppliance.id}/health`);
            console.log(`${colors.green}✓ Health status: ${healthRes.data.status}${colors.reset}`);
        } catch (error) {
            console.log(`${colors.red}✗ Health check failed: ${error.message}${colors.reset}`);
        }
        
        // 3. Proxy Web Interface
        console.log(`\n${colors.yellow}3. Testing web interface proxy...${colors.reset}`);
        try {
            const proxyRes = await client.get(`/appliances/${testAppliance.id}/proxy/`, {
                maxRedirects: 0,
                validateStatus: status => status < 500
            });
            console.log(`${colors.green}✓ Proxy response: ${proxyRes.status}${colors.reset}`);
            if (proxyRes.data.message) {
                console.log(`${colors.blue}Response: ${proxyRes.data.message}${colors.reset}`);
            }
        } catch (error) {
            console.log(`${colors.red}✗ Proxy failed: ${error.message}${colors.reset}`);
        }
        
        // 4. Test mit aktiviertem Proxy
        console.log(`\n${colors.yellow}4. Enabling proxy for appliance...${colors.reset}`);
        try {
            await client.put(`/appliances/${testAppliance.id}`, {
                proxy_enabled: true,
                proxy_protocol: 'http'
            });
            console.log(`${colors.green}✓ Proxy enabled for ${testAppliance.name}${colors.reset}`);
        } catch (error) {
            console.log(`${colors.red}✗ Failed to enable proxy: ${error.message}${colors.reset}`);
        }
        
    } catch (error) {
        console.error(`${colors.red}Test failed:${colors.reset}`, error.message);
    }
}

// Test ausführen
async function runTest() {
    try {
        console.log(`${colors.yellow}Logging in...${colors.reset}`);
        const token = await login();
        console.log(`${colors.green}✓ Login successful${colors.reset}\n`);
        
        await testProxyEndpoints(token);
        
        console.log(`\n${colors.green}Test completed!${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}Test error:${colors.reset}`, error.message);
        process.exit(1);
    }
}

runTest();