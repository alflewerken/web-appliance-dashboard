// Main server file - modular structure
require('dotenv').config();
const express = require('express');
const expressWs = require('express-ws'); // Add WebSocket support
const path = require('path');
const { configureCORS, securityHeaders } = require('./utils/security');

const { logger } = require('./utils/logger');

// Import utilities
const pool = require('./utils/database');
const { createRequiredDirectories } = require('./utils/middleware');
const { verifyToken } = require('./utils/auth');
const { getClientIp } = require('./utils/getClientIp');
const SSHAutoInitializer = require('./utils/sshAutoInitializer');
const statusChecker = require('./utils/statusChecker');
const { initializeServices } = require('./utils/serviceInitializer');
const runMigrations = require('./utils/runMigrations');

// Import route modules
const appliancesRouter = require('./routes/appliances');
const categoriesRouter = require('./routes/categories');
const settingsRouter = require('./routes/settings');
const backgroundRouter = require('./routes/background');
const backupRouter = require('./routes/backup');
const backupEnhancedRouter = require('./routes/backupEnhanced');
// const servicesRouter = require('./routes/services'); // Removed - using applianceProxy instead
const terminalTokenRouter = require('./routes/terminalToken');
const { router: terminalRouter } = require('./routes/terminal');
const terminalRedirectRouter = require('./routes/terminalRedirect');
const terminalSessionRouter = require('./routes/terminalSession');
const { router: sseRouter } = require('./routes/sse');
const authRouter = require('./routes/auth');
const browserRouter = require('./routes/browser');
const commandsRouter = require('./routes/commands');
const auditLogsRouter = require('./routes/auditLogs');
const auditRestoreRouter = require('./routes/auditRestore');
const statusCheckRouter = require('./routes/statusCheck');
const restoreRouter = require('./routes/restore');
const rolesRouter = require('./routes/roles');
const guacamoleRouter = require('./routes/guacamole');

// Import Swagger configuration
const { swaggerUi, swaggerSpec } = require('./swagger/swaggerConfig');

const app = express();
const PORT = process.env.PORT || 3001;

// Enable WebSocket support
expressWs(app);

// Trust proxy - important for SSE and WebSocket behind nginx
// Use environment variable or default to 1 (nginx only)
const trustProxyHops = process.env.TRUST_PROXY_HOPS || '1';
app.set('trust proxy', parseInt(trustProxyHops));

// Initialize directories before starting server
createRequiredDirectories();

// Middleware with extended limits for backup files and large images
app.use(configureCORS());
app.use(securityHeaders);

// Add client IP to all requests
app.use((req, res, next) => {
  req.clientIp = getClientIp(req);
  next();
});

// Debug middleware for SSH upload
app.use((req, res, next) => {
  if (req.path.includes('/ssh/upload') || req.url.includes('/ssh/upload')) {
    console.log('DEBUG: SSH Upload Request:', {
      method: req.method,
      path: req.path,
      url: req.url,
      originalUrl: req.originalUrl,
      baseUrl: req.baseUrl
    });
  }
  next();
});

app.use(
  express.json({
    limit: '10gb', // Increased limit for large files like Linux distributions
    extended: true,
  })
);
app.use(
  express.urlencoded({
    limit: '10gb', // Increased urlencoded limit too
    extended: true,
  })
);

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    await pool.execute('SELECT 1');
    res.json({ status: 'healthy', database: 'connected' });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({ status: 'unhealthy', database: 'disconnected' });
  }
});

// ====================================================================
// API ROUTES - Modular Organization
// ====================================================================

// Public auth check endpoint
app.get('/api/auth/check', (req, res) => {
  res.json({ authRequired: true });
});

// ====================================================================
// API ROUTES - Modular Organization
// ====================================================================

// Swagger UI route (no authentication required)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Auth routes (no authentication required)
app.use('/api/auth', authRouter);

// Guacamole auth validation (special case for nginx auth_request)
const authGuacamoleRouter = require('./routes/authGuacamole');
app.use('/api/auth', authGuacamoleRouter);

// All other routes require authentication

// Appliance Proxy Routes MUST come BEFORE basic routes to handle /proxy/* paths
const nativeProxyRouter = require('./routes/nativeProxy'); // Native HTTP Proxy
console.log('[SERVER] Mounting nativeProxyRouter on /api/appliances');
app.use('/api/appliances', nativeProxyRouter);

