# Web Appliance Dashboard API - Enhanced Documentation

## 🚀 Quick Start

### Base URL
```
Production: http://192.168.178.70:9080
Development: http://localhost:9080
```

### Authentication
All endpoints (except `/api/auth/login`) require JWT authentication:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

### Get Started in 3 Steps

1. **Login to get token:**
```bash
curl -X POST http://192.168.178.70:9080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

2. **Save the token:**
```bash
export TOKEN="eyJhbGciOiJIUzI1NiIs..."
```

3. **Make authenticated requests:**
```bash
curl -X GET http://192.168.178.70:9080/api/appliances \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📚 Complete API Examples

### 🔐 Authentication

#### Login
```bash
# cURL
curl -X POST http://192.168.178.70:9080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Python
import requests

response = requests.post(
    'http://192.168.178.70:9080/api/auth/login',
    json={'username': 'admin', 'password': 'admin123'}
)
token = response.json()['token']

# JavaScript
const response = await fetch('http://192.168.178.70:9080/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin123' })
});
const { token } = await response.json();
```

#### Get Current User
```bash
# cURL
curl -X GET http://192.168.178.70:9080/api/auth/me \
  -H "Authorization: Bearer $TOKEN"

# Python
user = requests.get(
    'http://192.168.178.70:9080/api/auth/me',
    headers={'Authorization': f'Bearer {token}'}
).json()

# JavaScript
const user = await fetch('http://192.168.178.70:9080/api/auth/me', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());
```

#### Change Password
```bash
# cURL
curl -X POST http://192.168.178.70:9080/api/auth/change-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "admin123",
    "newPassword": "newSecurePassword123"
  }'

# Python
requests.post(
    'http://192.168.178.70:9080/api/auth/change-password',
    headers={'Authorization': f'Bearer {token}'},
    json={
        'currentPassword': 'admin123',
        'newPassword': 'newSecurePassword123'
    }
)
```

### 📱 Appliances Management

#### List All Appliances
```bash
# cURL
curl -X GET http://192.168.178.70:9080/api/appliances \
  -H "Authorization: Bearer $TOKEN"

# Python with filtering
import requests

def get_appliances(category=None, favorites_only=False):
    response = requests.get(
        'http://192.168.178.70:9080/api/appliances',
        headers={'Authorization': f'Bearer {token}'}
    )
    appliances = response.json()
    
    if category:
        appliances = [a for a in appliances if a['category'] == category]
    if favorites_only:
        appliances = [a for a in appliances if a.get('isFavorite')]
    
    return appliances

# Get only productivity appliances
prod_apps = get_appliances(category='productivity')
```

#### Create New Appliance
```javascript
// JavaScript with full configuration
async function createAppliance(applianceData) {
  const response = await fetch('http://192.168.178.70:9080/api/appliances', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Nextcloud',
      url: 'https://nextcloud.example.com',
      description: 'File sync and share platform',
      icon: 'Cloud',
      color: '#0082C9',
      category: 'productivity',
      // Service control
      startCommand: 'sudo systemctl start nextcloud',
      stopCommand: 'sudo systemctl stop nextcloud',
      statusCommand: 'sudo systemctl status nextcloud',
      sshConnection: 'deploy@192.168.1.50',
      // Remote desktop
      remoteDesktopEnabled: true,
      remoteProtocol: 'vnc',
      remoteHost: '192.168.1.50',
      remotePort: 5900,
      remoteUsername: 'admin',
      remotePassword: 'encrypted_password_here'
    })
  });
  
  return response.json();
}
```

#### Update Appliance
```python
# Python - Partial update
def update_appliance(appliance_id, updates):
    return requests.patch(
        f'http://192.168.178.70:9080/api/appliances/{appliance_id}',
        headers={'Authorization': f'Bearer {token}'},
        json=updates
    ).json()

# Toggle favorite
update_appliance(1, {'isFavorite': True})

# Update visual settings
update_appliance(1, {
    'color': '#FF5733',
    'icon': 'Server',
    'transparency': 0.9
})
```

