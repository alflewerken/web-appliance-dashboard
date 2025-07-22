#!/usr/bin/env node

/**
 * Web Appliance Dashboard API Client Example
 * 
 * This script demonstrates how to use the Web Appliance Dashboard API with Node.js.
 * It includes examples for all major endpoints with proper error handling.
 * 
 * Requirements:
 *   npm install node-fetch
 * 
 * Usage:
 *   node api-client-example.js
 */

const fetch = require('node-fetch');

class WebApplianceAPIClient {
  constructor(baseUrl = 'http://localhost:9080') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = null;
  }

  /**
   * Handle API response and throw errors if needed
   */
  async handleResponse(response) {
    if (!response.ok) {
      let errorMessage = `HTTP Error ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = `${errorMessage}: ${errorData.error || 'Unknown error'}`;
      } catch (e) {
        // Response might not be JSON
      }
      throw new Error(errorMessage);
    }
    
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }
    return response;
  }

  /**
   * Make an API request with authentication
   */
  async apiRequest(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token && !endpoint.includes('/auth/login')) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    return this.handleResponse(response);
  }

  // Authentication
  async login(username, password) {
    const data = await this.apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    
    this.token = data.token;
    console.log(`✓ Logged in as ${data.user.username}`);
    return data;
  }

  // Appliances
  async getAppliances() {
    return this.apiRequest('/api/appliances');
  }

  async createAppliance(applianceData) {
    return this.apiRequest('/api/appliances', {
      method: 'POST',
      body: JSON.stringify(applianceData),
    });
  }

  async updateAppliance(id, updates) {
    return this.apiRequest(`/api/appliances/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteAppliance(id) {
    return this.apiRequest(`/api/appliances/${id}`, {
      method: 'DELETE',
    });
  }

  // Categories
  async getCategories() {
    return this.apiRequest('/api/categories');
  }

  // Services
  async getServices() {
    return this.apiRequest('/api/services');
  }

  async controlService(serviceName, action) {
    return this.apiRequest(`/api/services/${serviceName}/${action}`, {
      method: 'POST',
    });
  }

  // Settings
  async getSettings() {
    return this.apiRequest('/api/settings');
  }

  async updateSetting(key, value) {
    return this.apiRequest(`/api/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    });
  }

  // SSH Keys
  async getSSHKeys() {
    return this.apiRequest('/api/ssh/keys');
  }

  async generateSSHKey(name, passphrase = '') {
    return this.apiRequest('/api/ssh/keys/generate', {
      method: 'POST',
      body: JSON.stringify({ name, passphrase }),
    });
  }

  // Status Check
  async checkApplianceStatus(applianceIds) {
    return this.apiRequest('/api/status-check', {
      method: 'POST',
      body: JSON.stringify({ applianceIds }),
    });
  }

  // Audit Logs
  async getAuditLogs(options = {}) {
    const params = new URLSearchParams({
      limit: options.limit || 100,
      offset: options.offset || 0,
      ...(options.action && { action: options.action }),
      ...(options.userId && { userId: options.userId }),
    });

    return this.apiRequest(`/api/audit-logs?${params}`);
  }

  // Backup
  async createBackup(outputFile) {
    const fs = require('fs');
    const response = await fetch(`${this.baseUrl}/api/backup`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Backup failed: ${response.statusText}`);
    }

    const buffer = await response.buffer();
    fs.writeFileSync(outputFile, buffer);
    console.log(`✓ Backup saved to ${outputFile}`);
  }

  // Monitoring
  async monitorAppliances(interval = 60000, duration = null) {
    const startTime = Date.now();
    console.log(`Starting appliance monitoring (interval: ${interval/1000}s)...`);

    const checkStatus = async () => {
      try {
        const appliances = await this.getAppliances();
        if (!appliances.length) {
          console.log('No appliances configured');
          return;
        }

        const applianceIds = appliances.map(app => app.id);
        const statuses = await this.checkApplianceStatus(applianceIds);

        console.log(`\n[${new Date().toLocaleString()}]`);
        appliances.forEach(app => {
          const statusInfo = statuses[app.id] || {};
          const status = statusInfo.status || 'unknown';
          const responseTime = statusInfo.responseTime || '-';
          
          const statusIcon = status === 'online' ? '🟢' : 
                           status === 'offline' ? '🔴' : '⚪';
          
          console.log(
            `${statusIcon} ${app.name.padEnd(30)} ${status.padEnd(10)} ${responseTime}ms`
          );
        });

        if (duration && (Date.now() - startTime) >= duration) {
          console.log('\nMonitoring duration reached');
          clearInterval(intervalId);
        }
      } catch (error) {
        console.error('Monitor error:', error.message);
      }
    };

    // Initial check
    await checkStatus();

    // Set up interval
    const intervalId = setInterval(checkStatus, interval);

    // Handle Ctrl+C
    process.on('SIGINT', () => {
      console.log('\n\nMonitoring stopped by user');
      clearInterval(intervalId);
      process.exit(0);
    });

    return intervalId;
  }

  // Server-Sent Events
  subscribeToUpdates(onUpdate, onError) {
    const EventSource = require('eventsource');
    const eventSource = new EventSource(
      `${this.baseUrl}/api/sse?token=${this.token}`
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onUpdate(data);
      } catch (error) {
        console.error('Failed to parse SSE data:', error);
      }
    };

    eventSource.onerror = (error) => {
      onError(error);
      eventSource.close();
    };

    return () => eventSource.close();
  }
}

