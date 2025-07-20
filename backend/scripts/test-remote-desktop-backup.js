#!/usr/bin/env node

// Test script for Remote Desktop backup/restore functionality
const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:3001';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';

// Axios instance with auth
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

async function createTestAppliance() {
  console.log('\n📱 Creating test appliance with remote desktop...');
  
  try {
    const response = await api.post('/api/appliances', {
      name: 'Test Remote Desktop App',
      url: 'http://test-app.local',
      description: 'Test appliance with VNC remote desktop',
      icon: 'Monitor',
      color: '#FF5733',
      category: 'productivity',
      remote_desktop_enabled: true,
      remote_protocol: 'vnc',
      remote_host: '192.168.1.100',
      remote_port: 5900,
      remote_username: 'testuser',
      remote_password_encrypted: 'encrypted_password_here'
    });
    
    if (response.data) {
      console.log('✅ Test appliance created with ID:', response.data.id);
      return response.data.id;
    }
  } catch (error) {
    console.error('❌ Error creating test appliance:', error.response?.data || error.message);
    return null;
  }
}

async function checkAppliance(id) {
  console.log(`\n🔍 Checking appliance ${id}...`);
  
  try {
    const response = await api.get(`/api/appliances/${id}`);
    const appliance = response.data;
    
    console.log('Appliance details:');
    console.log('  Name:', appliance.name);
    console.log('  Remote Desktop Enabled:', appliance.remote_desktop_enabled);
    console.log('  Remote Protocol:', appliance.remote_protocol);
    console.log('  Remote Host:', appliance.remote_host);
    console.log('  Remote Port:', appliance.remote_port);
    console.log('  Remote Username:', appliance.remote_username);
    console.log('  Has Password:', !!appliance.remote_password_encrypted);
    
    return appliance;
  } catch (error) {
    console.error('❌ Error fetching appliance:', error.response?.data || error.message);
    return null;
  }
}

async function createBackup() {
  console.log('\n📦 Creating backup...');
  
  try {
    const response = await api.post('/api/backup-enhanced/create');
    
    if (response.data.success) {
      console.log('✅ Backup created:', response.data.filename);
      return response.data.filename;
    }
  } catch (error) {
    console.error('❌ Error creating backup:', error.response?.data || error.message);
    return null;
  }
}

async function deleteAllAppliances() {
  console.log('\n🗑️  Deleting all appliances...');
  
  try {
    const response = await api.get('/api/appliances');
    const appliances = response.data;
    
    for (const app of appliances) {
      await api.delete(`/api/appliances/${app.id}`);
      console.log(`  Deleted: ${app.name}`);
    }
    
    console.log('✅ All appliances deleted');
  } catch (error) {
    console.error('❌ Error deleting appliances:', error.response?.data || error.message);
  }
}

async function restoreBackup(filename) {
  console.log(`\n📥 Restoring backup ${filename}...`);
  
  try {
    const response = await api.post('/api/backup-enhanced/restore', {
      filename: filename
    });
    
    if (response.data.success) {
      console.log('✅ Backup restored successfully');
      console.log('  Appliances restored:', response.data.result.results.appliances?.restored || 0);
      return true;
    }
  } catch (error) {
    console.error('❌ Error restoring backup:', error.response?.data || error.message);
    return false;
  }
}

async function runTest() {
  console.log('🧪 Remote Desktop Backup/Restore Test');
  console.log('====================================');
  console.log(`API URL: ${API_URL}`);
  console.log(`Auth Token: ${AUTH_TOKEN ? 'Set' : 'Not set'}`);
  
  if (!AUTH_TOKEN) {
    console.log('\n⚠️  Warning: No AUTH_TOKEN set. Tests will fail.');
    console.log('Get a token with:');
    console.log('  curl -X POST http://localhost:3001/api/auth/login \\');
    console.log('    -H "Content-Type: application/json" \\');
    console.log('    -d \'{"username":"admin","password":"your-password"}\'');
    return;
  }
  
  // Step 1: Create test appliance with remote desktop
  const applianceId = await createTestAppliance();
  if (!applianceId) {
    console.log('❌ Test failed: Could not create test appliance');
    return;
  }
  
  // Step 2: Verify appliance has remote desktop settings
  const originalApp = await checkAppliance(applianceId);
  if (!originalApp) {
    console.log('❌ Test failed: Could not fetch appliance');
    return;
  }
  
  // Step 3: Create backup
  const backupFilename = await createBackup();
  if (!backupFilename) {
    console.log('❌ Test failed: Could not create backup');
    return;
  }
  
  // Step 4: Delete all appliances
  await deleteAllAppliances();
  
  // Step 5: Restore backup
  const restored = await restoreBackup(backupFilename);
  if (!restored) {
    console.log('❌ Test failed: Could not restore backup');
    return;
  }
  
  // Step 6: Verify restored appliance has remote desktop settings
  console.log('\n🔍 Verifying restored appliance...');
  const restoredApp = await checkAppliance(applianceId);
  
  if (!restoredApp) {
    console.log('❌ Test failed: Appliance not found after restore');
    return;
  }
  
  // Compare remote desktop settings
  console.log('\n📊 Comparing remote desktop settings:');
  const fields = [
    'remote_desktop_enabled',
    'remote_protocol',
    'remote_host',
    'remote_port',
    'remote_username',
    'remote_password_encrypted'
  ];
  
  let allMatch = true;
  for (const field of fields) {
    const match = originalApp[field] === restoredApp[field];
    console.log(`  ${field}: ${match ? '✅' : '❌'} (${originalApp[field]} → ${restoredApp[field]})`);
    if (!match) allMatch = false;
  }
  
  if (allMatch) {
    console.log('\n✅ SUCCESS: All remote desktop settings restored correctly!');
  } else {
    console.log('\n❌ FAILURE: Some remote desktop settings were not restored correctly');
  }
}

// Run the test
runTest().catch(error => {
  console.error('\n❌ Test suite failed:', error);
  process.exit(1);
});chmod +x test-remote-desktop-backup.js