#### Check Appliance Status
```javascript
// JavaScript - Real-time status monitoring
async function monitorApplianceStatus(applianceIds) {
  const checkStatus = async () => {
    const response = await fetch('http://192.168.178.70:9080/api/status-check', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ applianceIds })
    });
    
    const statuses = await response.json();
    
    // Process status updates
    Object.entries(statuses).forEach(([id, status]) => {
      console.log(`Appliance ${id}: ${status.status} (${status.responseTime}ms)`);
      if (status.error) {
        console.error(`Error: ${status.error}`);
      }
    });
    
    return statuses;
  };
  
  // Check immediately
  await checkStatus();
  
  // Then check every 30 seconds
  setInterval(checkStatus, 30000);
}

// Monitor appliances 1, 2, and 3
monitorApplianceStatus([1, 2, 3]);
```

### 🏷️ Categories Management

#### Create Custom Category
```bash
# cURL
curl -X POST http://192.168.178.70:9080/api/categories \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "custom_tools",
    "display_name": "Custom Tools",
    "icon": "Wrench",
    "color": "#FF6B6B"
  }'
```

#### Reorder Categories
```python
# Python
def reorder_categories(category_order):
    """
    category_order: list of tuples (category_id, order_index)
    """
    categories = [
        {'id': cat_id, 'order_index': idx} 
        for cat_id, idx in category_order
    ]
    
    return requests.put(
        'http://192.168.178.70:9080/api/categories/reorder',
        headers={'Authorization': f'Bearer {token}'},
        json={'categories': categories}
    ).json()

# Set new order
reorder_categories([
    (1, 0),  # productivity first
    (2, 1),  # development second
    (5, 2),  # custom_tools third
])
```

### 🔗 SSH Management

#### Generate SSH Key Pair
```javascript
// JavaScript
async function generateSSHKey(keyName) {
  const response = await fetch('http://192.168.178.70:9080/api/ssh/keys/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: keyName,
      passphrase: '' // Optional passphrase
    })
  });
  
  const keyData = await response.json();
  
  // IMPORTANT: Save the private key - it's only returned once!
  console.log('Save this private key securely:');
  console.log(keyData.privateKey);
  
  return keyData;
}
```

#### Setup SSH Host
```python
# Python - Complete SSH host setup
import requests

def setup_ssh_host(host_config):
    # 1. Create SSH host
    host = requests.post(
        'http://192.168.178.70:9080/api/ssh/hosts',
        headers={'Authorization': f'Bearer {token}'},
        json={
            'name': host_config['name'],
            'hostname': host_config['hostname'],
            'port': host_config.get('port', 22),
            'username': host_config['username'],
            'password': host_config.get('password'),
            'auth_method': 'password',
            'key_id': None
        }
    ).json()
    
    # 2. Test connection
    test_result = requests.post(
        'http://192.168.178.70:9080/api/ssh/test',
        headers={'Authorization': f'Bearer {token}'},
        json={
            'hostname': host_config['hostname'],
            'port': host_config.get('port', 22),
            'username': host_config['username'],
            'password': host_config.get('password')
        }
    ).json()
    
    if test_result['success']:
        print(f"✓ SSH host {host_config['name']} configured successfully")
        
        # 3. Optionally setup key authentication
        if host_config.get('setup_key'):
            key_setup = requests.post(
                'http://192.168.178.70:9080/api/ssh/setup-key',
                headers={'Authorization': f'Bearer {token}'},
                json={
                    'hostname': host_config['hostname'],
                    'port': host_config.get('port', 22),
                    'username': host_config['username'],
                    'password': host_config['password'],
                    'keyId': host_config.get('key_id', 1)
                }
            ).json()
            
            if key_setup['success']:
                print("✓ SSH key authentication configured")
    
    return host

# Example usage
setup_ssh_host({
    'name': 'Production Server',
    'hostname': '192.168.1.100',
    'username': 'deploy',
    'password': 'temp_password',
    'setup_key': True,
    'key_id': 1
})
```

### 📝 Commands Execution

