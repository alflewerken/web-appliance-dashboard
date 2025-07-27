#!/usr/bin/env node

/**
 * Terminal Connection Test Script
 * Testet die Terminal-Verbindung und Session-Erstellung
 */

const axios = require('axios');
const WebSocket = require('ws');

// Konfiguration
const BASE_URL = 'http://localhost:9080';
const API_URL = `${BASE_URL}/api`;
const WS_URL = 'ws://localhost:9080';

// Test-Daten
const TEST_HOST = {
  host: 'localhost',
  username: 'alflewerken',
  port: 22
};

async function testTerminalSession() {
  console.log('🔍 Testing Terminal Session Creation...\n');
  
  try {
    // 1. Erstelle eine Terminal-Session
    console.log('1. Creating terminal session...');
    const sessionResponse = await axios.post(`${API_URL}/ssh/terminal-session`, {
      sshConnection: `${TEST_HOST.username}@${TEST_HOST.host}:${TEST_HOST.port}`
    });
    
    console.log('✅ Session created:', sessionResponse.data);
    
    // 2. Warte kurz
    console.log('\n2. Waiting for session file to be written...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 3. Versuche Terminal-Verbindung
    console.log('\n3. Testing terminal connection...');
    const terminalUrl = `${BASE_URL}/terminal/?host=${TEST_HOST.host}&user=${TEST_HOST.username}&port=${TEST_HOST.port}`;
    console.log('Terminal URL:', terminalUrl);
    
    // 4. Teste WebSocket-Verbindung (wenn implementiert)
    console.log('\n4. Testing WebSocket connection (if available)...');
    const ws = new WebSocket(`${WS_URL}/ws/terminal/test`);
    
    ws.on('open', () => {
      console.log('✅ WebSocket connected');
      ws.close();
    });
    
    ws.on('error', (error) => {
      console.log('⚠️  WebSocket error (might be normal if not implemented):', error.message);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

// Führe Test aus
testTerminalSession();
