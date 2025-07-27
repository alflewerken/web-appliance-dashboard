## Web Appliance Dashboard v1.1.1

This document contains example code for integrating the Web Appliance Dashboard API in various programming languages.

## 📋 Table of Contents

- [JavaScript/TypeScript](#javascripttypescript)
- [Python](#python)
- [Go](#go)
- [PHP](#php)
- [Java](#java)
- [C#/.NET](#cnet)
- [Ruby](#ruby)
- [cURL/Bash](#curlbash)
- [PowerShell](#powershell)
- [Postman Collection](#postman-collection)

## JavaScript/TypeScript

### Installation

```bash
npm install axios
# or
yarn add axios
```

### Basic Client

```javascript
// api-client.js
const axios = require('axios');

class ApplianceDashboardClient {
  constructor(baseURL = 'http://localhost:9080/api', token = null) {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    this.token = token;
    
    // Request interceptor for Auth
    this.client.interceptors.request.use(
      config => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        return config;
      },
      error => Promise.reject(error)
    );
    
    // Response interceptor for Error Handling
    this.client.interceptors.response.use(
      response => response.data,
      error => {
        if (error.response?.status === 401) {
          this.token = null;
          throw new Error('Authentication failed');
        }
        throw error;
      }
    );
  }
  
  // Authentication
  async login(username, password) {
    const response = await this.client.post('/auth/login', {
      username,
      password
    });
    this.token = response.token;
    return response;
  }
  
  async logout() {
    await this.client.post('/auth/logout');
    this.token = null;
  }
  
  // Appliances
  async getAppliances(params = {}) {
    return this.client.get('/appliances', { params });
  }
  
  async getAppliance(id) {
    return this.client.get(`/appliances/${id}`);
  }
  
  async createAppliance(data) {
    return this.client.post('/appliances', data);
  }
  
  async updateAppliance(id, data) {
    return this.client.put(`/appliances/${id}`, data);
  }  
  async deleteAppliance(id) {
    return this.client.delete(`/appliances/${id}`);
  }
  
  // SSH Management
  async getSSHKeys() {
    return this.client.get('/ssh/keys');
  }
  
  async generateSSHKey(name, type = 'rsa', bits = 4096) {
    return this.client.post('/ssh/keys/generate', {
      name,
      type,
      bits
    });
  }
  
  async testSSHConnection(data) {
    return this.client.post('/ssh/test', data);
  }
  
  // Remote Desktop
  async getRemoteDesktopToken(applianceId) {
    return this.client.post(`/guacamole/token/${applianceId}`);
  }
  
  // Service Control
  async controlService(applianceId, action, serviceName) {
    return this.client.post(`/appliances/${applianceId}/control`, {
      action,
      service: serviceName
    });
  }
  
  // Backup & Restore
  async createBackup() {
    return this.client.post('/backup/create');
  }
  
  async downloadBackup() {
    const response = await this.client.get('/backup/download/latest', {
      responseType: 'blob'
    });
    return response;
  }
  
  // Real-time Events (SSE)
  subscribeToEvents(onMessage, onError) {
    const eventSource = new EventSource(
      `${this.client.defaults.baseURL}/sse`,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      }
    );
    
    eventSource.onmessage = event => {
      const data = JSON.parse(event.data);
      onMessage(data);
    };
    
    eventSource.onerror = error => {
      onError(error);
      eventSource.close();
    };
    
    return () => eventSource.close();
  }
}

// Usage
async function example() {
  const client = new ApplianceDashboardClient();
  
  try {
    // Login
    await client.login('admin', 'admin123');
    
    // Get all appliances
    const appliances = await client.getAppliances();
    console.log('Appliances:', appliances);
    
    // Create new appliance
    const newAppliance = await client.createAppliance({
      name: 'Production Server',
      url: 'https://prod.example.com',
      category: 'infrastructure',
      ssh_host: '192.168.1.100',
      ssh_username: 'root',
      ssh_port: 22
    });
    
    // Get remote desktop token
    const rdToken = await client.getRemoteDesktopToken(newAppliance.id);
    console.log('Remote Desktop URL:', rdToken.url);
    
    // Subscribe to real-time updates
    const unsubscribe = client.subscribeToEvents(