#### Create and Execute Custom Command
```javascript
// JavaScript - Full command lifecycle
class CommandManager {
  constructor(token) {
    this.token = token;
    this.baseUrl = 'http://192.168.178.70:9080/api';
  }
  
  async createCommand(applianceId, commandData) {
    const response = await fetch(`${this.baseUrl}/commands`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        appliance_id: applianceId,
        name: commandData.name,
        command: commandData.command,
        icon: commandData.icon || 'Terminal',
        color: commandData.color || '#007AFF',
        requires_sudo: commandData.requiresSudo || false,
        confirmation_required: commandData.needsConfirmation || false,
        ssh_host_id: commandData.sshHostId
      })
    });
    
    return response.json();
  }
  
  async executeCommand(commandId, parameters = {}) {
    const response = await fetch(`${this.baseUrl}/commands/${commandId}/execute`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ parameters })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('Command output:', result.output);
    } else {
      console.error('Command failed:', result.error);
    }
    
    return result;
  }
}

// Usage
const cmdManager = new CommandManager(token);

// Create a restart command
const restartCmd = await cmdManager.createCommand(1, {
  name: 'Restart Nginx',
  command: 'sudo systemctl restart nginx',
  icon: 'RotateCw',
  color: '#FF5733',
  requiresSudo: true,
  needsConfirmation: true,
  sshHostId: 1
});

// Execute it
await cmdManager.executeCommand(restartCmd.id);
```

### 🖥️ Terminal Sessions

#### WebSocket Terminal Connection
```javascript
// JavaScript - Interactive terminal
class TerminalSession {
  constructor(token, hostId) {
    this.token = token;
    this.hostId = hostId;
    this.ws = null;
  }
  
  connect() {
    const wsUrl = `ws://192.168.178.70:9080/api/terminal/connect?token=${this.token}&hostId=${this.hostId}`;
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      console.log('Terminal connected');
      // Send initial terminal size
      this.resize(80, 24);
    };
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'output') {
        process.stdout.write(data.data);
      } else if (data.type === 'error') {
        console.error('Terminal error:', data.message);
      }
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    this.ws.onclose = () => {
      console.log('Terminal disconnected');
    };
  }
  
  send(command) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'input',
        data: command + '\n'
      }));
    }
  }
  
  resize(cols, rows) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'resize',
        cols: cols,
        rows: rows
      }));
    }
  }
  
  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Usage
const terminal = new TerminalSession(token, 1);
terminal.connect();

// Send commands
terminal.send('ls -la');
terminal.send('docker ps');
```

### 🖥️ Remote Desktop (Guacamole)

#### Get Remote Desktop Access
```python
# Python - Open remote desktop session
import webbrowser
import requests
import time

def open_remote_desktop(appliance_id, token):
    # 1. Get temporary access token
    response = requests.post(
        f'http://192.168.178.70:9080/api/guacamole/token',
        headers={'Authorization': f'Bearer {token}'},
        json={'applianceId': appliance_id}
    )
    
    if response.status_code == 200:
        data = response.json()
        
        # 2. Build full URL
        remote_url = f"http://192.168.178.70:9080{data['url']}"
        
        print(f"Opening remote desktop session...")
        print(f"URL: {remote_url}")
        print(f"Expires at: {data['expiresAt']}")
        
        # 3. Open in browser
        webbrowser.open(remote_url)
        
        return data
    else:
        print(f"Failed to get remote access: {response.json()}")
        return None

# Open remote desktop for appliance 1
open_remote_desktop(1, token)
```

### 💾 Backup & Restore

#### Create Full Backup
```bash
# cURL - Download backup
curl -X GET http://192.168.178.70:9080/api/backup \
  -H "Authorization: Bearer $TOKEN" \
  -o "backup-$(date +%Y%m%d-%H%M%S).json"

# Python - Automated daily backup
import requests
from datetime import datetime
import schedule
import time

