// Utility function to get the real client IP address
// Handles various proxy headers and Docker networking

const getClientIp = req => {
  // Debug logging (disable in production)
  const debugMode = process.env.NODE_ENV !== 'production' || process.env.DEBUG_IP === 'true';
  
  if (debugMode) {

  }

  // Common Docker/Kubernetes internal IPs to filter out
  const internalIPs = [
    '192.168.65.1',  // Docker Desktop on Mac
    '192.168.64.1',  // Docker Desktop alternative
    '172.17.0.1',    // Docker bridge
    '172.18.0.1',    // Docker compose bridge
    '10.0.0.1',      // Kubernetes
    '::1',           // IPv6 localhost
    '127.0.0.1',     // IPv4 localhost
  ];

  // Priority order for IP detection:

  // 1. X-Forwarded-For header (most reliable when behind proxies)
  if (req.headers['x-forwarded-for']) {
    const forwardedIps = req.headers['x-forwarded-for']
      .split(',')
      .map(ip => ip.trim())
      .filter(ip => !internalIPs.includes(ip)); // Filter out internal IPs

    // Log all IPs in the chain
    if (debugMode) {

    }

    // Return the first non-internal IP (original client)
    if (forwardedIps.length > 0) {
      const clientIp = forwardedIps[0];

      return clientIp;
    }
  }

  // 2. X-Real-IP header (set by nginx)
  if (req.headers['x-real-ip'] && !internalIPs.includes(req.headers['x-real-ip'])) {

    return req.headers['x-real-ip'];
  }

  // 3. CF-Connecting-IP (if behind Cloudflare)
  if (req.headers['cf-connecting-ip']) {

    return req.headers['cf-connecting-ip'];
  }

  // 4. X-Client-IP (some proxies use this)
  if (req.headers['x-client-ip'] && !internalIPs.includes(req.headers['x-client-ip'])) {

    return req.headers['x-client-ip'];
  }

  // 5. Express's req.ips array (when trust proxy is enabled)
  if (req.ips && req.ips.length > 0) {
    const validIp = req.ips.find(ip => !internalIPs.includes(ip));
    if (validIp) {

      return validIp;
    }
  }

  // 6. Express's req.ip (when trust proxy is enabled)
  if (req.ip && !internalIPs.includes(req.ip)) {

    return req.ip;
  }

  // 7. Direct socket connection
  const socketAddress =
    req.socket?.remoteAddress || req.connection?.remoteAddress;
  if (socketAddress) {
    // Remove IPv6 prefix if present
    const cleanIp = socketAddress.replace(/^::ffff:/, '');
    if (!internalIPs.includes(cleanIp)) {

      return cleanIp;
    }
  }

  // 8. For local development, return a placeholder
  if (process.env.NODE_ENV === 'development') {

    return '127.0.0.1';
  }

  // Default fallback

  return 'unknown';
};

module.exports = { getClientIp };
