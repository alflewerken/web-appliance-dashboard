const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const proxyAuth = require('../middleware/proxyAuth');
const proxyEngine = require('../utils/proxyEngine');
const sessionCache = require('../utils/sessionCache');
const { logger } = require('../utils/logger');
const Service = require('../models/Service');
const { createAuditLog } = require('../utils/auditLogger');

/**
 * Web Interface Proxy
 * Proxies HTTP/HTTPS requests to service web interfaces
 */
router.all('/services/:id/proxy/*', 
    authenticateToken,
    proxyAuth.checkServiceAccess,
    proxyAuth.rateLimit,
    async (req, res) => {
        try {
            const serviceId = req.params.id;
            const targetPath = req.params[0] || '/';
            const service = req.service; // Set by proxyAuth middleware

            // Check if service has SSH configuration (required for HTML rewriting)
            const hasSSH = service.ssh_host && service.ssh_port;

            // Build target URL
            const protocol = service.use_https ? 'https' : 'http';
            const targetUrl = `${protocol}://${service.ip_address}:${service.port}/${targetPath}`;

            // Get stored session cookies
            const sessionCookies = sessionCache.getHTTPSession(serviceId, req.user.id);
            const cookieString = sessionCookies ? 
                Object.entries(sessionCookies).map(([k, v]) => `${k}=${v}`).join('; ') : '';

            // Proxy options
            const proxyOptions = {
                method: req.method,
                headers: req.headers,
                data: req.body,
                cookies: cookieString,
                responseType: 'stream',
                rewriteHtml: hasSSH, // Only rewrite if SSH is configured
                baseUrl: `/api/services/${serviceId}/proxy`
            };

            // Make proxy request
            const response = await proxyEngine.proxyRequest(targetUrl, proxyOptions);

            // Update session cookies
            if (response.cookies) {
                sessionCache.updateHTTPSession(serviceId, req.user.id, response.cookies);
            }

            // Set response headers
            Object.entries(response.headers).forEach(([key, value]) => {
                res.setHeader(key, value);
            });

            // Set status code
            res.status(response.status);

            // Stream response
            if (response.data.pipe) {
                response.data.pipe(res);
            } else {
                res.send(response.data);
            }

            // Log access
            await createAuditLog(
                req.user.id,
                'proxy_access',
                'service',
                serviceId,
                {
                    service_id: serviceId,
                    target_url: targetUrl,
                    method: req.method,
                    status: response.status
                },
                req.ip
            );

        } catch (error) {
            logger.error('Proxy error:', {
                serviceId: req.params.id,
                error: error.message
            });

            res.status(502).json({
                error: 'Proxy Error',
                message: 'Failed to connect to service'
            });
        }
    }
);
/**
 * Terminal WebSocket Proxy
 * Provides SSH terminal access through WebSocket
 */
router.ws('/services/:id/terminal',
    authenticateToken,
    proxyAuth.checkServiceAccess,
    async (ws, req) => {
        const serviceId = req.params.id;
        const service = req.service;
        let sshConnection = null;
        let stream = null;

        try {
            // Get or create SSH connection
            sshConnection = await sessionCache.getSSHConnection(serviceId, {
                host: service.ssh_host,
                port: service.ssh_port || 22,
                username: service.ssh_username,
                password: service.ssh_password,
                privateKey: service.ssh_private_key
            });

            // Create shell stream
            sshConnection.shell({
                term: 'xterm-256color',
                cols: 80,
                rows: 24
            }, (err, sshStream) => {
                if (err) {
                    logger.error('SSH shell error:', err);
                    ws.close(1011, 'SSH shell creation failed');
                    return;
                }

                stream = sshStream;

                // Handle SSH stream data
                stream.on('data', (data) => {
                    if (ws.readyState === ws.OPEN) {
                        ws.send(data.toString('utf8'));
                    }
                });

                stream.on('close', () => {
                    ws.close(1000, 'SSH connection closed');
                });

                // Handle WebSocket messages
                ws.on('message', (msg) => {
                    if (stream && !stream.destroyed) {
                        stream.write(msg);
                    }
                });

                ws.on('close', () => {
                    if (stream && !stream.destroyed) {
                        stream.end();
                    }
                });

                // Send initial prompt
                ws.send('\r\nTerminal connected to ' + service.name + '\r\n');
            });

            // Log terminal access
            await createAuditLog(
                req.user.id,
                'terminal_access',
                'service',
                serviceId,
                {
                    service_id: serviceId,
                    service_name: service.name
                },
                req.ip
            );

        } catch (error) {
            logger.error('Terminal connection error:', {
                serviceId,
                error: error.message
            });
            ws.close(1011, 'Terminal connection failed');
        }
    }
);

/**
 * VNC/RDP Guacamole Integration
 * Returns Guacamole connection parameters
 */