def create_backup():
    filename = f"backup-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
    
    response = requests.get(
        'http://192.168.178.70:9080/api/backup',
        headers={'Authorization': f'Bearer {token}'},
        stream=True
    )
    
    if response.status_code == 200:
        with open(filename, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        print(f"✓ Backup saved: {filename}")
        
        # Get backup stats
        stats = requests.get(
            'http://192.168.178.70:9080/api/backup/stats',
            headers={'Authorization': f'Bearer {token}'}
        ).json()
        
        print(f"  - Appliances: {stats['appliances']}")
        print(f"  - Users: {stats['users']}")
        print(f"  - SSH Hosts: {stats['sshHosts']}")
    else:
        print(f"✗ Backup failed: {response.status_code}")

# Schedule daily backup at 2 AM
schedule.every().day.at("02:00").do(create_backup)

# Run scheduler
while True:
    schedule.run_pending()
    time.sleep(60)
```

#### Selective Restore
```javascript
// JavaScript - Restore with options
async function selectiveRestore(backupFile, options = {}) {
  const formData = new FormData();
  formData.append('backup', backupFile);
  formData.append('options', JSON.stringify({
    appliances: options.appliances !== false,
    categories: options.categories !== false,
    users: options.users || false,
    sshHosts: options.sshHosts !== false,
    settings: options.settings !== false,
    auditLogs: options.auditLogs || false
  }));
  
  const response = await fetch('http://192.168.178.70:9080/api/restore', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  
  const result = await response.json();
  
  console.log('Restore completed:');
  console.log(`- Appliances: ${result.restored.appliances}`);
  console.log(`- Categories: ${result.restored.categories}`);
  console.log(`- Settings: ${result.restored.settings}`);
  
  return result;
}

// Example: Restore only appliances and categories
const fileInput = document.querySelector('#backup-file');
await selectiveRestore(fileInput.files[0], {
  appliances: true,
  categories: true,
  users: false,
  settings: false
});
```

### 🎨 Background Management

#### Upload and Set Background
```python
# Python - Complete background workflow
import requests

class BackgroundManager:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.token = token
        self.headers = {'Authorization': f'Bearer {token}'}
    
    def upload_background(self, image_path):
        """Upload a new background image"""
        with open(image_path, 'rb') as f:
            files = {'image': f}
            response = requests.post(
                f'{self.base_url}/api/background/upload',
                headers=self.headers,
                files=files
            )
        return response.json()
    
    def list_backgrounds(self):
        """Get all available backgrounds"""
        response = requests.get(
            f'{self.base_url}/api/background/list',
            headers=self.headers
        )
        return response.json()
    
    def set_active_background(self, background_id):
        """Set a background as active"""
        response = requests.post(
            f'{self.base_url}/api/background/set/{background_id}',
            headers=self.headers
        )
        return response.json()
    
    def delete_background(self, background_id):
        """Delete a background image"""
        response = requests.delete(
            f'{self.base_url}/api/background/{background_id}',
            headers=self.headers
        )
        return response.json()
    
    def disable_background(self):
        """Disable background image"""
        response = requests.post(
            f'{self.base_url}/api/background/disable',
            headers=self.headers
        )
        return response.json()

# Usage
bg_manager = BackgroundManager('http://192.168.178.70:9080', token)

# Upload new background
new_bg = bg_manager.upload_background('/path/to/image.jpg')
print(f"Uploaded: {new_bg['filename']}")

# List all backgrounds
backgrounds = bg_manager.list_backgrounds()
for bg in backgrounds:
    print(f"- {bg['filename']} {'(active)' if bg['isActive'] else ''}")

# Set the new background as active
bg_manager.set_active_background(new_bg['id'])
```

### 📊 Real-time Updates (SSE)

#### Server-Sent Events Client
```javascript
// JavaScript - Complete SSE implementation
class DashboardEventStream {
  constructor(token) {
    this.token = token;
    this.eventSource = null;
    this.handlers = new Map();
  }
  
  connect() {
    const url = `http://192.168.178.70:9080/api/sse?token=${this.token}`;
    this.eventSource = new EventSource(url);
    
    // Register event handlers
    this.setupEventHandlers();
    
    // Handle connection events
    this.eventSource.onerror = (error) => {
      console.error('SSE Error:', error);
      // Implement reconnection logic
      setTimeout(() => this.reconnect(), 5000);
    };
  }
  
  setupEventHandlers() {
    // Service status changes
    this.on('service_status_changed', (data) => {
      console.log(`Service ${data.name}: ${data.previousStatus} → ${data.status}`);
      this.updateUI('service', data);
    });
    
    // Appliance events
    this.on('appliance_created', (data) => {
      console.log(`New appliance: ${data.name}`);
      this.updateUI('appliance_new', data);
    });
    
    this.on('appliance_updated', (data) => {
      console.log(`Appliance ${data.id} updated`);
      this.updateUI('appliance_update', data);
    });
    
    this.on('appliance_deleted', (data) => {
      console.log(`Appliance ${data.id} deleted`);
      this.updateUI('appliance_delete', data);
    });
    
    // SSH host events
    this.on('ssh_host_created', (data) => {
      console.log(`SSH host created: ${data.hostname}`);
      this.updateUI('ssh_new', data);
    });
    
    // System notifications
    this.on('notification', (data) => {
      this.showNotification(data.type, data.message);
    });
  }
  
  on(eventType, handler) {
    this.handlers.set(eventType, handler);
    
    this.eventSource.addEventListener(eventType, (event) => {
      const data = JSON.parse(event.data);
      handler(data);
    });
  }
  
  updateUI(type, data) {
    // Implement UI updates based on event type
    document.dispatchEvent(new CustomEvent('dashboard-update', {
      detail: { type, data }
    }));
  }
  
  showNotification(type, message) {
    // Show toast/notification
    if (Notification.permission === 'granted') {
      new Notification('Web Appliance Dashboard', {
        body: message,
        icon: '/favicon.ico',
        badge: type === 'error' ? '❌' : '✓'
      });
    }
  }
  
  reconnect() {
    this.disconnect();
    this.connect();
  }
  
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}

// Usage
const eventStream = new DashboardEventStream(token);
eventStream.connect();

// Listen for dashboard updates in your UI
document.addEventListener('dashboard-update', (event) => {
  const { type, data } = event.detail;
  // Update your React/Vue/Angular components
  console.log('UI Update needed:', type, data);
});
```

### 🔒 User & Role Management

#### Complete User Management
```python
# Python - User administration
class UserAdmin:
    def __init__(self, base_url, admin_token):
        self.base_url = base_url
        self.headers = {'Authorization': f'Bearer {admin_token}'}
    
    def create_user(self, username, email, password, role='user'):
        """Create a new user"""
        response = requests.post(
            f'{self.base_url}/api/auth/users',
            headers=self.headers,
            json={
                'username': username,
                'email': email,
                'password': password,
                'role': role
            }
        )
        return response.json()
    
    def list_users(self):
        """Get all users"""
        response = requests.get(
            f'{self.base_url}/api/auth/users',
            headers=self.headers
        )
        return response.json()
    
    def update_user_role(self, user_id, new_role):
        """Change user role"""
        response = requests.put(
            f'{self.base_url}/api/roles/users/{user_id}/role',
            headers=self.headers,
            json={'role': new_role}
        )
        return response.json()
    
    def set_appliance_permissions(self, user_id, appliance_id, permissions):
        """Set specific appliance permissions for a user"""
        response = requests.put(
            f'{self.base_url}/api/roles/users/{user_id}/appliances/{appliance_id}',
            headers=self.headers,
            json=permissions
        )
        return response.json()
    
    def toggle_user_status(self, user_id):
        """Enable/disable user account"""
        response = requests.put(
            f'{self.base_url}/api/auth/users/{user_id}/toggle-active',
            headers=self.headers
        )
        return response.json()

# Usage
admin = UserAdmin('http://192.168.178.70:9080', admin_token)

# Create a new limited user
new_user = admin.create_user(
    username='viewer',
    email='viewer@example.com',
    password='secure_password_123',
    role='user'
)

# Grant specific permissions
admin.set_appliance_permissions(new_user['id'], 1, {
    'canView': True,
    'canEdit': False,
    'canDelete': False,
    'canControl': False
})

# List all users and their roles
users = admin.list_users()
for user in users:
    print(f"{user['username']} - {user['role']} - {'Active' if user['isActive'] else 'Inactive'}")
```

### 🔍 Audit & History

#### Audit Log Analysis
```javascript
// JavaScript - Audit log monitoring and analysis
class AuditAnalyzer {
  constructor(token) {
    this.token = token;
    this.baseUrl = 'http://192.168.178.70:9080/api';
  }
  
  async getAuditLogs(filters = {}) {
    const params = new URLSearchParams({
      limit: filters.limit || 100,
      offset: filters.offset || 0,
      ...(filters.action && { action: filters.action }),
      ...(filters.userId && { userId: filters.userId }),
      ...(filters.startDate && { startDate: filters.startDate }),
      ...(filters.endDate && { endDate: filters.endDate })
    });
    
    const response = await fetch(`${this.baseUrl}/audit-logs?${params}`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    
    return response.json();
  }
  
  async getResourceHistory(resourceType, resourceId) {
    const response = await fetch(
      `${this.baseUrl}/audit-logs/history/${resourceType}/${resourceId}`,
      { headers: { 'Authorization': `Bearer ${this.token}` } }
    );
    
    return response.json();
  }
  
  async restoreFromAudit(logId, resourceType) {
    const response = await fetch(
      `${this.baseUrl}/audit-restore/restore/${resourceType}/${logId}`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.token}` }
      }
    );
    
    return response.json();
  }
  
  async revertToAudit(logId, resourceType) {
    const response = await fetch(
      `${this.baseUrl}/audit-restore/revert/${resourceType}/${logId}`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.token}` }
      }
    );
    
    return response.json();
  }
  
  async generateSecurityReport(days = 7) {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];
    
    const logs = await this.getAuditLogs({ startDate, endDate, limit: 1000 });
    
    // Analyze patterns
    const report = {
      totalActions: logs.total,
      period: { startDate, endDate },
      userActivity: {},
      actionTypes: {},
      deletions: [],
      modifications: [],
      logins: [],
      suspiciousActivity: []
    };
    
    logs.logs.forEach(log => {
      // User activity
      if (!report.userActivity[log.username]) {
        report.userActivity[log.username] = 0;
      }
      report.userActivity[log.username]++;
      
      // Action types
      if (!report.actionTypes[log.action]) {
        report.actionTypes[log.action] = 0;
      }
      report.actionTypes[log.action]++;
      
      // Track important events
      if (log.action.includes('deleted')) {
        report.deletions.push(log);
      }
      if (log.action.includes('updated')) {
        report.modifications.push(log);
      }
      if (log.action === 'login') {
        report.logins.push(log);
      }
      
      // Detect suspicious patterns
      if (this.isSuspicious(log)) {
        report.suspiciousActivity.push(log);
      }
    });
    
    return report;
  }
  
  isSuspicious(log) {
    // Define suspicious patterns
    const suspiciousActions = [
      'user_deleted',
      'settings_updated',
      'backup_restored'
    ];
    
    const suspiciousHours = [0, 1, 2, 3, 4, 5]; // 12 AM - 5 AM
    const logHour = new Date(log.timestamp).getHours();
    
    return suspiciousActions.includes(log.action) || 
           suspiciousHours.includes(logHour);
  }
}