// Main demonstration function
async function main() {
  const client = new WebApplianceAPIClient();

  try {
    // 1. Login
    console.log('=== Authentication ===');
    await client.login('admin', 'password123');

    // 2. Get and display appliances
    console.log('\n=== Current Appliances ===');
    const appliances = await client.getAppliances();
    appliances.forEach(app => {
      console.log(`- ${app.name} (${app.url})`);
    });

    // 3. Create a new appliance
    console.log('\n=== Creating New Appliance ===');
    const newAppliance = await client.createAppliance({
      name: 'Example Application',
      url: 'http://example.local:8080',
      description: 'Example application for testing',
      icon: 'Globe',
      color: '#FF5733',
      category: 'development',
    });
    console.log(`✓ Created appliance: ${newAppliance.name} (ID: ${newAppliance.id})`);

    // 4. Update the appliance
    console.log('\n=== Updating Appliance ===');
    await client.updateAppliance(newAppliance.id, {
      description: 'Updated description for example app',
    });
    console.log('✓ Updated appliance description');

    // 5. Check appliance status
    console.log('\n=== Checking Status ===');
    const statuses = await client.checkApplianceStatus([newAppliance.id]);
    const statusInfo = statuses[newAppliance.id] || {};
    console.log(`Status: ${statusInfo.status || 'unknown'}`);

    // 6. Get categories
    console.log('\n=== Categories ===');
    const categories = await client.getCategories();
    categories.forEach(cat => {
      console.log(`- ${cat.display_name}: ${cat.applianceCount} appliances`);
    });

    // 7. Get settings
    console.log('\n=== Settings ===');
    const settings = await client.getSettings();
    const settingsMap = Object.fromEntries(
      settings.map(s => [s.key, s.value])
    );
    console.log(`SSH Enabled: ${settingsMap.ssh_enabled || 'N/A'}`);
    console.log(`Terminal Enabled: ${settingsMap.terminal_enabled || 'N/A'}`);

    // 8. Get audit logs
    console.log('\n=== Recent Audit Logs ===');
    const logs = await client.getAuditLogs({ limit: 5 });
    logs.logs.slice(0, 5).forEach(log => {
      console.log(`- [${log.timestamp}] ${log.username}: ${log.action}`);
    });

    // 9. Subscribe to real-time updates
    console.log('\n=== Real-time Updates (10 seconds) ===');
    const unsubscribe = client.subscribeToUpdates(
      (data) => console.log('Update:', data),
      (error) => console.error('SSE Error:', error)
    );

    // Stop after 10 seconds
    setTimeout(() => {
      unsubscribe();
      console.log('Stopped listening to updates');
    }, 10000);

    // 10. Monitor appliances for 30 seconds
    console.log('\n=== Monitoring Appliances ===');
    await client.monitorAppliances(10000, 30000);

    // 11. Clean up - delete the test appliance
    console.log('\n=== Cleanup ===');
    await client.deleteAppliance(newAppliance.id);
    console.log('✓ Deleted test appliance');

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Run the example if this is the main module
if (require.main === module) {
  main().catch(console.error);
}

module.exports = WebApplianceAPIClient;
