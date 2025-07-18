# Web Appliance Dashboard API Documentation

## Overview

The Web Appliance Dashboard API provides a comprehensive set of endpoints for managing appliances, categories, services, and system settings. All endpoints require JWT authentication unless otherwise specified.

## Base URL

- Development: `http://localhost:3001`
- Production: Configure according to your deployment

## Authentication

All API endpoints (except `/api/auth/login`) require a JWT token. Include the token in the Authorization header:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

## API Endpoints with Examples

### Authentication

#### Login

**POST** `/api/auth/login`

Authenticate a user and receive a JWT token.

**Request Body:**
```json
{
  "username": "admin",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin"
  }
}
```

**Examples:**

##### curl
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}'
```

##### Python
```python
import requests

url = "http://localhost:3001/api/auth/login"
payload = {
    "username": "admin",
    "password": "password123"
}

response = requests.post(url, json=payload)
data = response.json()
token = data['token']
print(f"Token: {token}")
```

##### JavaScript (fetch)
```javascript
const login = async () => {
  const response = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: 'admin',
      password: 'password123'
    })
  });
  
  const data = await response.json();
  const token = data.token;
  console.log('Token:', token);
  return token;
};
```

### Appliances

#### Get All Appliances

**GET** `/api/appliances`

Retrieve all appliances.

**Headers:**
- `Authorization: Bearer YOUR_JWT_TOKEN`

**Response:**
```json
[
  {
    "id": 1,
    "name": "My Server",
    "url": "http://192.168.1.100:8080",
    "description": "Main production server",
    "icon": "Server",
    "color": "#007AFF",
    "category": "productivity",
    "isFavorite": false,
    "statusCommand": "systemctl status myservice",
    "sshConnection": "user@192.168.1.100"
  }
]
```

**Examples:**

##### curl
```bash
# First, get the token
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}' | jq -r '.token')

# Then, get appliances
curl -X GET http://localhost:3001/api/appliances \
  -H "Authorization: Bearer $TOKEN"
```

##### Python
```python
import requests

# Assuming you have the token from login
headers = {
    'Authorization': f'Bearer {token}'
}

response = requests.get('http://localhost:3001/api/appliances', headers=headers)
appliances = response.json()

for appliance in appliances:
    print(f"Name: {appliance['name']}, URL: {appliance['url']}")
```

##### JavaScript
```javascript
const getAppliances = async (token) => {
  const response = await fetch('http://localhost:3001/api/appliances', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const appliances = await response.json();
  console.log('Appliances:', appliances);
  return appliances;
};
```

#### Create Appliance

**POST** `/api/appliances`

Create a new appliance.

**Headers:**
- `Authorization: Bearer YOUR_JWT_TOKEN`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "name": "New Server",
  "url": "http://192.168.1.101:8080",
  "description": "Development server",
  "icon": "Server",
  "color": "#FF5733",
  "category": "development",
  "statusCommand": "systemctl status nginx",
  "sshConnection": "dev@192.168.1.101"
}
```

**Examples:**

##### curl
```bash
curl -X POST http://localhost:3001/api/appliances \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Server",
    "url": "http://192.168.1.101:8080",
    "description": "Development server",
    "icon": "Server",
    "color": "#FF5733",
    "category": "development"
  }'
```

##### Python
```python
import requests

new_appliance = {
    "name": "New Server",
    "url": "http://192.168.1.101:8080",
    "description": "Development server",
    "icon": "Server",
    "color": "#FF5733",
    "category": "development"
}

response = requests.post(
    'http://localhost:3001/api/appliances',
    headers={'Authorization': f'Bearer {token}'},
    json=new_appliance
)

created_appliance = response.json()
print(f"Created appliance with ID: {created_appliance['id']}")
```

##### JavaScript
```javascript
const createAppliance = async (token, applianceData) => {
  const response = await fetch('http://localhost:3001/api/appliances', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(applianceData)
  });
  
  const newAppliance = await response.json();
  console.log('Created appliance:', newAppliance);
  return newAppliance;
};
```

#### Update Appliance

**PUT** `/api/appliances/:id`

Update an existing appliance.

**Headers:**
- `Authorization: Bearer YOUR_JWT_TOKEN`
- `Content-Type: application/json`

**Parameters:**
- `id` (integer): The appliance ID

**Request Body:**
```json
{
  "name": "Updated Server Name",
  "description": "Updated description"
}
```

**Examples:**

##### curl
```bash
curl -X PUT http://localhost:3001/api/appliances/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Server Name",
    "description": "Updated description"
  }'
```

##### Python
```python
import requests

appliance_id = 1
updates = {
    "name": "Updated Server Name",
    "description": "Updated description"
}

response = requests.put(
    f'http://localhost:3001/api/appliances/{appliance_id}',
    headers={'Authorization': f'Bearer {token}'},
    json=updates
)

updated_appliance = response.json()
print(f"Updated appliance: {updated_appliance}")
```

##### JavaScript
```javascript
const updateAppliance = async (token, applianceId, updates) => {
  const response = await fetch(`http://localhost:3001/api/appliances/${applianceId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  });
  
  const updatedAppliance = await response.json();
  console.log('Updated appliance:', updatedAppliance);
  return updatedAppliance;
};
```

#### Delete Appliance

**DELETE** `/api/appliances/:id`

Delete an appliance.

**Headers:**
- `Authorization: Bearer YOUR_JWT_TOKEN`

**Parameters:**
- `id` (integer): The appliance ID

**Examples:**

##### curl
```bash
curl -X DELETE http://localhost:3001/api/appliances/1 \
  -H "Authorization: Bearer $TOKEN"
