#!/usr/bin/env node

/**
 * Debug SSH File Upload
 * Test script to debug the file upload functionality
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

async function testFileUpload() {
  console.log('🔍 Testing SSH File Upload...\n');
  
  const API_URL = 'http://localhost:9080/api/ssh';
  
  // 1. Test if route is accessible
  console.log('1. Testing upload route accessibility...');
  try {
    const testResponse = await axios.post(`${API_URL}/upload-test`);
    console.log('✅ Upload test route response:', testResponse.data);
  } catch (error) {
    console.error('❌ Upload test route error:', error.response?.data || error.message);
  }
  
  // 2. Create test file
  console.log('\n2. Creating test file...');
  const testFileName = 'test-upload.txt';
  const testFilePath = path.join(__dirname, testFileName);
  const testContent = `Test upload file - ${new Date().toISOString()}`;
  fs.writeFileSync(testFilePath, testContent);
  console.log('✅ Test file created:', testFilePath);
  
  // 3. Prepare upload
  console.log('\n3. Preparing file upload...');
  const form = new FormData();
  form.append('file', fs.createReadStream(testFilePath));
  form.append('hostId', '5'); // Host "mac"
  form.append('targetPath', '/tmp');
  
  // 4. Attempt upload
  console.log('\n4. Attempting file upload...');
  try {
    const uploadResponse = await axios.post(`${API_URL}/upload`, form, {
      headers: {
        ...form.getHeaders(),
        // Add auth token if needed
        // 'Authorization': 'Bearer YOUR_TOKEN',
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    
    console.log('✅ Upload successful:', uploadResponse.data);
  } catch (error) {
    console.error('❌ Upload failed:');
    console.error('Status:', error.response?.status);
    console.error('Data:', error.response?.data);
    console.error('Headers:', error.response?.headers);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n⚠️  Connection refused. Make sure the backend is running.');
    }
  }
  
  // 5. Clean up
  console.log('\n5. Cleaning up...');
  fs.unlinkSync(testFilePath);
  console.log('✅ Test file removed');
  
  // 6. Check backend logs
  console.log('\n6. To check backend logs, run:');
  console.log('docker logs --tail 50 appliance_backend | grep -i upload');
}

// Run the test
testFileUpload().catch(console.error);
