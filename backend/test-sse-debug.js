// Test script to debug SSE issue
console.log('Testing SSE endpoint...');

const http = require('http');

// Test directly to backend
const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/sse/stream?token=test123',
  method: 'GET',
};

const req = http.request(options, (res) => {
  console.log(`statusCode: ${res.statusCode}`);
  console.log('headers:', res.headers);
  
  res.on('data', (d) => {
    process.stdout.write(d);
  });
});

req.on('error', (error) => {
  console.error(error);
});

req.end();
