// Add this at the end of sse.js before module.exports

// Debug endpoint to test token validation
router.get('/test-token', (req, res) => {
  const token = req.query.token;
  
  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({
      success: true,
      decoded,
      message: 'Token is valid'
    });
  } catch (error) {
    res.status(403).json({
      error: "Invalid token",
      message: error.message,
      name: error.name
    });
  }
});
