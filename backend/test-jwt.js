const jwt = require('jsonwebtoken');

// Test JWT validation
const token = process.argv[2];
const secret = process.env.JWT_SECRET;

console.log('Testing JWT token validation...');
console.log('Token:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN PROVIDED');
console.log('Secret length:', secret ? secret.length : 'NO SECRET');

if (!token) {
  console.error('Please provide token as argument');
  process.exit(1);
}

if (!secret) {
  console.error('JWT_SECRET not set');
  process.exit(1);
}

try {
  const decoded = jwt.verify(token, secret);
  console.log('✅ Token is VALID');
  console.log('Decoded:', decoded);
  
  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  const exp = decoded.exp;
  
  if (exp) {
    const expiresIn = exp - now;
    console.log(`Token expires in: ${expiresIn} seconds (${Math.floor(expiresIn / 3600)} hours)`);
    
    if (expiresIn < 0) {
      console.log('⚠️  WARNING: Token has EXPIRED!');
    }
  }
  
} catch (error) {
  console.error('❌ Token validation FAILED:', error.message);
  
  if (error.name === 'TokenExpiredError') {
    console.error('Token expired at:', new Date(error.expiredAt));
  }
}
