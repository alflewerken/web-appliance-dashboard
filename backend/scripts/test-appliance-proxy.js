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

    // Axios-Client mit Auth
    const client = axios.create({
        baseURL: API_URL,
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    
    try {
        // 1. Appliances abrufen

        const appliancesRes = await client.get('/appliances');
        const appliances = appliancesRes.data;

        if (appliances.length === 0) {

            return;
        }
        
        const testAppliance = appliances[0];

        // 2. Health Check

        try {
            const healthRes = await client.get(`/appliances/${testAppliance.id}/health`);

        } catch (error) {

        }
        
        // 3. Proxy Web Interface

        try {
            const proxyRes = await client.get(`/appliances/${testAppliance.id}/proxy/`, {
                maxRedirects: 0,
                validateStatus: status => status < 500
            });

            if (proxyRes.data.message) {

            }
        } catch (error) {

        }
        
        // 4. Test mit aktiviertem Proxy

        try {
            await client.put(`/appliances/${testAppliance.id}`, {
                proxy_enabled: true,
                proxy_protocol: 'http'
            });

        } catch (error) {

        }
        
    } catch (error) {
        console.error(`${colors.red}Test failed:${colors.reset}`, error.message);
    }
}

// Test ausführen
async function runTest() {
    try {

        const token = await login();

        await testProxyEndpoints(token);

    } catch (error) {
        console.error(`${colors.red}Test error:${colors.reset}`, error.message);
        process.exit(1);
    }
}

runTest();