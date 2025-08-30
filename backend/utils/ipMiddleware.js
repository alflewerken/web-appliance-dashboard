// Middleware to extract and log real client IP
const realIpMiddleware = (req, res, next) => {
  // Get the real IP using our utility
  req.clientIp = getClientIp(req);

  // Special handling for Docker Desktop on Mac/Windows
  // Docker Desktop adds an extra NAT layer
  if (
    process.env.DOCKER_DESKTOP === 'true' ||
    process.env.NODE_ENV === 'development'
  ) {
    // Check for common Docker Desktop bridge IPs
    const dockerBridgeIPs = [
      '192.168.65.1',
      '192.168.64.1',
      '172.17.0.1',
      '172.18.0.1',
    ];

    if (dockerBridgeIPs.includes(req.clientIp)) {
      // Try to get the real IP from various sources
      const possibleRealIP =
        req.headers['x-original-forwarded-for'] ||
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.headers['x-real-ip'] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress;

      if (possibleRealIP && !dockerBridgeIPs.includes(possibleRealIP)) {
        req.clientIp = possibleRealIP;

      }
    }
  }

  // Log the final IP for debugging
  if (process.env.DEBUG_IP === 'true') {

  }

  next();
};

module.exports = { realIpMiddleware };