// Usage
const analyzer = new AuditAnalyzer(token);

// Get security report for last week
const report = await analyzer.generateSecurityReport(7);
console.log('Security Report:', report);

// Check history of a specific appliance
const history = await analyzer.getResourceHistory('appliance', 1);
console.log('Appliance history:', history);

// Restore a deleted resource
if (report.deletions.length > 0) {
  const deleted = report.deletions[0];
  if (confirm(`Restore ${deleted.resource_type} ${deleted.resource_id}?`)) {
    await analyzer.restoreFromAudit(deleted.id, deleted.resource_type);
  }
}
```

### 🛠️ Advanced Examples

#### Automated Health Monitoring
```python
# Python - Complete monitoring solution
import requests
import time
import smtplib
from email.mime.text import MIMEText
from datetime import datetime
import json

class HealthMonitor:
    def __init__(self, base_url, token, alert_email=None):
        self.base_url = base_url
        self.token = token
        self.alert_email = alert_email
        self.headers = {'Authorization': f'Bearer {token}'}
        self.status_history = {}
    
    def check_all_appliances(self):
        """Check status of all appliances"""
        # Get all appliances
        appliances = requests.get(
            f'{self.base_url}/api/appliances',
            headers=self.headers
        ).json()
        
        appliance_ids = [app['id'] for app in appliances]
        
        # Check status
        status_response = requests.post(
            f'{self.base_url}/api/status-check',
            headers=self.headers,
            json={'applianceIds': appliance_ids}
        ).json()
        
        # Analyze results
        alerts = []
        for app in appliances:
            app_id = str(app['id'])
            status = status_response.get(app_id, {})
            
            # Check for status changes
            prev_status = self.status_history.get(app_id, {}).get('status')
            current_status = status.get('status', 'unknown')
            
            if prev_status and prev_status != current_status:
                alerts.append({
                    'appliance': app['name'],
                    'previous': prev_status,
                    'current': current_status,
                    'time': datetime.now().isoformat()
                })
            
            # Check response time
            if current_status == 'online' and status.get('responseTime', 0) > 5000:
                alerts.append({
                    'appliance': app['name'],
                    'issue': 'slow_response',
                    'responseTime': status['responseTime'],
                    'time': datetime.now().isoformat()
                })
            
            self.status_history[app_id] = status
        
        return {
            'timestamp': datetime.now().isoformat(),
            'total_appliances': len(appliances),
            'online': sum(1 for s in status_response.values() if s.get('status') == 'online'),
            'offline': sum(1 for s in status_response.values() if s.get('status') == 'offline'),
            'alerts': alerts
        }
    
    def send_alert(self, alerts):
        """Send email alerts"""
        if not self.alert_email or not alerts:
            return
        
        message = "Web Appliance Dashboard Alerts\n\n"
        for alert in alerts:
            message += f"- {alert}\n"
        
        # Send email (configure SMTP settings)
        # ... email sending code ...
    
    def continuous_monitoring(self, interval_seconds=300):
        """Run continuous monitoring"""
        print(f"Starting health monitoring (checking every {interval_seconds}s)")
        
        while True:
            try:
                result = self.check_all_appliances()
                
                print(f"\n[{result['timestamp']}] Health Check:")
                print(f"  Total: {result['total_appliances']}")
                print(f"  Online: {result['online']}")
                print(f"  Offline: {result['offline']}")
                
                if result['alerts']:
                    print("  ALERTS:")
                    for alert in result['alerts']:
                        print(f"    - {alert}")
                    
                    self.send_alert(result['alerts'])
                
                # Save to log file
                with open('health_monitor.log', 'a') as f:
                    f.write(json.dumps(result) + '\n')
                
            except Exception as e:
                print(f"Monitoring error: {e}")
            
            time.sleep(interval_seconds)

