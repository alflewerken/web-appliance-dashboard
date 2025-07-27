// Authentication middleware
const jwt = require('jsonwebtoken');
const { logger } = require('../utils/logger');

const authenticateToken = (req, res, next) => {
    // Debug logging
    console.log('[AUTH] Checking authentication for:', req.method, req.url);
    console.log('[AUTH] Full URL:', req.originalUrl);
    console.log('[AUTH] Query params:', req.query);
    console.log('[AUTH] Headers:', req.headers.authorization);
    console.log('[AUTH] Token from query:', req.query.token);
    
    // Token aus verschiedenen Quellen holen
    const authHeader = req.headers['authorization'];
    const headerToken = authHeader && authHeader.split(' ')[1];
    const queryToken = req.query.token;
    const cookieToken = req.cookies?.token;
    
    // Priorisierung: Header > Query > Cookie
    const token = headerToken || queryToken || cookieToken;

    if (!token) {
        return res.status(401).json({ 
            error: 'Unauthorized',
            message: 'No token provided' 
        });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            logger.warn('Invalid token attempt:', { 
                error: err.message,
                ip: req.ip 
            });
            return res.status(403).json({ 
                error: 'Forbidden',
                message: 'Invalid token' 
            });
        }

        req.user = user;
        next();
    });
};

const requireAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ 
            error: 'Forbidden',
            message: 'Admin access required' 
        });
    }
};

module.exports = {
    authenticateToken,
    requireAdmin
};