// Basic appliance routes after proxy routes - use conditional verifyToken
const skipVerifyTokenForProxy = require('./middleware/skipVerifyTokenForProxy');
console.log('[SERVER] Mounting appliancesRouter with conditional verifyToken on /api/appliances');
app.use('/api/appliances', skipVerifyTokenForProxy, appliancesRouter);
app.use('/api/categories', verifyToken, categoriesRouter);
app.use('/api/settings', verifyToken, settingsRouter);
app.use('/api/background', verifyToken, backgroundRouter);
// Services compatibility routes
const servicesRouter = require('./routes/services');
app.use('/api/services', verifyToken, servicesRouter);
app.use('/api/statusCheck', verifyToken, statusCheckRouter);

// SSE route MUST be before general API routes to avoid conflicts
app.use('/api/sse', sseRouter); // SSE doesn't need verifyToken middleware because it uses query param

// Configuration Routes
const configRouter = require('./routes/config');
app.use('/api/config', verifyToken, configRouter);

app.use('/api/terminal', verifyToken, terminalRouter);
app.use('/api/terminal', verifyToken, terminalSessionRouter);
app.use('/terminal', terminalTokenRouter); // Terminal token endpoint without /api prefix
app.use('/terminal', terminalRedirectRouter); // Terminal redirect without /api prefix
app.use('/api/browser', verifyToken, browserRouter);
app.use('/api/commands', verifyToken, commandsRouter);
app.use('/api/auditLogs', verifyToken, auditLogsRouter);
app.use('/api/auditRestore', verifyToken, auditRestoreRouter);

// Hosts routes
const hostsRouter = require('./routes/hosts');
app.use('/api/hosts', verifyToken, hostsRouter);

// SSH Keys routes
const sshKeysRouter = require('./routes/sshKeys');
app.use('/api/sshKeys', verifyToken, sshKeysRouter);

// SSH routes (including file upload)
const sshRouter = require('./routes/ssh');
app.use('/api/ssh', verifyToken, sshRouter);

app.use('/api/restore', verifyToken, restoreRouter);
app.use('/api/roles', verifyToken, rolesRouter); // Neue Rollen-Routen
app.use('/api/guacamole', verifyToken, guacamoleRouter); // Guacamole Integration

// RustDesk Integration
const rustdeskRouter = require('./routes/rustdesk');
app.use('/api/rustdesk', rustdeskRouter); // RustDesk hat eigene Auth in Route

// RustDesk Installation Route
const rustdeskInstallRouter = require('./routes/rustdeskInstall');
app.use('/api/rustdeskInstall', rustdeskInstallRouter);

// Network Proxy Routes (transparent proxy) - MUST be after specific routes
const networkProxyRouter = require('./routes/networkProxy');
app.use('/api', verifyToken, networkProxyRouter);

// Mount backup routes (both backup and restore) - also require auth
app.use('/api', verifyToken, backupRouter);
app.use('/api', verifyToken, backupEnhancedRouter);

// Encryption utilities (for fixing double encryption issues)
const encryptionUtilsRouter = require('./routes/encryption-utils');
app.use('/api/encryption', verifyToken, encryptionUtilsRouter);

// ====================================================================
// ERROR HANDLING MIDDLEWARE
// ====================================================================

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server with WebSocket support
const http = require('http');
const server = http.createServer(app);

// Import the standard terminal WebSocket handler
const { setupTerminalWebSocket } = require('./utils/terminalSession');

// Setup standard terminal WebSocket
setupTerminalWebSocket(server);

server.listen(PORT, async () => {
  logger.info(`Backend server running on port ${PORT}`);
  logger.info(`Health check available at http://localhost:${PORT}/api/health`);
  logger.info(`Swagger documentation available at http://localhost:${PORT}/api-docs`);

  // Set server timeout to 5 minutes for long-running operations
  server.timeout = 300000;
  server.keepAliveTimeout = 310000;
  server.headersTimeout = 320000;

  // Run database migrations
  try {
    await runMigrations();
  } catch (error) {
    logger.error('Failed to run migrations:', error);
  }

  // Use robust initialization sequence
  initializeServices()
    .then(success => {
      if (success) {
        logger.info('All services initialized successfully');
      } else {
        logger.warn('Some services failed to initialize');
      }
    })
    .catch(error => {
      logger.error('Service initialization error:', error);
    });
});