# Usage
monitor = HealthMonitor(
    'http://192.168.178.70:9080',
    token,
    alert_email='admin@example.com'
)

# Run continuous monitoring
monitor.continuous_monitoring(interval_seconds=300)  # Check every 5 minutes
```

#### Bulk Operations Script
```bash
#!/bin/bash
# Bulk appliance management script

BASE_URL="http://192.168.178.70:9080"
TOKEN="your_token_here"

# Function to make API calls
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    if [ -z "$data" ]; then
        curl -s -X $method "$BASE_URL$endpoint" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json"
    else
        curl -s -X $method "$BASE_URL$endpoint" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -d "$data"
    fi
}

# Bulk create appliances from CSV
bulk_create_from_csv() {
    local csv_file=$1
    
    while IFS=',' read -r name url category description; do
        [ "$name" = "name" ] && continue  # Skip header
        
        data=$(cat <<EOF
{
    "name": "$name",
    "url": "$url",
    "category": "$category",
    "description": "$description",
    "icon": "Globe",
    "color": "#007AFF"
}
EOF
)
        
        echo "Creating appliance: $name"
        api_call POST "/api/appliances" "$data"
        echo
    done < "$csv_file"
}

# Bulk status check
check_all_status() {
    echo "Fetching all appliances..."
    appliances=$(api_call GET "/api/appliances")
    
    ids=$(echo "$appliances" | jq -r '.[].id' | tr '\n' ',' | sed 's/,$//')
    ids_array="[${ids//,/,}]"
    
    echo "Checking status for all appliances..."
    statuses=$(api_call POST "/api/status-check" "{\"applianceIds\": $ids_array}")
    
    echo "$statuses" | jq -r 'to_entries[] | "\(.key): \(.value.status) (\(.value.responseTime)ms)"'
}

