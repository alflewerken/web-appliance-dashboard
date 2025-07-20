#!/usr/bin/env node

// Test script for enhanced backup/restore functionality
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

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

// Test functions
async function testCreateBackup() {
  console.log('\n📦 Testing backup creation...');
  
  try {
    const response = await api.post('/api/backup-enhanced/create');
    
    if (response.data.success) {
      console.log('✅ Backup created successfully!');
      console.log('   Backup ID:', response.data.backup_id);
      console.log('   Filename:', response.data.filename);
      console.log('   Size:', response.data.report.size_mb, 'MB');
      console.log('   Duration:', response.data.report.duration_ms, 'ms');
      
      // Show statistics
      console.log('\n📊 Backup Statistics:');
      const stats = response.data.report.statistics;
      if (stats.tables) {
        for (const [table, info] of Object.entries(stats.tables)) {
          console.log(`   ${table}: ${info.count} records (${(info.size / 1024).toFixed(1)} KB)`);
        }
      }
      
      return response.data.filename;
    } else {
      console.error('❌ Backup creation failed:', response.data.error);
      return null;
    }
  } catch (error) {
    console.error('❌ Error creating backup:', error.response?.data || error.message);
    return null;
  }
}

async function testListBackups() {
  console.log('\n📋 Testing backup list...');
  
  try {
    const response = await api.get('/api/backup-enhanced/list');
    
    if (response.data.success) {
      console.log(`✅ Found ${response.data.total} backups:`);
      
      response.data.backups.slice(0, 5).forEach((backup, index) => {
        console.log(`\n   ${index + 1}. ${backup.filename}`);
        console.log(`      Created: ${new Date(backup.created_at).toLocaleString()}`);
        console.log(`      Size: ${backup.size_mb} MB`);
        console.log(`      Valid: ${backup.valid ? '✓' : '✗'}`);
        console.log(`      Version: ${backup.version}`);
      });
      
      if (response.data.total > 5) {
        console.log(`\n   ... and ${response.data.total - 5} more`);
      }
      
      return response.data.backups;
    } else {
      console.error('❌ Failed to list backups:', response.data.error);
      return [];
    }
  } catch (error) {
    console.error('❌ Error listing backups:', error.response?.data || error.message);
    return [];
  }
}