```

##### Python
```python
import requests

appliance_id = 1

response = requests.delete(
    f'http://localhost:3001/api/appliances/{appliance_id}',
    headers={'Authorization': f'Bearer {token}'}
)

if response.status_code == 200:
    print("Appliance deleted successfully")
else:
    print(f"Error: {response.json()}")
```

##### JavaScript
```javascript
const deleteAppliance = async (token, applianceId) => {
  const response = await fetch(`http://localhost:3001/api/appliances/${applianceId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (response.ok) {
    console.log('Appliance deleted successfully');
  } else {
    const error = await response.json();
    console.error('Error:', error);
  }
};
```

### Categories

#### Get All Categories

**GET** `/api/categories`

Retrieve all categories with appliance counts.

**Headers:**
- `Authorization: Bearer YOUR_JWT_TOKEN`

**Response:**
```json
[
  {
    "id": 1,
    "name": "productivity",
    "display_name": "Productivity",
    "icon": "Briefcase",
    "color": "#007AFF",
    "order_index": 0,
    "is_system": true,
    "applianceCount": 5
  }
]
```

**Examples:**

##### curl
```bash
curl -X GET http://localhost:3001/api/categories \
  -H "Authorization: Bearer $TOKEN"
```

##### Python
```python
import requests

response = requests.get(
    'http://localhost:3001/api/categories',
    headers={'Authorization': f'Bearer {token}'}
)

categories = response.json()
for category in categories:
    print(f"{category['display_name']}: {category['applianceCount']} appliances")
```

##### JavaScript
```javascript
const getCategories = async (token) => {
  const response = await fetch('http://localhost:3001/api/categories', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const categories = await response.json();
  console.log('Categories:', categories);
  return categories;
};
```

### Services

#### Get All Services

**GET** `/api/services`

Retrieve all system services.

**Headers:**
- `Authorization: Bearer YOUR_JWT_TOKEN`

**Response:**
```json
[
  {
    "id": 1,
    "name": "nginx",
    "displayName": "Nginx Web Server",
    "status": "running",
    "isEnabled": true
  }
]
```

**Examples:**

##### curl
```bash
curl -X GET http://localhost:3001/api/services \
  -H "Authorization: Bearer $TOKEN"
```

##### Python
```python
import requests

response = requests.get(
    'http://localhost:3001/api/services',
    headers={'Authorization': f'Bearer {token}'}
)

services = response.json()
for service in services:
    print(f"{service['displayName']}: {service['status']}")
```

##### JavaScript
```javascript
const getServices = async (token) => {
  const response = await fetch('http://localhost:3001/api/services', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const services = await response.json();
  console.log('Services:', services);
  return services;
};
```

#### Control Service

**POST** `/api/services/:name/:action`

Start, stop, or restart a service.

**Headers:**
- `Authorization: Bearer YOUR_JWT_TOKEN`

**Parameters:**
- `name` (string): Service name
- `action` (string): One of `start`, `stop`, or `restart`

**Examples:**

##### curl
```bash
# Start a service
curl -X POST http://localhost:3001/api/services/nginx/start \
  -H "Authorization: Bearer $TOKEN"

# Stop a service
curl -X POST http://localhost:3001/api/services/nginx/stop \
  -H "Authorization: Bearer $TOKEN"

# Restart a service
curl -X POST http://localhost:3001/api/services/nginx/restart \
  -H "Authorization: Bearer $TOKEN"
```

##### Python
```python
import requests

def control_service(token, service_name, action):
    response = requests.post(
        f'http://localhost:3001/api/services/{service_name}/{action}',
        headers={'Authorization': f'Bearer {token}'}
    )
    return response.json()

# Examples
result = control_service(token, 'nginx', 'restart')
print(f"Service action result: {result}")
```

##### JavaScript
```javascript
const controlService = async (token, serviceName, action) => {
  const response = await fetch(`http://localhost:3001/api/services/${serviceName}/${action}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const result = await response.json();
  console.log(`Service ${action} result:`, result);
  return result;
};

// Examples
await controlService(token, 'nginx', 'restart');
```

### Settings

#### Get All Settings

**GET** `/api/settings`

Retrieve all system settings.

**Headers:**
- `Authorization: Bearer YOUR_JWT_TOKEN`

**Response:**
```json
[
  {
    "key": "ssh_enabled",
    "value": "true"
  },
  {
    "key": "terminal_enabled",
    "value": "true"
  }
]
```

**Examples:**

##### curl
```bash
curl -X GET http://localhost:3001/api/settings \
  -H "Authorization: Bearer $TOKEN"
```

##### Python
```python
import requests

response = requests.get(
    'http://localhost:3001/api/settings',
    headers={'Authorization': f'Bearer {token}'}
)

settings = response.json()
settings_dict = {s['key']: s['value'] for s in settings}
print(f"SSH Enabled: {settings_dict.get('ssh_enabled', 'false')}")
```

##### JavaScript
```javascript
const getSettings = async (token) => {
  const response = await fetch('http://localhost:3001/api/settings', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const settings = await response.json();
  const settingsMap = Object.fromEntries(
    settings.map(s => [s.key, s.value])
  );
  console.log('Settings:', settingsMap);
  return settingsMap;
};
```

#### Update Setting

**PUT** `/api/settings/:key`

Update a system setting.

**Headers:**
- `Authorization: Bearer YOUR_JWT_TOKEN`
- `Content-Type: application/json`

**Parameters:**
- `key` (string): Setting key

**Request Body:**
```json
{
  "value": "true"
}
```

**Examples:**

##### curl
```bash
curl -X PUT http://localhost:3001/api/settings/ssh_enabled \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value":"false"}'
```

##### Python
```python
import requests

def update_setting(token, key, value):
    response = requests.put(
        f'http://localhost:3001/api/settings/{key}',
        headers={'Authorization': f'Bearer {token}'},
        json={'value': value}
    )
    return response.json()

# Disable SSH
result = update_setting(token, 'ssh_enabled', 'false')
print(f"Updated setting: {result}")
```

##### JavaScript
```javascript
const updateSetting = async (token, key, value) => {
  const response = await fetch(`http://localhost:3001/api/settings/${key}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ value })
  });
  
  const result = await response.json();
  console.log('Updated setting:', result);
  return result;
};

// Example: Disable SSH
await updateSetting(token, 'ssh_enabled', 'false');
```

### SSH Keys

#### Get SSH Keys

**GET** `/api/ssh/keys`

Retrieve all SSH keys.

**Headers:**
- `Authorization: Bearer YOUR_JWT_TOKEN`

**Response:**
```json
[
  {
    "id": 1,
    "name": "Production Server Key",
    "publicKey": "ssh-rsa AAAAB3NzaC1yc2...",
    "createdAt": "2024-01-01T00:00:00Z"
  }
]
```

**Examples:**

##### curl
```bash
curl -X GET http://localhost:3001/api/ssh/keys \
  -H "Authorization: Bearer $TOKEN"
```

##### Python
```python
import requests

response = requests.get(
    'http://localhost:3001/api/ssh/keys',
    headers={'Authorization': f'Bearer {token}'}
)

ssh_keys = response.json()
for key in ssh_keys:
    print(f"Key: {key['name']}")
    print(f"Public Key: {key['publicKey'][:50]}...")
```

##### JavaScript
```javascript
const getSSHKeys = async (token) => {
  const response = await fetch('http://localhost:3001/api/ssh/keys', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const keys = await response.json();
  console.log('SSH Keys:', keys);
  return keys;
};
```

#### Generate SSH Key

**POST** `/api/ssh/keys/generate`

Generate a new SSH key pair.

**Headers:**
- `Authorization: Bearer YOUR_JWT_TOKEN`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "name": "New SSH Key",
  "passphrase": "optional_passphrase"
}
```

**Response:**
```json
{
  "id": 2,
  "name": "New SSH Key",
  "publicKey": "ssh-rsa AAAAB3NzaC1yc2...",
  "privateKey": "-----BEGIN OPENSSH PRIVATE KEY-----\n..."
}
```

**Examples:**

##### curl
```bash
curl -X POST http://localhost:3001/api/ssh/keys/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"New SSH Key"}'
```

##### Python
```python
import requests

response = requests.post(
    'http://localhost:3001/api/ssh/keys/generate',
    headers={'Authorization': f'Bearer {token}'},
    json={'name': 'New SSH Key'}
)

new_key = response.json()
print(f"Generated key: {new_key['name']}")
print(f"Public Key: {new_key['publicKey']}")
# Save private key securely
with open('new_key.pem', 'w') as f:
    f.write(new_key['privateKey'])
```

##### JavaScript
```javascript
const generateSSHKey = async (token, name, passphrase = null) => {
  const response = await fetch('http://localhost:3001/api/ssh/keys/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name, passphrase })
  });
  
  const newKey = await response.json();
  console.log('Generated SSH Key:', newKey.name);
  // Handle private key securely
  return newKey;
};
```

### Backup & Restore

#### Create Backup

**POST** `/api/backup`

Create a system backup.

**Headers:**
- `Authorization: Bearer YOUR_JWT_TOKEN`

**Response:**
- Returns a downloadable backup file (tar.gz)

**Examples:**

##### curl
```bash
# Create backup and save to file
curl -X POST http://localhost:3001/api/backup \
  -H "Authorization: Bearer $TOKEN" \
  -o backup-$(date +%Y%m%d-%H%M%S).tar.gz
```

##### Python
```python
import requests
from datetime import datetime

response = requests.post(
    'http://localhost:3001/api/backup',
    headers={'Authorization': f'Bearer {token}'}
)

if response.status_code == 200:
    filename = f"backup-{datetime.now().strftime('%Y%m%d-%H%M%S')}.tar.gz"
    with open(filename, 'wb') as f:
        f.write(response.content)
    print(f"Backup saved to {filename}")
```

##### JavaScript
```javascript
const createBackup = async (token) => {
  const response = await fetch('http://localhost:3001/api/backup', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (response.ok) {
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-${new Date().toISOString().slice(0,10)}.tar.gz`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
};
```

#### Restore Backup

**POST** `/api/restore`

Restore from a backup file.

**Headers:**
- `Authorization: Bearer YOUR_JWT_TOKEN`
- `Content-Type: multipart/form-data`

**Request:**
- File upload with backup archive

**Examples:**

##### curl
```bash
curl -X POST http://localhost:3001/api/restore \
  -H "Authorization: Bearer $TOKEN" \
  -F "backup=@/path/to/backup.tar.gz"
```

##### Python
```python
import requests

with open('backup.tar.gz', 'rb') as f:
    files = {'backup': f}
    response = requests.post(
        'http://localhost:3001/api/restore',
        headers={'Authorization': f'Bearer {token}'},
        files=files
    )

if response.status_code == 200:
    print("Restore completed successfully")
else:
    print(f"Restore failed: {response.json()}")
```

##### JavaScript
```javascript
const restoreBackup = async (token, file) => {
  const formData = new FormData();
  formData.append('backup', file);
  
  const response = await fetch('http://localhost:3001/api/restore', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  
  if (response.ok) {
    console.log('Restore completed successfully');
  } else {
    const error = await response.json();
    console.error('Restore failed:', error);
  }
};

// Usage with file input
const fileInput = document.getElementById('backup-file');
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    restoreBackup(token, file);
  }
});
```

### Audit Logs

#### Get Audit Logs

**GET** `/api/audit-logs`

Retrieve audit logs with optional filtering.

**Headers:**
- `Authorization: Bearer YOUR_JWT_TOKEN`

**Query Parameters:**
- `limit` (integer): Number of logs to retrieve (default: 100)
- `offset` (integer): Pagination offset (default: 0)
- `action` (string): Filter by action type
- `userId` (integer): Filter by user ID

**Response:**
```json
{
  "logs": [
    {
      "id": 1,
      "userId": 1,
      "action": "appliance_created",
      "resourceType": "appliance",
      "resourceId": 42,
      "details": {
        "name": "New Server"
      },
      "timestamp": "2024-01-01T00:00:00Z",
      "username": "admin"
    }
  ],
  "total": 150
}
```

**Examples:**

##### curl
```bash
# Get latest 50 audit logs
curl -X GET "http://localhost:3001/api/audit-logs?limit=50" \
  -H "Authorization: Bearer $TOKEN"

# Get logs for specific action
curl -X GET "http://localhost:3001/api/audit-logs?action=appliance_created" \
  -H "Authorization: Bearer $TOKEN"
```

##### Python
```python
import requests

def get_audit_logs(token, limit=100, offset=0, action=None):
    params = {'limit': limit, 'offset': offset}
    if action:
        params['action'] = action
    
    response = requests.get(
        'http://localhost:3001/api/audit-logs',
        headers={'Authorization': f'Bearer {token}'},
        params=params
    )
    return response.json()

# Get all appliance creation logs
logs_data = get_audit_logs(token, action='appliance_created')
for log in logs_data['logs']:
    print(f"{log['timestamp']}: {log['username']} - {log['action']}")
```

##### JavaScript
```javascript
const getAuditLogs = async (token, options = {}) => {
  const params = new URLSearchParams({
    limit: options.limit || 100,
    offset: options.offset || 0,
    ...(options.action && { action: options.action }),
    ...(options.userId && { userId: options.userId })
  });
  
  const response = await fetch(`http://localhost:3001/api/audit-logs?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  console.log(`Found ${data.total} logs`);
  return data;
};

// Example: Get logs for appliance updates
const logs = await getAuditLogs(token, { action: 'appliance_updated' });
```

### Status Check

#### Check Appliance Status

**POST** `/api/status-check`

Check the status of one or more appliances.

**Headers:**
- `Authorization: Bearer YOUR_JWT_TOKEN`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "applianceIds": [1, 2, 3]
}
```

**Response:**
```json
{
  "1": {
    "status": "online",
    "responseTime": 145,
    "lastChecked": "2024-01-01T00:00:00Z"
  },
  "2": {
    "status": "offline",
    "error": "Connection refused",
    "lastChecked": "2024-01-01T00:00:00Z"
  }
}
```

**Examples:**

##### curl
```bash
curl -X POST http://localhost:3001/api/status-check \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"applianceIds":[1,2,3]}'
```

##### Python
```python
import requests

def check_appliance_status(token, appliance_ids):
    response = requests.post(
        'http://localhost:3001/api/status-check',
        headers={'Authorization': f'Bearer {token}'},
        json={'applianceIds': appliance_ids}
    )
    return response.json()

# Check status of multiple appliances
statuses = check_appliance_status(token, [1, 2, 3])
for app_id, status in statuses.items():
    print(f"Appliance {app_id}: {status['status']}")
```

##### JavaScript
```javascript
const checkApplianceStatus = async (token, applianceIds) => {
  const response = await fetch('http://localhost:3001/api/status-check', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ applianceIds })
  });
  
  const statuses = await response.json();
  console.log('Appliance statuses:', statuses);
  return statuses;
};

// Check status of appliances
const statuses = await checkApplianceStatus(token, [1, 2, 3]);
```

## Error Handling

All endpoints return appropriate HTTP status codes:

- `200 OK`: Successful request
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

Error responses include a JSON body:

```json
{
  "error": "Error message",
  "details": "Additional error details (development only)"
}
```

### Error Handling Examples

##### Python
```python
import requests

def safe_api_call(url, method='GET', token=None, **kwargs):
    headers = {}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    
    try:
        response = requests.request(method, url, headers=headers, **kwargs)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 401:
            print("Authentication failed. Please login again.")
        elif e.response.status_code == 429:
            print("Rate limit exceeded. Please wait before retrying.")
        else:
            print(f"API Error: {e.response.json().get('error', 'Unknown error')}")
        return None
    except requests.exceptions.ConnectionError:
        print("Connection error. Please check if the server is running.")
        return None
```

##### JavaScript
```javascript
const apiCall = async (url, options = {}) => {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const error = await response.json();
      
      switch (response.status) {
        case 401:
          console.error('Authentication failed. Please login again.');
          // Redirect to login or refresh token
          break;
        case 429:
          console.error('Rate limit exceeded. Please wait before retrying.');
          break;
        default:
          console.error(`API Error: ${error.error || 'Unknown error'}`);
      }
      
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      console.error('Connection error. Please check if the server is running.');
    }
    throw error;
  }
};
```

## Rate Limiting

The API implements rate limiting on certain endpoints:

- Login endpoint: 20 requests per 15 minutes per IP
- Other endpoints: No rate limiting by default

Rate limit headers are included in responses:
- `RateLimit-Limit`: Maximum requests allowed
- `RateLimit-Remaining`: Requests remaining
- `RateLimit-Reset`: Time when the limit resets

## WebSocket Endpoints

### Server-Sent Events (SSE)

**GET** `/api/sse`

Subscribe to real-time updates.

**Headers:**
- `Authorization: Bearer YOUR_JWT_TOKEN`

**Example:**

##### JavaScript
```javascript
const subscribeToUpdates = (token) => {
  const eventSource = new EventSource(
    `http://localhost:3001/api/sse?token=${token}`
  );
  
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('SSE Update:', data);
  };
  
  eventSource.onerror = (error) => {
    console.error('SSE Error:', error);
    eventSource.close();
  };
  
  return eventSource;
};
```

### Terminal WebSocket

**WebSocket** `/api/terminal/ws`

Connect to terminal sessions via WebSocket.

**Query Parameters:**
- `token`: JWT authentication token
- `applianceId`: Appliance ID for SSH connection

**Example:**

##### JavaScript
```javascript
const connectTerminal = (token, applianceId) => {
  const ws = new WebSocket(
    `ws://localhost:3001/api/terminal/ws?token=${token}&applianceId=${applianceId}`
  );
  
  ws.onopen = () => {
    console.log('Terminal connected');
  };
  
  ws.onmessage = (event) => {
    // Terminal output
    console.log('Terminal:', event.data);
  };
  
  ws.onerror = (error) => {
    console.error('Terminal error:', error);
  };
  
  // Send input to terminal
  const sendCommand = (command) => {
    ws.send(command);
  };
  
  return { ws, sendCommand };
};
```

## Best Practices

1. **Authentication**: Always store JWT tokens securely (never in localStorage for production)
2. **Error Handling**: Implement proper error handling for all API calls
3. **Rate Limiting**: Implement exponential backoff for rate-limited requests
4. **Timeouts**: Set appropriate timeouts for API calls
5. **HTTPS**: Always use HTTPS in production
6. **CORS**: Configure CORS appropriately for your frontend domain

## Complete Example Application

### Python Example

```python
import requests
import time

class WebApplianceAPI:
    def __init__(self, base_url='http://localhost:3001'):
        self.base_url = base_url
        self.token = None
        
    def login(self, username, password):
        """Authenticate and store token"""
        response = requests.post(
            f'{self.base_url}/api/auth/login',
            json={'username': username, 'password': password}
        )
        response.raise_for_status()
        data = response.json()
        self.token = data['token']
        return data['user']
    
    def _auth_headers(self):
        """Get authorization headers"""
        if not self.token:
            raise Exception('Not authenticated. Please login first.')
        return {'Authorization': f'Bearer {self.token}'}
    
    def get_appliances(self):
        """Get all appliances"""
        response = requests.get(
            f'{self.base_url}/api/appliances',
            headers=self._auth_headers()
        )
        response.raise_for_status()
        return response.json()
    
    def create_appliance(self, appliance_data):
        """Create a new appliance"""
        response = requests.post(
            f'{self.base_url}/api/appliances',
            headers=self._auth_headers(),
            json=appliance_data
        )
        response.raise_for_status()
        return response.json()
    
    def check_appliance_status(self, appliance_ids):
        """Check status of multiple appliances"""
        response = requests.post(
            f'{self.base_url}/api/status-check',
            headers=self._auth_headers(),
            json={'applianceIds': appliance_ids}
        )
        response.raise_for_status()
        return response.json()
    
    def monitor_appliances(self, interval=60):
        """Monitor appliance status continuously"""
        while True:
            try:
                appliances = self.get_appliances()
                appliance_ids = [app['id'] for app in appliances]
                statuses = self.check_appliance_status(appliance_ids)
                
                for app in appliances:
                    status_info = statuses.get(str(app['id']), {})
                    print(f"{app['name']}: {status_info.get('status', 'unknown')}")
                
                time.sleep(interval)
            except KeyboardInterrupt:
                print("\nMonitoring stopped")
                break
            except Exception as e:
                print(f"Error: {e}")
                time.sleep(interval)

# Usage example
if __name__ == '__main__':
    api = WebApplianceAPI()
    
    # Login
    user = api.login('admin', 'password123')
    print(f"Logged in as: {user['username']}")
    
    # Get appliances
    appliances = api.get_appliances()
    print(f"Found {len(appliances)} appliances")
    
    # Create new appliance
    new_app = api.create_appliance({
        'name': 'Test Server',
        'url': 'http://test.local:8080',
        'icon': 'Server',
        'category': 'development'
    })
    print(f"Created appliance: {new_app['name']}")
    
    # Monitor appliances
    api.monitor_appliances(interval=30)
```

### JavaScript/Node.js Example

```javascript
class WebApplianceAPI {
  constructor(baseUrl = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
    this.token = null;
  }

  async login(username, password) {
    const response = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    const data = await response.json();
    this.token = data.token;
    return data.user;
  }

  async apiCall(endpoint, options = {}) {
    if (!this.token && !endpoint.includes('/auth/login')) {
      throw new Error('Not authenticated. Please login first.');
    }

    const headers = {
      ...options.headers,
      ...(this.token && { 'Authorization': `Bearer ${this.token}` })
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async getAppliances() {
    return this.apiCall('/api/appliances');
  }

  async createAppliance(applianceData) {
    return this.apiCall('/api/appliances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(applianceData)
    });
  }

  async updateAppliance(id, updates) {
    return this.apiCall(`/api/appliances/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
  }

  async deleteAppliance(id) {
    return this.apiCall(`/api/appliances/${id}`, {
      method: 'DELETE'
    });
  }

  async checkApplianceStatus(applianceIds) {
    return this.apiCall('/api/status-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applianceIds })
    });
  }

  subscribeToUpdates(onUpdate, onError) {
    const eventSource = new EventSource(
      `${this.baseUrl}/api/sse?token=${this.token}`
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onUpdate(data);
    };

    eventSource.onerror = (error) => {
      onError(error);
      eventSource.close();
    };

    return () => eventSource.close();
  }

  async monitorAppliances(interval = 60000) {
    const checkStatus = async () => {
      try {
        const appliances = await this.getAppliances();
        const ids = appliances.map(app => app.id);
        const statuses = await this.checkApplianceStatus(ids);
        
        appliances.forEach(app => {
          const status = statuses[app.id] || { status: 'unknown' };
          console.log(`${app.name}: ${status.status}`);
        });
      } catch (error) {
        console.error('Monitor error:', error);
      }
    };

    // Initial check
    await checkStatus();

    // Set up interval
    const intervalId = setInterval(checkStatus, interval);

    // Return cleanup function
    return () => clearInterval(intervalId);
  }
}

// Usage example
async function main() {
  const api = new WebApplianceAPI();

  try {
    // Login
    const user = await api.login('admin', 'password123');
    console.log(`Logged in as: ${user.username}`);

    // Get appliances
    const appliances = await api.getAppliances();
    console.log(`Found ${appliances.length} appliances`);

    // Create new appliance
    const newApp = await api.createAppliance({
      name: 'Test Server',
      url: 'http://test.local:8080',
      icon: 'Server',
      category: 'development'
    });
    console.log(`Created appliance: ${newApp.name}`);

    // Subscribe to real-time updates
    const unsubscribe = api.subscribeToUpdates(
      (data) => console.log('Update:', data),
      (error) => console.error('SSE Error:', error)
    );

    // Monitor appliances
    const stopMonitoring = await api.monitorAppliances(30000);

    // Cleanup on exit
    process.on('SIGINT', () => {
      console.log('\nCleaning up...');
      unsubscribe();
      stopMonitoring();
      process.exit(0);
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run if this is the main module
if (require.main === module) {
  main();
}

module.exports = WebApplianceAPI;
```

## Testing the API

### Using HTTPie

```bash
# Install HTTPie
pip install httpie

# Login
http POST localhost:3001/api/auth/login username=admin password=password123

# Get appliances (with token)
http GET localhost:3001/api/appliances "Authorization:Bearer YOUR_TOKEN"

# Create appliance
http POST localhost:3001/api/appliances \
  "Authorization:Bearer YOUR_TOKEN" \
  name="Test" url="http://test.local"
```

### Using Postman

1. Import the API collection
2. Set up environment variables:
   - `baseUrl`: http://localhost:3001
   - `token`: (automatically set after login)
3. Run requests in sequence

### Automated Testing Example

```javascript
// api.test.js - Jest example
const WebApplianceAPI = require('./WebApplianceAPI');

describe('Web Appliance API', () => {
  let api;
  let testApplianceId;

  beforeAll(async () => {
    api = new WebApplianceAPI();
    await api.login('admin', 'password123');
  });

  test('should get appliances', async () => {
    const appliances = await api.getAppliances();
    expect(Array.isArray(appliances)).toBe(true);
  });

  test('should create appliance', async () => {
    const newApp = await api.createAppliance({
      name: 'Test Appliance',
      url: 'http://test.local',
      category: 'development'
    });
    
    expect(newApp.name).toBe('Test Appliance');
    testApplianceId = newApp.id;
  });

  test('should update appliance', async () => {
    const updated = await api.updateAppliance(testApplianceId, {
      description: 'Updated description'
    });
    
    expect(updated.description).toBe('Updated description');
  });

  test('should delete appliance', async () => {
    await expect(api.deleteAppliance(testApplianceId))
      .resolves.not.toThrow();
  });
});
```

## Environment Variables

Configure the following environment variables for the API:

```bash
# Database
DB_HOST=localhost
DB_USER=root
DB_PASS=password
DB_NAME=web_appliance_dashboard

# Server
PORT=3001
NODE_ENV=development

# JWT
JWT_SECRET=your-secret-key

# SSH
SSH_KEY_PATH=/path/to/ssh/keys

# Rate Limiting
DISABLE_RATE_LIMIT=false
```

## Security Considerations

1. **JWT Token Security**:
   - Use strong, unique JWT secrets
   - Implement token expiration
   - Store tokens securely (httpOnly cookies in production)

2. **Input Validation**:
   - Validate all input data
   - Sanitize data before database operations
   - Use parameterized queries

3. **HTTPS**:
   - Always use HTTPS in production
   - Implement proper SSL/TLS certificates

4. **CORS**:
   - Configure CORS for specific domains only
   - Avoid using wildcard (*) in production

5. **Rate Limiting**:
   - Implement rate limiting on all endpoints
   - Use distributed rate limiting for multiple servers

6. **Authentication**:
   - Implement password complexity requirements
   - Use bcrypt or similar for password hashing
   - Consider implementing 2FA

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Check if the server is running
   - Verify the correct port (default: 3001)
   - Check firewall settings

2. **401 Unauthorized**
   - Token may have expired
   - Check if token is included in headers
   - Verify token format

3. **429 Too Many Requests**
   - Wait for rate limit to reset
   - Check RateLimit headers for reset time

4. **CORS Errors**
   - Configure CORS in the backend
   - Check allowed origins
   - Verify request headers

### Debug Mode

Enable debug logging:

```bash
DEBUG=* npm start
```

## Additional Resources

- [API Source Code](https://github.com/alflewerken/web-appliance-dashboard/tree/main/backend)
- [OpenAPI/Swagger Spec](https://github.com/alflewerken/web-appliance-dashboard/blob/main/docs/openapi.yaml)
- [Postman Collection](https://github.com/alflewerken/web-appliance-dashboard/blob/main/backend/swagger/postman-collection.json)
- [Issue Tracker](https://github.com/alflewerken/web-appliance-dashboard/issues)
