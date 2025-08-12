# Web Appliance Dashboard Integrationsleitfaden

Version: 1.1.1

## Inhaltsverzeichnis

1. [Übersicht](#übersicht)
2. [API-Integration](#api-integration)
3. [Authentifizierungsmethoden](#authentifizierungsmethoden)
4. [Webhook-Integration](#webhook-integration)
5. [SSH-Integration](#ssh-integration)
6. [Remote-Desktop-Integration](#remote-desktop-integration)
7. [Benutzerdefinierte Widget-Entwicklung](#benutzerdefinierte-widget-entwicklung)
8. [Integration von Drittanbieterdiensten](#integration-von-drittanbieterdiensten)
9. [Monitoring-Integration](#monitoring-integration)
10. [Beispiele](#beispiele)

## Übersicht

Das Web Appliance Dashboard bietet mehrere Integrationspunkte für externe Systeme und Dienste. Dieser Leitfaden behandelt alle verfügbaren Integrationsmethoden und Best Practices.

## API Integration

### Basis-Konfiguration

```javascript
const API_BASE = 'http://localhost:3000/api';
const AUTH_TOKEN = 'ihr-jwt-token';

const headers = {
  'Authorization': `Bearer ${AUTH_TOKEN}`,
  'Content-Type': 'application/json'
};
```

### REST API Client Example

```javascript
class ApplianceDashboardClient {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.token = token;
    this.headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  async getAppliances() {
    const response = await fetch(`${this.baseUrl}/appliances`, {
      headers: this.headers
    });
    return response.json();
  }

  async createAppliance(data) {
    const response = await fetch(`${this.baseUrl}/appliances`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(data)
    });
    return response.json();
  }

  async getApplianceStatus(id) {
    const response = await fetch(`${this.baseUrl}/appliances/${id}/status`, {
      headers: this.headers
    });
    return response.json();
  }
}
```

## Authentication Methods

### JWT Token Authentication

```javascript
// Login and get token
async function authenticate(username, password) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  
  const data = await response.json();
  if (data.success) {
    return data.token;
  }
  throw new Error(data.error);
}
```

### API Key Authentication (Custom Implementation)

```javascript
// Extend the backend to support API keys
// backend/middleware/auth.js
const authenticateAPIKey = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return next();
  }
  
  try {
    const [result] = await pool.execute(
      'SELECT * FROM api_keys WHERE key_value = ? AND is_active = 1',
      [apiKey]
    );
    
    if (result.length > 0) {
      req.user = result[0];
      return next();
    }
  } catch (error) {
    console.error('API Key validation error:', error);
  }
  
  next();
};
```

## Webhook Integration

### Webhook Configuration

```javascript
// Configure webhooks for appliance events
const webhookConfig = {
  url: 'https://your-system.com/webhook',
  events: ['appliance.created', 'appliance.status_changed', 'ssh.connected'],
  secret: 'your-webhook-secret'
};
```

### Webhook Handler Example

```javascript
// Express webhook receiver
app.post('/webhook/appliance-dashboard', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const payload = req.body;
  
  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');
    
  if (signature !== expectedSignature) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process webhook
  switch (payload.event) {
    case 'appliance.created':
      handleApplianceCreated(payload.data);
      break;
    case 'appliance.status_changed':
      handleStatusChange(payload.data);
      break;
    case 'ssh.connected':
      handleSSHConnection(payload.data);
      break;
  }
  
  res.json({ received: true });
});
```

## SSH Integration

### Programmatic SSH Access

```javascript
// Using the SSH API endpoints
class SSHIntegration {
  constructor(apiClient) {
    this.api = apiClient;
  }
  
  async executeCommand(hostId, command) {
    const response = await fetch(`${this.api.baseUrl}/ssh/execute`, {
      method: 'POST',
      headers: this.api.headers,
      body: JSON.stringify({ hostId, command })
    });
    return response.json();
  }
  
  async setupHost(hostData) {
    const response = await fetch(`${this.api.baseUrl}/ssh/setup`, {
      method: 'POST',
      headers: this.api.headers,
      body: JSON.stringify(hostData)
    });
    return response.json();
  }
  
  async uploadFile(hostId, file, remotePath) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('hostId', hostId);
    formData.append('remotePath', remotePath);
    
    const response = await fetch(`${this.api.baseUrl}/ssh/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.api.token}`
      },
      body: formData
    });
    return response.json();
  }
}
```
### Direct SSH Tunnel Integration

```javascript
// Create SSH tunnel for database access
const { createTunnel } = require('tunnel-ssh');

async function createDatabaseTunnel(hostId) {
  const hostInfo = await api.get(`/ssh/hosts/${hostId}`);
  
  const tunnelOptions = {
    autoClose: true
  };
  
  const serverOptions = {
    port: 3307, // Local port
    host: '127.0.0.1'
  };
  
  const sshOptions = {
    host: hostInfo.host,
    port: hostInfo.port,
    username: hostInfo.username,
    privateKey: hostInfo.privateKey
  };
  
  const forwardOptions = {
    srcAddr: '127.0.0.1',
    srcPort: 3307,
    dstAddr: 'localhost',
    dstPort: 3306 // Remote MySQL port
  };
  
  const tunnel = await createTunnel(
    tunnelOptions,
    serverOptions,
    sshOptions,
    forwardOptions
  );
  
  return tunnel;
}
```

## Remote Desktop Integration

### Guacamole Token Integration

```javascript
class RemoteDesktopIntegration {
  constructor(apiClient) {
    this.api = apiClient;
  }
  
  async getConnectionToken(connectionId) {
    const response = await fetch(
      `${this.api.baseUrl}/remote-desktop/token/${connectionId}`,
      { headers: this.api.headers }
    );
    const data = await response.json();
    return data.token;
  }
  
  async createConnection(connectionData) {
    const response = await fetch(
      `${this.api.baseUrl}/remote-desktop/connections`,
      {
        method: 'POST',
        headers: this.api.headers,
        body: JSON.stringify(connectionData)
      }
    );
    return response.json();
  }
  
  generateGuacamoleUrl(token) {
    return `http://localhost:9070/guacamole/#/client/${token}`;
  }
  
  // Embed Guacamole in iframe
  embedRemoteDesktop(token, containerId) {
    const container = document.getElementById(containerId);
    const iframe = document.createElement('iframe');
    iframe.src = this.generateGuacamoleUrl(token);
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    container.appendChild(iframe);
  }
}
```

## Custom Widget Development

### Widget Interface

```javascript
// Define a custom widget for the dashboard
class CustomWidget {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.category = config.category;
    this.updateInterval = config.updateInterval || 30000;
  }
  
  async fetchData() {
    // Implement data fetching logic
    throw new Error('fetchData must be implemented');
  }
  
  render() {
    // Return React component or HTML
    throw new Error('render must be implemented');
  }
  
  async update() {
    const data = await this.fetchData();
    this.onUpdate(data);
  }
  
  start() {
    this.update();
    this.interval = setInterval(() => this.update(), this.updateInterval);
  }
  
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }
}
```

### Example: System Monitor Widget

```javascript
class SystemMonitorWidget extends CustomWidget {
  constructor(config) {
    super({
      ...config,
      id: 'system-monitor',
      name: 'System Monitor',
      category: 'monitoring'
    });
  }
  
  async fetchData() {
    const response = await fetch('/api/system/stats');
    return response.json();
  }
  
  render() {
    return `
      <div class="system-monitor-widget">
        <h3>System Status</h3>
        <div id="cpu-usage"></div>
        <div id="memory-usage"></div>
        <div id="disk-usage"></div>
      </div>
    `;
  }
  
  onUpdate(data) {
    document.getElementById('cpu-usage').textContent = 
      `CPU: ${data.cpu}%`;
    document.getElementById('memory-usage').textContent = 
      `Memory: ${data.memory}%`;
    document.getElementById('disk-usage').textContent = 
      `Disk: ${data.disk}%`;
  }
}
```

## Third-Party Service Integration

### Prometheus Integration

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'appliance-dashboard'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/api/metrics'
    bearer_token: 'your-api-token'
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "Web Appliance Dashboard",
    "panels": [
      {
        "title": "Appliance Status",
        "targets": [
          {
            "expr": "appliance_status{job=\"appliance-dashboard\"}"
          }
        ]
      },
      {
        "title": "SSH Connections",
        "targets": [
          {
            "expr": "ssh_active_connections{job=\"appliance-dashboard\"}"
          }
        ]
      }
    ]
  }
}
```

### Slack Integration

```javascript
const { WebClient } = require('@slack/web-api');
const slack = new WebClient(process.env.SLACK_TOKEN);

class SlackIntegration {
  async notifyApplianceDown(appliance) {
    await slack.chat.postMessage({
      channel: '#monitoring',
      text: `⚠️ Appliance "${appliance.name}" is down!`,
      attachments: [{
        color: 'danger',
        fields: [
          { title: 'Appliance', value: appliance.name },
          { title: 'URL', value: appliance.url },
          { title: 'Last Seen', value: appliance.lastSeen }
        ]
      }]
    });
  }
  
  async notifySSHConnection(host, user) {
    await slack.chat.postMessage({
      channel: '#security',
      text: `🔐 SSH connection established`,
      attachments: [{
        color: 'good',
        fields: [
          { title: 'Host', value: host.hostname },
          { title: 'User', value: user.username },
          { title: 'Time', value: new Date().toISOString() }
        ]
      }]
    });
  }
}
```

## Monitoring Integration

### Health Check Endpoint

```javascript
// Implement custom health checks
app.get('/api/health/detailed', authenticateToken, async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.1.1',
    services: {}
  };
  
  // Check database
  try {
    await pool.execute('SELECT 1');
    health.services.database = { status: 'healthy' };
  } catch (error) {
    health.services.database = { status: 'unhealthy', error: error.message };
    health.status = 'degraded';
  }
  
  // Check SSH service
  try {
    const sshHosts = await pool.execute('SELECT COUNT(*) as count FROM ssh_hosts');
    health.services.ssh = { 
      status: 'healthy', 
      hosts: sshHosts[0][0].count 
    };
  } catch (error) {
    health.services.ssh = { status: 'unhealthy', error: error.message };
  }
  
  // Check Guacamole
  try {
    const response = await fetch('http://guacamole:8080/guacamole/api/tokens');
    health.services.guacamole = { 
      status: response.ok ? 'healthy' : 'unhealthy' 
    };
  } catch (error) {
    health.services.guacamole = { status: 'unhealthy', error: error.message };
  }
  
  res.json(health);
});
```

## Examples

### Complete Integration Example

```javascript
// Full integration example
class ApplianceDashboardIntegration {
  constructor(config) {
    this.config = config;
    this.api = new ApplianceDashboardClient(config.apiUrl, config.token);
    this.ssh = new SSHIntegration(this.api);
    this.remoteDesktop = new RemoteDesktopIntegration(this.api);
    this.slack = new SlackIntegration();
  }
  
  async monitorAppliances() {
    const appliances = await this.api.getAppliances();
    
    for (const appliance of appliances) {
      const status = await this.api.getApplianceStatus(appliance.id);
      
      if (status.status === 'offline') {
        await this.slack.notifyApplianceDown(appliance);
        
        // Try to restart via SSH
        if (appliance.ssh_host_id) {
          await this.ssh.executeCommand(
            appliance.ssh_host_id,
            'systemctl restart nginx'
          );
        }
      }
    }
  }
  
  async setupNewServer(serverConfig) {
    // Create SSH host
    const sshHost = await this.ssh.setupHost({
      hostname: serverConfig.hostname,
      host: serverConfig.ip,
      username: serverConfig.username,
      password: serverConfig.password
    });
    
    // Create appliance entry
    const appliance = await this.api.createAppliance({
      name: serverConfig.name,
      category: 'server',
      url: `https://${serverConfig.hostname}`,
      ssh_host_id: sshHost.id
    });
    
    // Setup remote desktop if needed
    if (serverConfig.enableVNC) {
      await this.remoteDesktop.createConnection({
        name: `${serverConfig.name} - VNC`,
        protocol: 'vnc',
        appliance_id: appliance.id,
        parameters: {
          hostname: serverConfig.ip,
          port: 5900,
          password: serverConfig.vncPassword
        }
      });
    }
    
    return appliance;
  }
}

// Usage
const integration = new ApplianceDashboardIntegration({
  apiUrl: 'http://localhost:3000/api',
  token: process.env.DASHBOARD_TOKEN
});

// Start monitoring
setInterval(() => integration.monitorAppliances(), 60000);
```

---

For more examples and SDK implementations, see [API Client SDKs](./api-client-sdks.md).

Last updated: January 2025 | Version: 1.1.1