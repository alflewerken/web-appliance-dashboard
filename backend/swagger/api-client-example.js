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
    return this.apiRequest('/api/statusCheck', {
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

    return this.apiRequest(`/api/auditLogs?${params}`);
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

  }

  // Monitoring
  async monitorAppliances(interval = 60000, duration = null) {
    const startTime = Date.now();

    const checkStatus = async () => {
      try {
        const appliances = await this.getAppliances();
        if (!appliances.length) {

          return;
        }

        const applianceIds = appliances.map(app => app.id);
        const statuses = await this.checkApplianceStatus(applianceIds);

        appliances.forEach(app => {
          const statusInfo = statuses[app.id] || {};
          const status = statusInfo.status || 'unknown';
          const responseTime = statusInfo.responseTime || '-';
          
          const statusIcon = status === 'online' ? '🟢' : 
                           status === 'offline' ? '🔴' : '⚪';

        });

        if (duration && (Date.now() - startTime) >= duration) {

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

    await client.login('admin', 'password123');

    // 2. Get and display appliances

    const appliances = await client.getAppliances();
    appliances.forEach(app => {

    });

    // 3. Create a new appliance

    const newAppliance = await client.createAppliance({
      name: 'Example Application',
      url: 'http://example.local:8080',
      description: 'Example application for testing',
      icon: 'Globe',
      color: '#FF5733',
      category: 'development',
    });

    // 4. Update the appliance

    await client.updateAppliance(newAppliance.id, {
      description: 'Updated description for example app',
    });

    // 5. Check appliance status

    const statuses = await client.checkApplianceStatus([newAppliance.id]);
    const statusInfo = statuses[newAppliance.id] || {};

    // 6. Get categories

    const categories = await client.getCategories();
    categories.forEach(cat => {

    });

    // 7. Get settings

    const settings = await client.getSettings();
    const settingsMap = Object.fromEntries(
      settings.map(s => [s.key, s.value])
    );

    // 8. Get audit logs

    const logs = await client.getAuditLogs({ limit: 5 });
    logs.logs.slice(0, 5).forEach(log => {

    });

    // 9. Subscribe to real-time updates

    const unsubscribe = client.subscribeToUpdates(
      (data) => console.log('Update:', data),
      (error) => console.error('SSE Error:', error)
    );

    // Stop after 10 seconds
    setTimeout(() => {
      unsubscribe();

    }, 10000);

    // 10. Monitor appliances for 30 seconds

    await client.monitorAppliances(10000, 30000);

    // 11. Clean up - delete the test appliance

    await client.deleteAppliance(newAppliance.id);

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
