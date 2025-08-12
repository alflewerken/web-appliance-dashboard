// Debug script to find problematic routes
const express = require('express');
const path = require('path');
const fs = require('fs');

// Function to test route patterns
function testRoute(pattern, fileName) {
  try {
    const app = express();
    const router = express.Router();
    
    // Try to register the route
    router.get(pattern, (req, res) => {
      res.send('OK');
    });
    
    console.log(`✅ Pattern OK: ${pattern} (${fileName})`);
    return true;
  } catch (error) {
    console.log(`❌ Pattern ERROR: ${pattern} (${fileName})`);
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

// Find all route files
const routesDir = path.join(__dirname, 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

console.log('Checking route files for problematic patterns...\n');

files.forEach(file => {
  const filePath = path.join(routesDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Find route patterns
  const routePatterns = content.match(/router\.\w+\s*\(\s*['"`]([^'"`]+)['"`]/g) || [];
  
  routePatterns.forEach(match => {
    const pattern = match.match(/['"`]([^'"`]+)['"`]/)[1];
    if (pattern.includes(':')) {
      testRoute(pattern, file);
    }
  });
});

// Test specific problematic patterns
console.log('\nTesting specific patterns:');
testRoute('/api/proxy/:', 'manual-test');
testRoute('/:id/proxy/*', 'manual-test');
testRoute('/::/test', 'manual-test');
testRoute('/test/:/', 'manual-test');
testRoute('/test/:', 'manual-test');
