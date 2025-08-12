/**
 * ProxyAuth Middleware - Security Layer für Proxy-Zugriffe (Simplified)
 * 
 * Vereinfachte Version ohne Model-Dependencies
 */

const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');
const pool = require('../utils/database');

/**
 * Service-Zugriffsprüfung (simplified)
 */
const checkServiceAccess = async (req, res, next) => {
    // Momentan erlauben wir allen authentifizierten Usern Zugriff
    // TODO: Implementiere richtige Zugriffskontrolle
    next();
};

/**
 * Rate Limiting pro Service
 */
const createServiceRateLimiter = () => {
    return rateLimit({
        windowMs: 1 * 60 * 1000, // 1 Minute
        max: 100, // Max 100 Requests pro Minute
        keyGenerator: (req) => {
            // Rate Limit pro User + Service
            return `${req.user.id}-${req.params.id}`;
        },
        handler: (req, res) => {
            logger.warn(`Rate limit exceeded for user ${req.user.id} on service ${req.params.id}`);
            res.status(429).json({
                error: 'Too many requests',
                message: 'Please try again later'
            });
        }
    });
};

/**
 * Audit Logging für Proxy-Zugriffe
 */
const auditProxyAccess = async (req, res, next) => {
    const startTime = Date.now();
    
    // Response abfangen für Logging
    const originalSend = res.send;
    res.send = function(data) {
        res.send = originalSend;
        
        // Audit Log erstellen
        const responseTime = Date.now() - startTime;
        
        // Async logging (blockiert nicht den Response)
        setImmediate(async () => {
            try {
                await pool.execute(
                    `INSERT INTO proxy_audit_logs 
                    (user_id, user_name, appliance_id, appliance_name, action, method, path, status_code, response_time, user_agent, ip) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        req.user.id,
                        req.user.username || req.user.email,
                        req.params.id,
                        req.serviceConfig?.name || req.applianceConfig?.name,
                        'proxy_access',
                        req.method,
                        req.originalUrl,
                        res.statusCode,
                        responseTime,
                        req.headers['user-agent'],
                        req.ip || req.connection.remoteAddress
                    ]
                );
            } catch (error) {
                logger.error('Audit logging error:', error);
            }
        });
        
        return res.send(data);
    };
    
    next();
};

/**
 * WebSocket Authentifizierung
 */
const authenticateWebSocket = async (ws, req) => {
    try {
        // Token aus Query-Parameters oder Cookie
        const token = req.query.token || 
                     req.cookies?.token || 
                     req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            ws.close(1008, 'Unauthorized');
            return false;
        }
        
        // Token verifizieren
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // User aus DB laden
        const [users] = await pool.execute(
            'SELECT * FROM users WHERE id = ? AND is_active = 1',
            [decoded.id]
        );
        
        if (users.length === 0) {
            ws.close(1008, 'Unauthorized');
            return false;
        }
        
        req.user = users[0];
        return true;
    } catch (error) {
        logger.error('WebSocket auth error:', error);
        ws.close(1008, 'Authentication failed');
        return false;
    }
};

/**
 * Security Headers für Proxy Responses
 */
const addSecurityHeaders = (req, res, next) => {
    // Content Security Policy anpassen für Proxy
    res.setHeader('Content-Security-Policy', 
        "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: ws: wss: http: https:;"
    );
    
    // Weitere Security Headers
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    next();
};

module.exports = {
    checkServiceAccess,
    createServiceRateLimiter,
    auditProxyAccess,
    authenticateWebSocket,
    addSecurityHeaders
};