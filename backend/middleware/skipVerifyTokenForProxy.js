// Middleware to skip verifyToken for proxy routes
const skipVerifyTokenForProxy = (req, res, next) => {
  // Check if the path contains /proxy/
  if (req.path.includes('/proxy/')) {
    // Skip verifyToken for proxy routes
    next();
  } else {
    // Apply verifyToken for other routes
    require('../utils/auth').verifyToken(req, res, next);
  }
};

module.exports = skipVerifyTokenForProxy;
