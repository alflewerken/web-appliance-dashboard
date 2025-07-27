// Main routes configuration file
// This file should be required in your app.js/server.js

const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth');
const servicesRoutes = require('./services');
const networkProxyRoutes = require('./networkProxy');
const usersRoutes = require('./users');
const auditRoutes = require('./audit');

// Mount routes
router.use('/auth', authRoutes);
router.use('/services', servicesRoutes);
router.use('/', networkProxyRoutes); // Network proxy at root level
router.use('/users', usersRoutes);
router.use('/audit', auditRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        mode: 'transparent-proxy'
    });
});

module.exports = router;