router.post('/services/:id/vnc',
    authenticateToken,
    proxyAuth.checkServiceAccess,
    proxyAuth.rateLimit,
    async (req, res) => {
        try {
            const serviceId = req.params.id;
            const service = req.service;
            const connectionType = req.body.type;

            // Check for existing session
            let sessionData = sessionCache.getVNCSession(serviceId);
            
            if (!sessionData) {
                // Create new Guacamole session
                sessionData = {
                    token: generateGuacamoleToken(),
                    connection: {
                        protocol: connectionType,
                        parameters: {}
                    }
                };

                if (connectionType === 'vnc') {
                    sessionData.connection.parameters = {
                        hostname: service.ip_address,
                        port: service.vnc_port || 5900,
                        password: service.vnc_password || ''
                    };
                } else if (connectionType === 'rdp') {
                    sessionData.connection.parameters = {
                        hostname: service.ip_address,
                        port: service.rdp_port || 3389,
                        username: service.rdp_username || '',
                        password: service.rdp_password || '',
                        security: 'any',
                        'ignore-cert': true
                    };
                }

                // Store session
                sessionCache.setVNCSession(serviceId, sessionData);
            }

            // Log VNC/RDP access
            await createAuditLog(
                req.user.id,
                'vnc_access',
                'service',
                serviceId,
                {
                    service_id: serviceId,
                    connection_type: connectionType
                },
                req.ip
            );

            res.json({
                guacamoleUrl: `/guacamole/#/client/${sessionData.token}`,
                token: sessionData.token,
                type: connectionType
            });

        } catch (error) {
            logger.error('VNC/RDP error:', {
                serviceId: req.params.id,
                error: error.message
            });
            
            res.status(500).json({
                error: 'VNC/RDP Error',
                message: 'Failed to establish remote desktop connection'
            });
        }
    }
);
/**
 * SFTP File Operations
 * Proxy for file operations via SFTP
 */
router.get('/services/:id/files/*',
    authenticateToken,
    proxyAuth.checkServiceAccess,
    proxyAuth.rateLimit,
    async (req, res) => {
        const serviceId = req.params.id;
        const filePath = '/' + (req.params[0] || '');
        const service = req.service;

        try {
            // Get SSH connection
            const sshConnection = await sessionCache.getSSHConnection(serviceId, {
                host: service.ssh_host,
                port: service.ssh_port || 22,
                username: service.ssh_username,
                password: service.ssh_password,
                privateKey: service.ssh_private_key
            });

            // Create SFTP session
            sshConnection.sftp((err, sftp) => {
                if (err) {
                    logger.error('SFTP error:', err);
                    return res.status(500).json({ error: 'SFTP connection failed' });
                }

                // Handle directory listing
                if (req.query.list === 'true') {
                    sftp.readdir(filePath, (err, files) => {
                        if (err) {
                            return res.status(404).json({ error: 'Directory not found' });
                        }

                        const fileList = files.map(file => ({
                            name: file.filename,
                            type: file.longname.charAt(0) === 'd' ? 'directory' : 'file',
                            size: file.attrs.size,
                            modified: new Date(file.attrs.mtime * 1000),
                            permissions: file.attrs.mode
                        }));

                        res.json({ path: filePath, files: fileList });
                    });
                } else {
                    // Handle file download
                    sftp.stat(filePath, (err, stats) => {
                        if (err) {
                            return res.status(404).json({ error: 'File not found' });
                        }

                        if (stats.isDirectory()) {
                            return res.status(400).json({ error: 'Path is a directory' });
                        }

                        res.setHeader('Content-Type', 'application/octet-stream');
                        res.setHeader('Content-Disposition', 
                            `attachment; filename="${filePath.split('/').pop()}"`);
                        res.setHeader('Content-Length', stats.size);

                        const readStream = sftp.createReadStream(filePath);
                        readStream.pipe(res);
                        
                        readStream.on('error', (err) => {
                            logger.error('File read error:', err);
                            if (!res.headersSent) {
                                res.status(500).json({ error: 'File read failed' });
                            }
                        });
                    });
                }
            });

            // Log file access
            await createAuditLog(
                req.user.id,
                'file_access',
                'service',
                serviceId,
                {
                    service_id: serviceId,
                    file_path: filePath,
                    operation: req.query.list ? 'list' : 'download'
                },
                req.ip
            );

        } catch (error) {
            logger.error('SFTP operation error:', {
                serviceId,
                error: error.message
            });
            
            res.status(500).json({
                error: 'SFTP Error',
                message: 'Failed to access files'
            });
        }
    }
);

/**
 * Upload file via SFTP
 */
router.post('/services/:id/files/*',
    authenticateToken,
    proxyAuth.checkServiceAccess,
    proxyAuth.rateLimit,
    async (req, res) => {
        const serviceId = req.params.id;
        const filePath = '/' + (req.params[0] || '');
        const service = req.service;

        // TODO: Implement file upload with multer
        res.status(501).json({ error: 'File upload not yet implemented' });
    }
);

/**
 * Get service access information
 * Returns available access methods for a service
 */
router.get('/services/:id/access-info',
    authenticateToken,
    proxyAuth.checkServiceAccess,
    async (req, res) => {
        try {
            const service = req.service;
            
            const accessInfo = {
                web: {
                    available: !!service.port,
                    url: service.port ? `/api/services/${service.id}/proxy/` : null,
                    protocol: service.use_https ? 'https' : 'http'
                },
                terminal: {
                    available: !!(service.ssh_host && service.ssh_username),
                    websocket: `/api/services/${service.id}/terminal`
                },
                vnc: {
                    available: !!service.vnc_port,
                    endpoint: `/api/services/${service.id}/vnc`
                },
                rdp: {
                    available: !!service.rdp_port,
                    endpoint: `/api/services/${service.id}/vnc`
                },
                files: {
                    available: !!(service.ssh_host && service.ssh_username),
                    endpoint: `/api/services/${service.id}/files`
                }
            };

            res.json(accessInfo);

        } catch (error) {
            logger.error('Access info error:', {
                serviceId: req.params.id,
                error: error.message
            });
            
            res.status(500).json({
                error: 'Server Error',
                message: 'Failed to get access information'
            });
        }
    }
);

/**
 * Helper function to generate Guacamole token
 */
function generateGuacamoleToken() {
    return Buffer.from(JSON.stringify({
        id: Date.now(),
        expires: Date.now() + 3600000 // 1 hour
    })).toString('base64');
}

module.exports = router;