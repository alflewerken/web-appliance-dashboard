// Utility function to get the real client IP address
// Handles various proxy headers and Docker networking

const getClientIp = req => {
  // Debug logging (disable in production)
  if (
    process.env.NODE_ENV !== 'production' ||
    process.env.DEBUG_IP === 'true'
  ) {
    console.log('=== IP Detection Debug ===');
    console.log('All Headers:', JSON.stringify(req.headers, null, 2));
    console.log('req.ip:', req.ip);
    console.log('req.ips:', req.ips);
    console.log('req.socket.remoteAddress:', req.socket?.remoteAddress);
    console.log('req.connection.remoteAddress:', req.connection?.remoteAddress);
    console.log('=========================');
  }

  // Priority order for IP detection:

  // 1. X-Forwarded-For header (most reliable when behind proxies)
  if (req.headers['x-forwarded-for']) {
    const forwardedIps = req.headers['x-forwarded-for']
      .split(',')
      .map(ip => ip.trim());

    // Log all IPs in the chain
    if (process.env.DEBUG_IP === 'true') {
      console.log('X-Forwarded-For chain:', forwardedIps);
    }

    // Return the first IP (original client)
    const clientIp = forwardedIps[0];
    console.log('Using X-Forwarded-For (first IP):', clientIp);
    return clientIp;
  }

  // 2. X-Real-IP header (set by nginx)
  if (req.headers['x-real-ip']) {
    console.log('Using X-Real-IP:', req.headers['x-real-ip']);
    return req.headers['x-real-ip'];
  }

  // 3. CF-Connecting-IP (if behind Cloudflare)
  if (req.headers['cf-connecting-ip']) {
    console.log('Using CF-Connecting-IP:', req.headers['cf-connecting-ip']);
    return req.headers['cf-connecting-ip'];
  }

  // 4. X-Client-IP (some proxies use this)
  if (req.headers['x-client-ip']) {
    console.log('Using X-Client-IP:', req.headers['x-client-ip']);
    return req.headers['x-client-ip'];
  }

  // 5. Express's req.ips array (when trust proxy is enabled)
  if (req.ips && req.ips.length > 0) {
    console.log('Using req.ips[0]:', req.ips[0]);
    return req.ips[0];
  }

  // 6. Express's req.ip (when trust proxy is enabled)
  if (req.ip) {
    console.log('Using req.ip:', req.ip);
    return req.ip;
  }

  // 7. Direct socket connection
  const socketAddress =
    req.socket?.remoteAddress || req.connection?.remoteAddress;
  if (socketAddress) {
    // Remove IPv6 prefix if present
    const cleanIp = socketAddress.replace(/^::ffff:/, '');
    console.log('Using socket address:', cleanIp);
    return cleanIp;
  }

  // Default fallback
  console.log('Using fallback: unknown');
  return 'unknown';
};

module.exports = { getClientIp };
