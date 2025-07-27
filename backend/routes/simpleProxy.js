// Minimale Test-Route für Proxy
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const axios = require('axios');

// Test-Route
router.get('/test', (req, res) => {
    res.json({ message: 'Simple proxy works!' });
});

// Einfache Proxy-Route
router.all('/:id/proxy/*', authenticateToken, async (req, res) => {
    try {
        const applianceId = req.params.id;
        const path = req.params[0] || '';
        
        console.log(`[SIMPLE PROXY] Request for appliance ${applianceId}, path: ${path}`);
        
        // Hardcoded für Test - Appliance 45
        if (applianceId === '45') {
            // Verwende die IP direkt, nicht localhost
            const targetUrl = `http://192.168.178.70:8080${path ? '/' + path : ''}`;
            console.log(`[SIMPLE PROXY] Forwarding to: ${targetUrl}`);
            
            // Simple proxy request
            const response = await axios({
                method: req.method,
                url: targetUrl,
                headers: {
                    ...req.headers,
                    host: '192.168.178.70:8080'
                },
                data: req.body,
                validateStatus: () => true,
                responseType: 'stream'
            });
            
            // Forward response
            res.status(response.status);
            Object.entries(response.headers).forEach(([key, value]) => {
                if (key !== 'content-encoding') {
                    res.setHeader(key, value);
                }
            });
            
            response.data.pipe(res);
        } else {
            res.status(404).json({ error: 'Appliance not found' });
        }
    } catch (error) {
        console.error('[SIMPLE PROXY] Error:', error.message);
        res.status(500).json({ error: 'Proxy error', details: error.message });
    }
});

module.exports = router;