async function testValidateBackup(filename) {
  console.log(`\n🔍 Testing backup validation for ${filename}...`);
  
  try {
    // First download the backup
    const downloadResponse = await api.get(`/api/backup-enhanced/download/${filename}`, {
      responseType: 'stream'
    });
    
    // Save to temp file
    const tempPath = path.join(__dirname, 'temp_backup.json');
    const writer = require('fs').createWriteStream(tempPath);
    downloadResponse.data.pipe(writer);
    
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    
    // Now validate
    const FormData = require('form-data');
    const form = new FormData();
    form.append('backup', require('fs').createReadStream(tempPath));
    
    const response = await api.post('/api/backup-enhanced/validate', form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    });
    
    // Clean up temp file
    await fs.unlink(tempPath);
    
    if (response.data.success) {
      console.log(`✅ Backup validation ${response.data.valid ? 'PASSED' : 'FAILED'}`);
      
      if (response.data.validation.errors.length > 0) {
        console.log('\n❌ Errors:');
        response.data.validation.errors.forEach(err => console.log(`   - ${err}`));
      }
      
      if (response.data.validation.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        response.data.validation.warnings.forEach(warn => console.log(`   - ${warn}`));
      }
      
      // Show data summary
      if (response.data.report.data_summary) {
        console.log('\n📊 Data Summary:');
        const summary = response.data.report.data_summary;
        
        if (summary.appliances) {
          console.log(`   Appliances: ${summary.appliances.total} total`);
          console.log(`     - With SSH: ${summary.appliances.with_ssh}`);
          console.log(`     - With Services: ${summary.appliances.with_services}`);
          console.log(`     - Favorites: ${summary.appliances.favorites}`);
        }
        
        if (summary.ssh_keys) {
          console.log(`   SSH Keys: ${summary.ssh_keys.total} total`);
          console.log(`     - With Private Key: ${summary.ssh_keys.with_private_key}`);
          console.log(`     - Filesystem Synced: ${summary.ssh_keys.filesystem_synced}`);
        }
        
        if (summary.users) {
          console.log(`   Users: ${summary.users.total} total`);
          console.log(`     - Admins: ${summary.users.admins}`);
          console.log(`     - Active: ${summary.users.active}`);
          console.log(`     - With Passwords: ${summary.users.with_passwords}`);
        }
      }
      
      return response.data.valid;
    } else {
      console.error('❌ Validation request failed:', response.data.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Error validating backup:', error.response?.data || error.message);
    return false;
  }
}

async function testBackupStatus() {
  console.log('\n📈 Testing backup status...');
  
  try {
    const response = await api.get('/api/backup-enhanced/status');
    
    if (response.data.success) {
      console.log('✅ Backup status retrieved:');
      console.log(`   Total backups: ${response.data.status.total_backups}`);
      
      if (response.data.status.latest_backup) {
        const latest = response.data.status.latest_backup;
        console.log(`\n   Latest backup:`);
        console.log(`     - Filename: ${latest.filename}`);
        console.log(`     - Created: ${new Date(latest.created_at).toLocaleString()}`);
        console.log(`     - Size: ${latest.size_mb} MB`);
        console.log(`     - Valid: ${latest.valid ? '✓' : '✗'}`);
      }
      
      const sysInfo = response.data.status.system_info;
      console.log(`\n   System info:`);
      console.log(`     - Node: ${sysInfo.node_version}`);
      console.log(`     - Platform: ${sysInfo.platform} (${sysInfo.arch})`);
      console.log(`     - Memory: ${sysInfo.memory.free_mb}/${sysInfo.memory.total_mb} MB free`);
      console.log(`     - Docker: ${sysInfo.docker ? 'Yes' : 'No'}`);
      
      return response.data.status;
    } else {
      console.error('❌ Failed to get status:', response.data.error);
      return null;
    }
  } catch (error) {
    console.error('❌ Error getting status:', error.response?.data || error.message);
    return null;
  }
}

async function testCleanup(keepCount = 5) {
  console.log(`\n🧹 Testing cleanup (keeping last ${keepCount} backups)...`);
  
  try {
    const response = await api.post('/api/backup-enhanced/cleanup', {
      keepCount
    });
    
    if (response.data.success) {
      console.log('✅ Cleanup completed:');
      console.log(`   Deleted: ${response.data.result.deleted} backups`);
      console.log(`   Kept: ${response.data.result.kept} backups`);
      
      return response.data.result;
    } else {
      console.error('❌ Cleanup failed:', response.data.error);
      return null;
    }
  } catch (error) {
    console.error('❌ Error during cleanup:', error.response?.data || error.message);
    return null;
  }
}

// Main test runner
async function runTests() {
  console.log('🧪 Enhanced Backup/Restore Test Suite');
  console.log('=====================================');
  console.log(`API URL: ${API_URL}`);
  console.log(`Auth Token: ${AUTH_TOKEN ? 'Set' : 'Not set (tests may fail)'}`);
  
  if (!AUTH_TOKEN) {
    console.log('\n⚠️  Warning: No AUTH_TOKEN set. Set it with:');
    console.log('   export AUTH_TOKEN="your-token-here"');
    console.log('   You can get a token by logging in via the API');
  }
  
  // Run tests
  const filename = await testCreateBackup();
  
  await testListBackups();
  
  if (filename) {
    await testValidateBackup(filename);
  }
  
  await testBackupStatus();
  
  // Uncomment to test cleanup
  // await testCleanup(10);
  
  console.log('\n✅ All tests completed!');
}

// Run tests
runTests().catch(error => {
  console.error('\n❌ Test suite failed:', error);
  process.exit(1);
});