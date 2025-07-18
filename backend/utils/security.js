// CORS and Security Middleware
const cors = require('cors');

// Configure CORS based on environment
const configureCORS = () => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  const corsOptions = {
    origin(origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        'http://localhost:3000', // React development server
        'http://localhost:3001', // Backend server
        'http://localhost', // Production without port
        'https://localhost', // HTTPS production
      ];

      // Add custom allowed origins from environment
      if (process.env.ALLOWED_ORIGINS) {
        const customOrigins = process.env.ALLOWED_ORIGINS.split(',').map(o =>
          o.trim()
        );
        allowedOrigins.push(...customOrigins);
      }

      // In development, be more permissive
      if (isDevelopment) {
        return callback(null, true);
      }

      // Check if origin is from a local network (mobile devices on same network)
      const localNetworkPatterns = [
        /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,
        /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,
        /^https?:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}(:\d+)?$/,
        /^https?:\/\/[\w-]+\.local(:\d+)?$/,
      ];

      const isLocalNetwork = localNetworkPatterns.some(pattern =>
        pattern.test(origin)
      );
      if (isLocalNetwork) {
        return callback(null, true);
      }

      // In production, check against whitelist
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count'],
    maxAge: 86400, // 24 hours
  };

  return cors(corsOptions);
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
  // Prevent clickjacking - allow same origin for terminal iframe
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS filter
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Control referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy (adjust as needed)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https:; " +
        "font-src 'self' data:; " +
        "connect-src 'self' ws: wss:; " +
        "frame-src 'self' http://localhost:* https://localhost:*; " +
        "frame-ancestors 'self' http://localhost:* https://localhost:*;"
    );
  }

  next();
};

module.exports = {
  configureCORS,
  securityHeaders,
};
