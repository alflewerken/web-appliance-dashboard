const fetch = require('node-fetch');
require('dotenv').config();

// Sie müssen hier ein gültiges Token von Ihrer aktuellen Session verwenden
// Dieses Token finden Sie in den Developer Tools unter Application -> Local Storage -> token
const AUTH_TOKEN = 'IHR_AKTUELLES_TOKEN_HIER';
const API_BASE_URL = 'http://localhost:3001';

async function testUserAPI() {
  try {
    console.log('Testing /api/auth/users endpoint...\n');
    
    const response = await fetch(`${API_BASE_URL}/api/auth/users`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response Status:', response.status);
    console.log('Response Headers:', response.headers.raw());
    
    if (response.ok) {
      const users = await response.json();
      console.log('\nReceived users:', users.length);
      console.log('\nUser list:');
      users.forEach(user => {
        console.log(`- ${user.username} (${user.role}) - Active: ${user.is_active}`);
      });
    } else {
      const error = await response.text();
      console.log('Error:', error);
    }
  } catch (error) {
    console.error('Request failed:', error);
  }
}

console.log('IMPORTANT: You need to update the AUTH_TOKEN variable with your current session token!');
console.log('You can find it in Chrome DevTools: Application -> Local Storage -> token\n');

// Uncomment the line below after updating the token
// testUserAPI();