# Backup with timestamp
create_backup() {
    timestamp=$(date +%Y%m%d_%H%M%S)
    filename="backup_${timestamp}.json"
    
    echo "Creating backup: $filename"
    api_call GET "/api/backup" > "$filename"
    echo "Backup saved to: $filename"
}

# Main menu
case "$1" in
    "bulk-create")
        bulk_create_from_csv "$2"
        ;;
    "check-status")
        check_all_status
        ;;
    "backup")
        create_backup
        ;;
    *)
        echo "Usage: $0 {bulk-create <csv_file>|check-status|backup}"
        exit 1
        ;;
esac
```

## 🔒 Security Best Practices

### Token Management
```javascript
// Secure token storage and refresh
class TokenManager {
  constructor() {
    this.tokenKey = 'wad_auth_token';
    this.refreshKey = 'wad_refresh_token';
  }
  
  saveToken(token, refreshToken) {
    // Use secure storage in production
    sessionStorage.setItem(this.tokenKey, token);
    if (refreshToken) {
      sessionStorage.setItem(this.refreshKey, refreshToken);
    }
  }
  
  getToken() {
    return sessionStorage.getItem(this.tokenKey);
  }
  
  clearToken() {
    sessionStorage.removeItem(this.tokenKey);
    sessionStorage.removeItem(this.refreshKey);
  }
  
  async refreshToken() {
    const refreshToken = sessionStorage.getItem(this.refreshKey);
    if (!refreshToken) return null;
    
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });
      
      if (response.ok) {
        const { token } = await response.json();
        this.saveToken(token);
        return token;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }
    
    return null;
  }
  
  // Auto-refresh before expiration
  setupAutoRefresh() {
    setInterval(async () => {
      const token = this.getToken();
      if (token) {
        // Check if token expires in next 5 minutes
        const payload = JSON.parse(atob(token.split('.')[1]));
        const expiresIn = payload.exp * 1000 - Date.now();
        
        if (expiresIn < 5 * 60 * 1000) {
          await this.refreshToken();
        }
      }
    }, 60000); // Check every minute
  }
}
```

### Request Interceptor
```python
# Python - Automatic retry with token refresh
import requests
from functools import wraps
import time

class APIClient:
    def __init__(self, base_url):
        self.base_url = base_url
        self.token = None
        self.session = requests.Session()
    
    def login(self, username, password):
        response = self.session.post(
            f'{self.base_url}/api/auth/login',
            json={'username': username, 'password': password}
        )
        if response.status_code == 200:
            self.token = response.json()['token']
            self.session.headers.update({'Authorization': f'Bearer {self.token}'})
            return True
        return False
    
    def auto_retry(max_retries=3):
        def decorator(func):
            @wraps(func)
            def wrapper(self, *args, **kwargs):
                for attempt in range(max_retries):
                    try:
                        response = func(self, *args, **kwargs)
                        
                        # If unauthorized, try to refresh token
                        if response.status_code == 401 and attempt < max_retries - 1:
                            print("Token expired, refreshing...")
                            # Implement token refresh logic
                            time.sleep(1)
                            continue
                        
                        response.raise_for_status()
                        return response
                    
                    except requests.exceptions.RequestException as e:
                        if attempt == max_retries - 1:
                            raise
                        print(f"Request failed (attempt {attempt + 1}/{max_retries}): {e}")
                        time.sleep(2 ** attempt)  # Exponential backoff
                
            return wrapper
        return decorator
    
    @auto_retry()
    def get(self, endpoint):
        return self.session.get(f'{self.base_url}{endpoint}')
    
    @auto_retry()
    def post(self, endpoint, data=None, json=None):
        return self.session.post(f'{self.base_url}{endpoint}', data=data, json=json)
    
    @auto_retry()
    def put(self, endpoint, data=None, json=None):
        return self.session.put(f'{self.base_url}{endpoint}', data=data, json=json)
    
    @auto_retry()
    def delete(self, endpoint):
        return self.session.delete(f'{self.base_url}{endpoint}')

# Usage
client = APIClient('http://192.168.178.70:9080')
client.login('admin', 'admin123')

# All requests now have automatic retry and token handling
appliances = client.get('/api/appliances').json()
```

## 📖 Additional Resources

- **Swagger UI**: http://192.168.178.70:9080/api-docs
- **WebSocket Terminal**: ws://192.168.178.70:9080/api/terminal/connect
- **SSE Events**: http://192.168.178.70:9080/api/sse
- **GitHub**: https://github.com/alflewerken/web-appliance-dashboard

## 🆘 Troubleshooting

### Common Issues

1. **401 Unauthorized**
   - Token expired - login again
   - Missing Authorization header
   - Invalid token format

2. **CORS Errors**
   - Check ALLOWED_ORIGINS in .env
   - Ensure frontend URL is whitelisted

3. **WebSocket Connection Failed**
   - Check if behind proxy
   - Ensure WebSocket upgrade headers are passed
   - Verify token in query parameter

4. **SSE Not Working**
   - Check proxy buffering settings
   - Ensure Connection: keep-alive
   - Verify token in query parameter

## 📝 Version History

- **v1.1.0**: Remote Desktop Integration, Enhanced Backup/Restore
- **v1.0.4**: SSH Management, Audit Logs, Role-Based Access
- **v1.0.1**: Service Panel, Favorites, Custom Commands
- **v1.0.0**: Initial Release
