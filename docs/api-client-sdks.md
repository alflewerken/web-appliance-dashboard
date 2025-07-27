## Web Appliance Dashboard v1.1.0

Dieses Dokument enthält Beispielcode für die Integration der Web Appliance Dashboard API in verschiedenen Programmiersprachen.

## 📋 Inhaltsverzeichnis

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
# oder
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
    
    // Request interceptor für Auth
    this.client.interceptors.request.use(
      config => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        return config;
      },
      error => Promise.reject(error)
    );
    
    // Response interceptor für Error Handling
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

// Verwendung
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
      data => console.log('Event:', data),
      error => console.error('SSE Error:', error)
    );
    
    // Cleanup
    setTimeout(() => {
      unsubscribe();
      client.logout();
    }, 60000);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

module.exports = ApplianceDashboardClient;
```

### TypeScript Version

```typescript
// api-client.ts
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

interface LoginResponse {
  token: string;
  user: {
    id: number;
    username: string;
    role: string;
  };
}

interface Appliance {
  id: number;
  name: string;
  url: string;
  icon?: string;
  category: string;
  ssh_host?: string;
  ssh_username?: string;
  ssh_port?: number;
  remote_desktop_enabled?: boolean;
  remote_protocol?: 'vnc' | 'rdp';
  created_at: string;
  updated_at: string;
}

interface SSHKey {
  id: number;
  name: string;
  type: string;
  public_key: string;
  created_at: string;
}

class ApplianceDashboardClient {
  private client: AxiosInstance;
  private token: string | null = null;
  
  constructor(baseURL: string = 'http://localhost:9080/api') {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    this.setupInterceptors();
  }
  
  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
  }
  
  async login(username: string, password: string): Promise<LoginResponse> {
    const response = await this.client.post<LoginResponse>('/auth/login', {
      username,
      password
    });
    this.token = response.data.token;
    return response.data;
  }
  
  async getAppliances(): Promise<Appliance[]> {
    const response = await this.client.get<Appliance[]>('/appliances');
    return response.data;
  }
  
  async createAppliance(data: Partial<Appliance>): Promise<Appliance> {
    const response = await this.client.post<Appliance>('/appliances', data);
    return response.data;
  }
  
  // ... weitere Methoden
}

export default ApplianceDashboardClient;
```

## Python

### Installation

```bash
pip install requests
# oder mit async support
pip install aiohttp
```

### Synchronous Client

```python
# appliance_dashboard_client.py
import requests
from typing import Dict, List, Optional, Any
from datetime import datetime
import json

class ApplianceDashboardClient:
    def __init__(self, base_url: str = \"http://localhost:9080/api\", token: Optional[str] = None):
        self.base_url = base_url.rstrip('/')
        self.token = token
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        
    def _get_headers(self) -> Dict[str, str]:
        headers = {}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        return headers
    
    def _request(self, method: str, endpoint: str, **kwargs) -> Any:
        \"\"\"Make HTTP request with error handling\"\"\"
        url = f\"{self.base_url}{endpoint}\"
        headers = self._get_headers()
        
        if 'headers' in kwargs:
            headers.update(kwargs['headers'])
            kwargs['headers'] = headers
        else:
            kwargs['headers'] = headers
            
        response = self.session.request(method, url, **kwargs)
        
        if response.status_code == 401:
            self.token = None
            raise Exception(\"Authentication failed\")
            
        response.raise_for_status()
        
        if response.content:
            return response.json()
        return None
    
    # Authentication
    def login(self, username: str, password: str) -> Dict[str, Any]:
        \"\"\"Login and store token\"\"\"
        response = self._request('POST', '/auth/login', json={
            'username': username,
            'password': password
        })
        self.token = response['token']
        return response
    
    def logout(self) -> None:
        \"\"\"Logout and clear token\"\"\"
        self._request('POST', '/auth/logout')
        self.token = None
    
    # Appliances
    def get_appliances(self, **params) -> List[Dict[str, Any]]:
        \"\"\"Get all appliances\"\"\"
        return self._request('GET', '/appliances', params=params)
    
    def get_appliance(self, appliance_id: int) -> Dict[str, Any]:
        \"\"\"Get single appliance\"\"\"
        return self._request('GET', f'/appliances/{appliance_id}')
    
    def create_appliance(self, data: Dict[str, Any]) -> Dict[str, Any]:
        \"\"\"Create new appliance\"\"\"
        return self._request('POST', '/appliances', json=data)
    
    def update_appliance(self, appliance_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        \"\"\"Update appliance\"\"\"
        return self._request('PUT', f'/appliances/{appliance_id}', json=data)
    
    def delete_appliance(self, appliance_id: int) -> None:
        \"\"\"Delete appliance\"\"\"
        self._request('DELETE', f'/appliances/{appliance_id}')
    
    # SSH Management
    def get_ssh_keys(self) -> List[Dict[str, Any]]:
        \"\"\"Get all SSH keys\"\"\"
        return self._request('GET', '/ssh/keys')
    
    def generate_ssh_key(self, name: str, key_type: str = 'rsa', bits: int = 4096) -> Dict[str, Any]:
        \"\"\"Generate new SSH key\"\"\"
        return self._request('POST', '/ssh/keys/generate', json={
            'name': name,
            'type': key_type,
            'bits': bits
        })
    
    def test_ssh_connection(self, host: str, username: str, key_id: int, port: int = 22) -> Dict[str, Any]:
        \"\"\"Test SSH connection\"\"\"
        return self._request('POST', '/ssh/test', json={
            'host': host,
            'username': username,
            'keyId': key_id,
            'port': port
        })
    
    # Remote Desktop
    def get_remote_desktop_token(self, appliance_id: int) -> Dict[str, Any]:
        \"\"\"Get remote desktop access token\"\"\"
        return self._request('POST', f'/guacamole/token/{appliance_id}')
    
    # Service Control
    def control_service(self, appliance_id: int, action: str, service: str) -> Dict[str, Any]:
        \"\"\"Control service (start/stop/restart)\"\"\"
        return self._request('POST', f'/appliances/{appliance_id}/control', json={
            'action': action,
            'service': service
        })
    
    # Backup & Restore
    def create_backup(self) -> Dict[str, Any]:
        \"\"\"Create system backup\"\"\"
        return self._request('POST', '/backup/create')
    
    def download_backup(self, backup_id: Optional[str] = None) -> bytes:
        \"\"\"Download backup file\"\"\"
        endpoint = f'/backup/download/{backup_id}' if backup_id else '/backup/download/latest'
        response = self.session.get(
            f\"{self.base_url}{endpoint}\",
            headers=self._get_headers(),
            stream=True
        )
        response.raise_for_status()
        return response.content
    
    def restore_backup(self, backup_file: str) -> Dict[str, Any]:
        \"\"\"Restore from backup\"\"\"
        with open(backup_file, 'rb') as f:
            files = {'backup': f}
            return self._request('POST', '/restore', files=files)

# Beispiel Verwendung
def main():
    # Client initialisieren
    client = ApplianceDashboardClient()
    
    try:
        # Login
        login_response = client.login('admin', 'admin123')
        print(f\"Logged in as: {login_response['user']['username']}\")
        
        # Appliances abrufen
        appliances = client.get_appliances()
        print(f\"Found {len(appliances)} appliances\")
        
        # Neue Appliance erstellen
        new_appliance = client.create_appliance({
            'name': 'Python Test Server',
            'url': 'https://test.example.com',
            'category': 'development',
            'ssh_host': '192.168.1.50',
            'ssh_username': 'ubuntu',
            'ssh_port': 22,
            'remote_desktop_enabled': True,
            'remote_protocol': 'vnc',
            'remote_host': '192.168.1.50',
            'remote_port': 5900
        })
        print(f\"Created appliance: {new_appliance['name']}\")
        
        # SSH Key generieren
        ssh_key = client.generate_ssh_key('python-test-key')
        print(f\"Generated SSH key: {ssh_key['name']}\")
        
        # Remote Desktop Token abrufen
        rd_token = client.get_remote_desktop_token(new_appliance['id'])
        print(f\"Remote Desktop URL: {rd_token['url']}\")
        
        # Service steuern
        service_result = client.control_service(
            new_appliance['id'], 
            'restart', 
            'nginx'
        )
        print(f\"Service control result: {service_result}\")
        
        # Backup erstellen
        backup = client.create_backup()
        print(f\"Backup created: {backup['filename']}\")
        
    except Exception as e:
        print(f\"Error: {e}\")
    finally:
        # Logout
        client.logout()

if __name__ == \"__main__\":
    main()
```

### Async Client (aiohttp)

```python
# async_appliance_client.py
import aiohttp
import asyncio
from typing import Dict, List, Optional, Any

class AsyncApplianceDashboardClient:
    def __init__(self, base_url: str = \"http://localhost:9080/api\"):
        self.base_url = base_url.rstrip('/')
        self.token: Optional[str] = None
        self.session: Optional[aiohttp.ClientSession] = None
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
            
    def _get_headers(self) -> Dict[str, str]:
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        return headers
        
    async def _request(self, method: str, endpoint: str, **kwargs) -> Any:
        \"\"\"Make async HTTP request\"\"\"
        url = f\"{self.base_url}{endpoint}\"
        headers = self._get_headers()
        
        if 'headers' in kwargs:
            headers.update(kwargs['headers'])
        kwargs['headers'] = headers
        
        async with self.session.request(method, url, **kwargs) as response:
            if response.status == 401:
                self.token = None
                raise Exception(\"Authentication failed\")
                
            response.raise_for_status()
            
            if response.content_type == 'application/json':
                return await response.json()
            return await response.read()
    
    async def login(self, username: str, password: str) -> Dict[str, Any]:
        \"\"\"Async login\"\"\"
        response = await self._request('POST', '/auth/login', json={
            'username': username,
            'password': password
        })
        self.token = response['token']
        return response
    
    async def get_appliances(self) -> List[Dict[str, Any]]:
        \"\"\"Get all appliances asynchronously\"\"\"
        return await self._request('GET', '/appliances')
    
    # SSE Support
    async def subscribe_to_events(self):
        \"\"\"Subscribe to server-sent events\"\"\"
        url = f\"{self.base_url}/sse\"
        headers = self._get_headers()
        
        async with self.session.get(url, headers=headers) as response:
            async for line in response.content:
                if line.startswith(b'data: '):
                    data = line[6:].decode('utf-8').strip()
                    if data:
                        yield json.loads(data)

# Async Beispiel
async def async_example():
    async with AsyncApplianceDashboardClient() as client:
        # Login
        await client.login('admin', 'admin123')
        
        # Parallel requests
        appliances, ssh_keys = await asyncio.gather(
            client.get_appliances(),
            client.get_ssh_keys()
        )
        
        print(f\"Found {len(appliances)} appliances and {len(ssh_keys)} SSH keys\")
        
        # Subscribe to events
        async for event in client.subscribe_to_events():
            print(f\"Event: {event}\")
            if event.get('type') == 'shutdown':
                break

if __name__ == \"__main__\":
    asyncio.run(async_example())
```

## Go

### Installation

```bash
go get github.com/go-resty/resty/v2
```

### Go Client

```go
// client.go
package appliancedashboard

import (
    \"encoding/json\"
    \"fmt\"
    \"time\"
    
    \"github.com/go-resty/resty/v2\"
)

// Client represents the API client
type Client struct {
    baseURL string
    token   string
    client  *resty.Client
}

// LoginResponse represents the login response
type LoginResponse struct {
    Token string `json:\"token\"`
    User  struct {
        ID       int    `json:\"id\"`
        Username string `json:\"username\"`
        Role     string `json:\"role\"`
    } `json:\"user\"`
}

// Appliance represents an appliance
type Appliance struct {
    ID                   int       `json:\"id\"`
    Name                 string    `json:\"name\"`
    URL                  string    `json:\"url\"`
    Icon                 string    `json:\"icon,omitempty\"`
    Category             string    `json:\"category\"`
    SSHHost              string    `json:\"ssh_host,omitempty\"`
    SSHUsername          string    `json:\"ssh_username,omitempty\"`
    SSHPort              int       `json:\"ssh_port,omitempty\"`
    RemoteDesktopEnabled bool      `json:\"remote_desktop_enabled\"`
    RemoteProtocol       string    `json:\"remote_protocol,omitempty\"`
    RemoteHost           string    `json:\"remote_host,omitempty\"`
    RemotePort           int       `json:\"remote_port,omitempty\"`
    CreatedAt            time.Time `json:\"created_at\"`
    UpdatedAt            time.Time `json:\"updated_at\"`
}

// NewClient creates a new API client
func NewClient(baseURL string) *Client {
    return &Client{
        baseURL: baseURL,
        client:  resty.New().SetTimeout(30 * time.Second),
    }
}

// Login authenticates the user
func (c *Client) Login(username, password string) (*LoginResponse, error) {
    var result LoginResponse
    
    resp, err := c.client.R().
        SetBody(map[string]string{
            \"username\": username,
            \"password\": password,
        }).
        SetResult(&result).
        Post(c.baseURL + \"/auth/login\")
    
    if err != nil {
        return nil, err
    }
    
    if resp.IsError() {
        return nil, fmt.Errorf(\"login failed: %s\", resp.Status())
    }
    
    c.token = result.Token
    c.client.SetAuthToken(c.token)
    
    return &result, nil
}

// GetAppliances retrieves all appliances
func (c *Client) GetAppliances() ([]Appliance, error) {
    var appliances []Appliance
    
    resp, err := c.client.R().
        SetResult(&appliances).
        Get(c.baseURL + \"/appliances\")
    
    if err != nil {
        return nil, err
    }
    
    if resp.IsError() {
        return nil, fmt.Errorf(\"failed to get appliances: %s\", resp.Status())
    }
    
    return appliances, nil
}

// CreateAppliance creates a new appliance
func (c *Client) CreateAppliance(appliance *Appliance) (*Appliance, error) {
    var result Appliance
    
    resp, err := c.client.R().
        SetBody(appliance).
        SetResult(&result).
        Post(c.baseURL + \"/appliances\")
    
    if err != nil {
        return nil, err
    }
    
    if resp.IsError() {
        return nil, fmt.Errorf(\"failed to create appliance: %s\", resp.Status())
    }
    
    return &result, nil
}

// GetRemoteDesktopToken gets a remote desktop access token
func (c *Client) GetRemoteDesktopToken(applianceID int) (map[string]interface{}, error) {
    var result map[string]interface{}
    
    resp, err := c.client.R().
        SetResult(&result).
        Post(fmt.Sprintf(\"%s/guacamole/token/%d\", c.baseURL, applianceID))
    
    if err != nil {
        return nil, err
    }
    
    if resp.IsError() {
        return nil, fmt.Errorf(\"failed to get remote desktop token: %s\", resp.Status())
    }
    
    return result, nil
}

// Example usage
func Example() {
    // Create client
    client := NewClient(\"http://localhost:9080/api\")
    
    // Login
    loginResp, err := client.Login(\"admin\", \"admin123\")
    if err != nil {
        panic(err)
    }
    fmt.Printf(\"Logged in as: %s\
\", loginResp.User.Username)
    
    // Get appliances
    appliances, err := client.GetAppliances()
    if err != nil {
        panic(err)
    }
    fmt.Printf(\"Found %d appliances\
\", len(appliances))
    
    // Create new appliance
    newAppliance := &Appliance{
        Name:                 \"Go Test Server\",
        URL:                  \"https://go-test.example.com\",
        Category:             \"development\",
        SSHHost:              \"192.168.1.60\",
        SSHUsername:          \"golang\",
        SSHPort:              22,
        RemoteDesktopEnabled: true,
        RemoteProtocol:       \"vnc\",
        RemoteHost:           \"192.168.1.60\",
        RemotePort:           5900,
    }
    
    created, err := client.CreateAppliance(newAppliance)
    if err != nil {
        panic(err)
    }
    fmt.Printf(\"Created appliance: %s (ID: %d)\
\", created.Name, created.ID)
    
    // Get remote desktop token
    rdToken, err := client.GetRemoteDesktopToken(created.ID)
    if err != nil {
        panic(err)
    }
    fmt.Printf(\"Remote Desktop URL: %s\
\", rdToken[\"url\"])
}
```

## PHP

### Installation

```bash
composer require guzzlehttp/guzzle
```

### PHP Client

```php
<?php
// ApplianceDashboardClient.php

namespace ApplianceDashboard;

use GuzzleHttp\\Client as HttpClient;
use GuzzleHttp\\Exception\\GuzzleException;

class ApplianceDashboardClient
{
    private string $baseUrl;
    private ?string $token = null;
    private HttpClient $client;
    
    public function __construct(string $baseUrl = 'http://localhost:9080/api')
    {
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->client = new HttpClient([
            'base_uri' => $this->baseUrl,
            'timeout' => 30.0,
            'headers' => [
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
            ]
        ]);
    }
    
    /**
     * Make HTTP request
     */
    private function request(string $method, string $endpoint, array $options = []): array
    {
        if ($this->token) {
            $options['headers']['Authorization'] = 'Bearer ' . $this->token;
        }
        
        try {
            $response = $this->client->request($method, $endpoint, $options);
            $body = $response->getBody()->getContents();
            
            return json_decode($body, true) ?: [];
        } catch (GuzzleException $e) {
            if ($e->getCode() === 401) {
                $this->token = null;
                throw new \\Exception('Authentication failed');
            }
            throw $e;
        }
    }
    
    /**
     * Login
     */
    public function login(string $username, string $password): array
    {
        $response = $this->request('POST', '/auth/login', [
            'json' => [
                'username' => $username,
                'password' => $password
            ]
        ]);
        
        $this->token = $response['token'];
        return $response;
    }
    
    /**
     * Logout
     */
    public function logout(): void
    {
        $this->request('POST', '/auth/logout');
        $this->token = null;
    }
    
    /**
     * Get all appliances
     */
    public function getAppliances(array $params = []): array
    {
        return $this->request('GET', '/appliances', [
            'query' => $params
        ]);
    }
    
    /**
     * Create appliance
     */
    public function createAppliance(array $data): array
    {
        return $this->request('POST', '/appliances', [
            'json' => $data
        ]);
    }
    
    /**
     * Update appliance
     */
    public function updateAppliance(int $id, array $data): array
    {
        return $this->request('PUT', \"/appliances/{$id}\", [
            'json' => $data
        ]);
    }
    
    /**
     * Delete appliance
     */
    public function deleteAppliance(int $id): void
    {
        $this->request('DELETE', \"/appliances/{$id}\");
    }
    
    /**
     * Get SSH keys
     */
    public function getSSHKeys(): array
    {
        return $this->request('GET', '/ssh/keys');
    }
    
    /**
     * Generate SSH key
     */
    public function generateSSHKey(string $name, string $type = 'rsa', int $bits = 4096): array
    {
        return $this->request('POST', '/ssh/keys/generate', [
            'json' => [
                'name' => $name,
                'type' => $type,
                'bits' => $bits
            ]
        ]);
    }
    
    /**
     * Get remote desktop token
     */
    public function getRemoteDesktopToken(int $applianceId): array
    {
        return $this->request('POST', \"/guacamole/token/{$applianceId}\");
    }
    
    /**
     * Control service
     */
    public function controlService(int $applianceId, string $action, string $service): array
    {
        return $this->request('POST', \"/appliances/{$applianceId}/control\", [
            'json' => [
                'action' => $action,
                'service' => $service
            ]
        ]);
    }
}

// Example usage
try {
    $client = new ApplianceDashboardClient();
    
    // Login
    $loginResponse = $client->login('admin', 'admin123');
    echo \"Logged in as: {$loginResponse['user']['username']}\
\";
    
    // Get appliances
    $appliances = $client->getAppliances();
    echo \"Found \" . count($appliances) . \" appliances\
\";
    
    // Create new appliance
    $newAppliance = $client->createAppliance([
        'name' => 'PHP Test Server',
        'url' => 'https://php-test.example.com',
        'category' => 'development',
        'ssh_host' => '192.168.1.70',
        'ssh_username' => 'php-user',
        'ssh_port' => 22
    ]);
    echo \"Created appliance: {$newAppliance['name']}\
\";
    
    // Generate SSH key
    $sshKey = $client->generateSSHKey('php-test-key');
    echo \"Generated SSH key: {$sshKey['name']}\
\";
    
    // Get remote desktop token
    $rdToken = $client->getRemoteDesktopToken($newAppliance['id']);
    echo \"Remote Desktop URL: {$rdToken['url']}\
\";
    
    // Logout
    $client->logout();
    
} catch (\\Exception $e) {
    echo \"Error: {$e->getMessage()}\
\";
}
```

## Java

### Maven Dependency

```xml
<dependency>
    <groupId>com.squareup.okhttp3</groupId>
    <artifactId>okhttp</artifactId>
    <version>4.11.0</version>
</dependency>
<dependency>
    <groupId>com.google.code.gson</groupId>
    <artifactId>gson</artifactId>
    <version>2.10.1</version>
</dependency>
```

### Java Client

```java
// ApplianceDashboardClient.java
package com.example.appliancedashboard;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import okhttp3.*;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

public class ApplianceDashboardClient {
    private final String baseUrl;
    private final OkHttpClient httpClient;
    private final Gson gson;
    private String token;
    
    private static final MediaType JSON = MediaType.get(\"application/json; charset=utf-8\");
    
    public ApplianceDashboardClient(String baseUrl) {
        this.baseUrl = baseUrl.replaceAll(\"/$\", \"\");
        this.httpClient = new OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build();
        this.gson = new GsonBuilder()
            .setDateFormat(\"yyyy-MM-dd'T'HH:mm:ss.SSS'Z'\")
            .create();
    }
    
    // Data classes
    public static class LoginRequest {
        public String username;
        public String password;
        
        public LoginRequest(String username, String password) {
            this.username = username;
            this.password = password;
        }
    }
    
    public static class LoginResponse {
        public String token;
        public User user;
        
        public static class User {
            public int id;
            public String username;
            public String role;
        }
    }
    
    public static class Appliance {
        public Integer id;
        public String name;
        public String url;
        public String icon;
        public String category;
        public String ssh_host;
        public String ssh_username;
        public Integer ssh_port;
        public Boolean remote_desktop_enabled;
        public String remote_protocol;
        public String remote_host;
        public Integer remote_port;
        public String created_at;
        public String updated_at;
    }
    
    // Helper methods
    private Request.Builder createRequestBuilder(String endpoint) {
        Request.Builder builder = new Request.Builder()
            .url(baseUrl + endpoint);
            
        if (token != null) {
            builder.addHeader(\"Authorization\", \"Bearer \" + token);
        }
        
        return builder;
    }
    
    private <T> T executeRequest(Request request, Class<T> responseClass) throws IOException {
        try (Response response = httpClient.newCall(request).execute()) {
            if (response.code() == 401) {
                token = null;
                throw new IOException(\"Authentication failed\");
            }
            
            if (!response.isSuccessful()) {
                throw new IOException(\"Request failed: \" + response);
            }
            
            String responseBody = response.body().string();
            return gson.fromJson(responseBody, responseClass);
        }
    }
    
    // API methods
    public LoginResponse login(String username, String password) throws IOException {
        LoginRequest loginRequest = new LoginRequest(username, password);
        String json = gson.toJson(loginRequest);
        
        Request request = createRequestBuilder(\"/auth/login\")
            .post(RequestBody.create(json, JSON))
            .build();
            
        LoginResponse response = executeRequest(request, LoginResponse.class);
        this.token = response.token;
        return response;
    }
    
    public void logout() throws IOException {
        Request request = createRequestBuilder(\"/auth/logout\")
            .post(RequestBody.create(\"\", JSON))
            .build();
            
        executeRequest(request, Void.class);
        this.token = null;
    }
    
    public List<Appliance> getAppliances() throws IOException {
        Request request = createRequestBuilder(\"/appliances\")
            .get()
            .build();
            
        return executeRequest(request, List.class);
    }
    
    public Appliance createAppliance(Appliance appliance) throws IOException {
        String json = gson.toJson(appliance);
        
        Request request = createRequestBuilder(\"/appliances\")
            .post(RequestBody.create(json, JSON))
            .build();
            
        return executeRequest(request, Appliance.class);
    }
    
    public Map<String, Object> getRemoteDesktopToken(int applianceId) throws IOException {
        Request request = createRequestBuilder(\"/guacamole/token/\" + applianceId)
            .post(RequestBody.create(\"\", JSON))
            .build();
            
        return executeRequest(request, Map.class);
    }
    
    // Example usage
    public static void main(String[] args) {
        ApplianceDashboardClient client = new ApplianceDashboardClient(\"http://localhost:9080/api\");
        
        try {
            // Login
            LoginResponse loginResponse = client.login(\"admin\", \"admin123\");
            System.out.println(\"Logged in as: \" + loginResponse.user.username);
            
            // Get appliances
            List<Appliance> appliances = client.getAppliances();
            System.out.println(\"Found \" + appliances.size() + \" appliances\");
            
            // Create new appliance
            Appliance newAppliance = new Appliance();
            newAppliance.name = \"Java Test Server\";
            newAppliance.url = \"https://java-test.example.com\";
            newAppliance.category = \"development\";
            newAppliance.ssh_host = \"192.168.1.80\";
            newAppliance.ssh_username = \"java-user\";
            newAppliance.ssh_port = 22;
            
            Appliance created = client.createAppliance(newAppliance);
            System.out.println(\"Created appliance: \" + created.name);
            
            // Get remote desktop token
            Map<String, Object> rdToken = client.getRemoteDesktopToken(created.id);
            System.out.println(\"Remote Desktop URL: \" + rdToken.get(\"url\"));
            
            // Logout
            client.logout();
            
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
```

## C#/.NET

### NuGet Package

```bash
dotnet add package RestSharp
dotnet add package Newtonsoft.Json
```

### C# Client

```csharp
// ApplianceDashboardClient.cs
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using RestSharp;
using Newtonsoft.Json;

namespace ApplianceDashboard
{
    public class ApplianceDashboardClient
    {
        private readonly string baseUrl;
        private readonly RestClient client;
        private string token;

        public ApplianceDashboardClient(string baseUrl = \"http://localhost:9080/api\")
        {
            this.baseUrl = baseUrl.TrimEnd('/');
            this.client = new RestClient(this.baseUrl);
        }

        // Data Models
        public class LoginRequest
        {
            public string Username { get; set; }
            public string Password { get; set; }
        }

        public class LoginResponse
        {
            public string Token { get; set; }
            public User User { get; set; }
        }

        public class User
        {
            public int Id { get; set; }
            public string Username { get; set; }
            public string Role { get; set; }
        }

        public class Appliance
        {
            public int? Id { get; set; }
            public string Name { get; set; }
            public string Url { get; set; }
            public string Icon { get; set; }
            public string Category { get; set; }
            [JsonProperty(\"ssh_host\")]
            public string SshHost { get; set; }
            [JsonProperty(\"ssh_username\")]
            public string SshUsername { get; set; }
            [JsonProperty(\"ssh_port\")]
            public int? SshPort { get; set; }
            [JsonProperty(\"remote_desktop_enabled\")]
            public bool RemoteDesktopEnabled { get; set; }
            [JsonProperty(\"remote_protocol\")]
            public string RemoteProtocol { get; set; }
            [JsonProperty(\"remote_host\")]
            public string RemoteHost { get; set; }
            [JsonProperty(\"remote_port\")]
            public int? RemotePort { get; set; }
            [JsonProperty(\"created_at\")]
            public DateTime CreatedAt { get; set; }
            [JsonProperty(\"updated_at\")]
            public DateTime UpdatedAt { get; set; }
        }

        // Helper method for requests
        private RestRequest CreateRequest(string endpoint, Method method = Method.Get)
        {
            var request = new RestRequest(endpoint, method);
            request.AddHeader(\"Content-Type\", \"application/json\");
            request.AddHeader(\"Accept\", \"application/json\");

            if (!string.IsNullOrEmpty(token))
            {
                request.AddHeader(\"Authorization\", $\"Bearer {token}\");
            }

            return request;
        }

        // API Methods
        public async Task<LoginResponse> LoginAsync(string username, string password)
        {
            var request = CreateRequest(\"/auth/login\", Method.Post);
            request.AddJsonBody(new LoginRequest 
            { 
                Username = username, 
                Password = password 
            });

            var response = await client.ExecuteAsync<LoginResponse>(request);
            
            if (!response.IsSuccessful)
            {
                throw new Exception($\"Login failed: {response.ErrorMessage}\");
            }

            token = response.Data.Token;
            return response.Data;
        }

        public async Task LogoutAsync()
        {
            var request = CreateRequest(\"/auth/logout\", Method.Post);
            await client.ExecuteAsync(request);
            token = null;
        }

        public async Task<List<Appliance>> GetAppliancesAsync()
        {
            var request = CreateRequest(\"/appliances\");
            var response = await client.ExecuteAsync<List<Appliance>>(request);

            if (!response.IsSuccessful)
            {
                throw new Exception($\"Failed to get appliances: {response.ErrorMessage}\");
            }

            return response.Data;
        }

        public async Task<Appliance> CreateApplianceAsync(Appliance appliance)
        {
            var request = CreateRequest(\"/appliances\", Method.Post);
            request.AddJsonBody(appliance);

            var response = await client.ExecuteAsync<Appliance>(request);

            if (!response.IsSuccessful)
            {
                throw new Exception($\"Failed to create appliance: {response.ErrorMessage}\");
            }

            return response.Data;
        }

        public async Task<Dictionary<string, object>> GetRemoteDesktopTokenAsync(int applianceId)
        {
            var request = CreateRequest($\"/guacamole/token/{applianceId}\", Method.Post);
            var response = await client.ExecuteAsync<Dictionary<string, object>>(request);

            if (!response.IsSuccessful)
            {
                throw new Exception($\"Failed to get remote desktop token: {response.ErrorMessage}\");
            }

            return response.Data;
        }

        // Example usage
        public static async Task Main(string[] args)
        {
            var client = new ApplianceDashboardClient();

            try
            {
                // Login
                var loginResponse = await client.LoginAsync(\"admin\", \"admin123\");
                Console.WriteLine($\"Logged in as: {loginResponse.User.Username}\");

                // Get appliances
                var appliances = await client.GetAppliancesAsync();
                Console.WriteLine($\"Found {appliances.Count} appliances\");

                // Create new appliance
                var newAppliance = new Appliance
                {
                    Name = \"C# Test Server\",
                    Url = \"https://csharp-test.example.com\",
                    Category = \"development\",
                    SshHost = \"192.168.1.90\",
                    SshUsername = \"dotnet-user\",
                    SshPort = 22,
                    RemoteDesktopEnabled = true,
                    RemoteProtocol = \"rdp\",
                    RemoteHost = \"192.168.1.90\",
                    RemotePort = 3389
                };

                var created = await client.CreateApplianceAsync(newAppliance);
                Console.WriteLine($\"Created appliance: {created.Name}\");

                // Get remote desktop token
                var rdToken = await client.GetRemoteDesktopTokenAsync(created.Id.Value);
                Console.WriteLine($\"Remote Desktop URL: {rdToken[\"url\"]}\");

                // Logout
                await client.LogoutAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($\"Error: {ex.Message}\");
            }
        }
    }
}
```

## Ruby

### Gemfile

```ruby
source 'https://rubygems.org'
gem 'httparty'
gem 'json'
```

### Ruby Client

```ruby
# appliance_dashboard_client.rb
require 'httparty'
require 'json'

class ApplianceDashboardClient
  include HTTParty
  
  def initialize(base_url = 'http://localhost:9080/api')
    @base_url = base_url.chomp('/')
    @token = nil
    self.class.base_uri @base_url
  end
  
  private
  
  def headers
    headers = {
      'Content-Type' => 'application/json',
      'Accept' => 'application/json'
    }
    headers['Authorization'] = \"Bearer #{@token}\" if @token
    headers
  end
  
  def handle_response(response)
    if response.code == 401
      @token = nil
      raise 'Authentication failed'
    end
    
    unless response.success?
      raise \"Request failed: #{response.code} - #{response.message}\"
    end
    
    response.parsed_response
  end
  
  public
  
  # Authentication
  def login(username, password)
    response = self.class.post(
      '/auth/login',
      headers: headers,
      body: { username: username, password: password }.to_json
    )
    
    result = handle_response(response)
    @token = result['token']
    result
  end
  
  def logout
    self.class.post('/auth/logout', headers: headers)
    @token = nil
  end
  
  # Appliances
  def get_appliances(params = {})
    response = self.class.get(
      '/appliances',
      headers: headers,
      query: params
    )
    handle_response(response)
  end
  
  def create_appliance(data)
    response = self.class.post(
      '/appliances',
      headers: headers,
      body: data.to_json
    )
    handle_response(response)
  end
  
  def update_appliance(id, data)
    response = self.class.put(
      \"/appliances/#{id}\",
      headers: headers,
      body: data.to_json
    )
    handle_response(response)
  end
  
  def delete_appliance(id)
    response = self.class.delete(
      \"/appliances/#{id}\",
      headers: headers
    )
    handle_response(response)
  end
  
  # SSH Management
  def get_ssh_keys
    response = self.class.get('/ssh/keys', headers: headers)
    handle_response(response)
  end
  
  def generate_ssh_key(name, type = 'rsa', bits = 4096)
    response = self.class.post(
      '/ssh/keys/generate',
      headers: headers,
      body: { name: name, type: type, bits: bits }.to_json
    )
    handle_response(response)
  end
  
  # Remote Desktop
  def get_remote_desktop_token(appliance_id)
    response = self.class.post(
      \"/guacamole/token/#{appliance_id}\",
      headers: headers
    )
    handle_response(response)
  end
  
  # Service Control
  def control_service(appliance_id, action, service)
    response = self.class.post(
      \"/appliances/#{appliance_id}/control\",
      headers: headers,
      body: { action: action, service: service }.to_json
    )
    handle_response(response)
  end
end

# Example usage
if __FILE__ == $0
  client = ApplianceDashboardClient.new
  
  begin
    # Login
    login_response = client.login('admin', 'admin123')
    puts \"Logged in as: #{login_response['user']['username']}\"
    
    # Get appliances
    appliances = client.get_appliances
    puts \"Found #{appliances.length} appliances\"
    
    # Create new appliance
    new_appliance = client.create_appliance({
      name: 'Ruby Test Server',
      url: 'https://ruby-test.example.com',
      category: 'development',
      ssh_host: '192.168.1.100',
      ssh_username: 'ruby-user',
      ssh_port: 22
    })
    puts \"Created appliance: #{new_appliance['name']}\"
    
    # Generate SSH key
    ssh_key = client.generate_ssh_key('ruby-test-key')
    puts \"Generated SSH key: #{ssh_key['name']}\"
    
    # Get remote desktop token
    rd_token = client.get_remote_desktop_token(new_appliance['id'])
    puts \"Remote Desktop URL: #{rd_token['url']}\"
    
    # Control service
    service_result = client.control_service(
      new_appliance['id'], 
      'restart', 
      'nginx'
    )
    puts \"Service control result: #{service_result}\"
    
    # Logout
    client.logout
    puts \"Logged out successfully\"
    
  rescue => e
    puts \"Error: #{e.message}\"
  end
end
```

## cURL/Bash

### Bash Script Client

```bash
#!/bin/bash
# appliance-dashboard-client.sh

# Configuration
BASE_URL=\"${API_BASE_URL:-http://localhost:9080/api}\"
TOKEN_FILE=\"/tmp/.appliance-dashboard-token\"

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
NC='\\033[0m' # No Color

# Helper functions
log_info() {
    echo -e \"${GREEN}[INFO]${NC} $1\"
}

log_error() {
    echo -e \"${RED}[ERROR]${NC} $1\" >&2
}

log_warning() {
    echo -e \"${YELLOW}[WARN]${NC} $1\"
}

# Load token if exists
load_token() {
    if [ -f \"$TOKEN_FILE\" ]; then
        TOKEN=$(cat \"$TOKEN_FILE\")
    fi
}

# Save token
save_token() {
    echo \"$1\" > \"$TOKEN_FILE\"
    chmod 600 \"$TOKEN_FILE\"
}

# Clear token
clear_token() {
    rm -f \"$TOKEN_FILE\"
}

# Make authenticated request
api_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    load_token
    
    local auth_header=\"\"
    if [ ! -z \"$TOKEN\" ]; then
        auth_header=\"Authorization: Bearer $TOKEN\"
    fi
    
    local response
    if [ -z \"$data\" ]; then
        response=$(curl -s -X \"$method\" \\
            -H \"Content-Type: application/json\" \\
            -H \"Accept: application/json\" \\
            -H \"$auth_header\" \\
            -w \"\
%{http_code}\" \\
            \"$BASE_URL$endpoint\")
    else
        response=$(curl -s -X \"$method\" \\
            -H \"Content-Type: application/json\" \\
            -H \"Accept: application/json\" \\
            -H \"$auth_header\" \\
            -d \"$data\" \\
            -w \"\
%{http_code}\" \\
            \"$BASE_URL$endpoint\")
    fi
    
    local body=$(echo \"$response\" | sed '$d')
    local status_code=$(echo \"$response\" | tail -n1)
    
    if [ \"$status_code\" -eq 401 ]; then
        clear_token
        log_error \"Authentication failed\"
        return 1
    elif [ \"$status_code\" -ge 400 ]; then
        log_error \"Request failed with status $status_code\"
        echo \"$body\" | jq . 2>/dev/null || echo \"$body\"
        return 1
    fi
    
    echo \"$body\"
}

# API Functions
login() {
    local username=$1
    local password=$2
    
    log_info \"Logging in as $username...\"
    
    local response=$(api_request POST \"/auth/login\" \"{\\\"username\\\":\\\"$username\\\",\\\"password\\\":\\\"$password\\\"}\")
    
    if [ $? -eq 0 ]; then
        local token=$(echo \"$response\" | jq -r '.token')
        save_token \"$token\"
        log_info \"Login successful\"
        echo \"$response\" | jq '.user'
    else
        return 1
    fi
}

logout() {
    log_info \"Logging out...\"
    api_request POST \"/auth/logout\"
    clear_token
    log_info \"Logged out\"
}

get_appliances() {
    log_info \"Getting appliances...\"
    api_request GET \"/appliances\" | jq '.'
}

create_appliance() {
    local name=$1
    local url=$2
    local category=$3
    
    log_info \"Creating appliance: $name\"
    
    local data=$(jq -n \\
        --arg name \"$name\" \\
        --arg url \"$url\" \\
        --arg category \"$category\" \\
        '{name: $name, url: $url, category: $category}')
    
    api_request POST \"/appliances\" \"$data\" | jq '.'
}

get_ssh_keys() {
    log_info \"Getting SSH keys...\"
    api_request GET \"/ssh/keys\" | jq '.'
}

generate_ssh_key() {
    local name=$1
    local type=${2:-rsa}
    local bits=${3:-4096}
    
    log_info \"Generating SSH key: $name\"
    
    local data=$(jq -n \\
        --arg name \"$name\" \\
        --arg type \"$type\" \\
        --argjson bits \"$bits\" \\
        '{name: $name, type: $type, bits: $bits}')
    
    api_request POST \"/ssh/keys/generate\" \"$data\" | jq '.'
}

get_remote_desktop_token() {
    local appliance_id=$1
    
    log_info \"Getting remote desktop token for appliance $appliance_id...\"
    api_request POST \"/guacamole/token/$appliance_id\" | jq '.'
}

# Main menu
show_menu() {
    echo \"\"
    echo \"Web Appliance Dashboard CLI\"
    echo \"==========================\"
    echo \"1. Login\"
    echo \"2. List Appliances\"
    echo \"3. Create Appliance\"
    echo \"4. List SSH Keys\"
    echo \"5. Generate SSH Key\"
    echo \"6. Get Remote Desktop Token\"
    echo \"7. Logout\"
    echo \"8. Exit\"
    echo \"\"
    echo -n \"Select option: \"
}

# Interactive mode
interactive() {
    while true; do
        show_menu
        read -r option
        
        case $option in
            1)
                echo -n \"Username: \"
                read -r username
                echo -n \"Password: \"
                read -rs password
                echo
                login \"$username\" \"$password\"
                ;;
            2)
                get_appliances
                ;;
            3)
                echo -n \"Name: \"
                read -r name
                echo -n \"URL: \"
                read -r url
                echo -n \"Category: \"
                read -r category
                create_appliance \"$name\" \"$url\" \"$category\"
                ;;
            4)
                get_ssh_keys
                ;;
            5)
                echo -n \"Key name: \"
                read -r name
                generate_ssh_key \"$name\"
                ;;
            6)
                echo -n \"Appliance ID: \"
                read -r id
                get_remote_desktop_token \"$id\"
                ;;
            7)
                logout
                ;;
            8)
                log_info \"Goodbye!\"
                exit 0
                ;;
            *)
                log_error \"Invalid option\"
                ;;
        esac
        
        echo
        echo \"Press Enter to continue...\"
        read -r
    done
}

# Command line mode
if [ $# -eq 0 ]; then
    interactive
else
    case $1 in
        login)
            login \"$2\" \"$3\"
            ;;
        logout)
            logout
            ;;
        appliances)
            get_appliances
            ;;
        create-appliance)
            create_appliance \"$2\" \"$3\" \"$4\"
            ;;
        ssh-keys)
            get_ssh_keys
            ;;
        generate-ssh-key)
            generate_ssh_key \"$2\" \"$3\" \"$4\"
            ;;
        remote-desktop)
            get_remote_desktop_token \"$2\"
            ;;
        *)
            echo \"Usage: $0 [command] [args...]\"
            echo \"Commands:\"
            echo \"  login <username> <password>\"
            echo \"  logout\"
            echo \"  appliances\"
            echo \"  create-appliance <name> <url> <category>\"
            echo \"  ssh-keys\"
            echo \"  generate-ssh-key <name> [type] [bits]\"
            echo \"  remote-desktop <appliance-id>\"
            echo \"\"
            echo \"Run without arguments for interactive mode\"
            exit 1
            ;;
    esac
fi
```

### One-liner Examples

```bash
# Login and save token
TOKEN=$(curl -s -X POST http://localhost:9080/api/auth/login \\
  -H \"Content-Type: application/json\" \\
  -d '{\"username\":\"admin\",\"password\":\"admin123\"}' | jq -r '.token')

# Get all appliances
curl -s -X GET http://localhost:9080/api/appliances \\
  -H \"Authorization: Bearer $TOKEN\" | jq '.'

# Create appliance
curl -s -X POST http://localhost:9080/api/appliances \\
  -H \"Authorization: Bearer $TOKEN\" \\
  -H \"Content-Type: application/json\" \\
  -d '{
    \"name\": \"Test Server\",
    \"url\": \"https://test.example.com\",
    \"category\": \"development\"
  }' | jq '.'

# Get remote desktop token
APPLIANCE_ID=1
curl -s -X POST http://localhost:9080/api/guacamole/token/$APPLIANCE_ID \\
  -H \"Authorization: Bearer $TOKEN\" | jq -r '.url'
```

## PowerShell

### PowerShell Client

```powershell
# ApplianceDashboardClient.ps1

class ApplianceDashboardClient {
    [string]$BaseUrl
    [string]$Token
    
    ApplianceDashboardClient([string]$baseUrl = \"http://localhost:9080/api\") {
        $this.BaseUrl = $baseUrl.TrimEnd('/')
        $this.Token = $null
    }
    
    [hashtable] GetHeaders() {
        $headers = @{
            \"Content-Type\" = \"application/json\"
            \"Accept\" = \"application/json\"
        }
        
        if ($this.Token) {
            $headers[\"Authorization\"] = \"Bearer $($this.Token)\"
        }
        
        return $headers
    }
    
    [object] Request([string]$method, [string]$endpoint, [object]$body = $null) {
        $uri = \"$($this.BaseUrl)$endpoint\"
        $headers = $this.GetHeaders()
        
        try {
            if ($body) {
                $jsonBody = $body | ConvertTo-Json -Depth 10
                $response = Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -Body $jsonBody
            } else {
                $response = Invoke-RestMethod -Uri $uri -Method $method -Headers $headers
            }
            
            return $response
        }
        catch {
            if ($_.Exception.Response.StatusCode -eq 401) {
                $this.Token = $null
                throw \"Authentication failed\"
            }
            throw $_
        }
    }
    
    # API Methods
    [object] Login([string]$username, [string]$password) {
        $body = @{
            username = $username
            password = $password
        }
        
        $response = $this.Request(\"POST\", \"/auth/login\", $body)
        $this.Token = $response.token
        
        Write-Host \"Logged in as: $($response.user.username)\" -ForegroundColor Green
        return $response
    }
    
    [void] Logout() {
        $this.Request(\"POST\", \"/auth/logout\")
        $this.Token = $null
        Write-Host \"Logged out successfully\" -ForegroundColor Green
    }
    
    [array] GetAppliances() {
        return $this.Request(\"GET\", \"/appliances\")
    }
    
    [object] CreateAppliance([hashtable]$appliance) {
        return $this.Request(\"POST\", \"/appliances\", $appliance)
    }
    
    [object] UpdateAppliance([int]$id, [hashtable]$appliance) {
        return $this.Request(\"PUT\", \"/appliances/$id\", $appliance)
    }
    
    [void] DeleteAppliance([int]$id) {
        $this.Request(\"DELETE\", \"/appliances/$id\")
    }
    
    [array] GetSSHKeys() {
        return $this.Request(\"GET\", \"/ssh/keys\")
    }
    
    [object] GenerateSSHKey([string]$name, [string]$type = \"rsa\", [int]$bits = 4096) {
        $body = @{
            name = $name
            type = $type
            bits = $bits
        }
        return $this.Request(\"POST\", \"/ssh/keys/generate\", $body)
    }
    
    [object] GetRemoteDesktopToken([int]$applianceId) {
        return $this.Request(\"POST\", \"/guacamole/token/$applianceId\")
    }
}

# Example usage
function Example-Usage {
    # Create client
    $client = [ApplianceDashboardClient]::new()
    
    try {
        # Login
        $client.Login(\"admin\", \"admin123\")
        
        # Get appliances
        $appliances = $client.GetAppliances()
        Write-Host \"Found $($appliances.Count) appliances\" -ForegroundColor Cyan
        
        # Create new appliance
        $newAppliance = @{
            name = \"PowerShell Test Server\"
            url = \"https://ps-test.example.com\"
            category = \"development\"
            ssh_host = \"192.168.1.110\"
            ssh_username = \"ps-user\"
            ssh_port = 22
        }
        
        $created = $client.CreateAppliance($newAppliance)
        Write-Host \"Created appliance: $($created.name)\" -ForegroundColor Yellow
        
        # Generate SSH key
        $sshKey = $client.GenerateSSHKey(\"powershell-test-key\")
        Write-Host \"Generated SSH key: $($sshKey.name)\" -ForegroundColor Magenta
        
        # Get remote desktop token
        $rdToken = $client.GetRemoteDesktopToken($created.id)
        Write-Host \"Remote Desktop URL: $($rdToken.url)\" -ForegroundColor Blue
        
        # Logout
        $client.Logout()
    }
    catch {
        Write-Error \"Error: $_\"
    }
}

# Interactive CLI
function Start-ApplianceDashboardCLI {
    $client = [ApplianceDashboardClient]::new()
    
    while ($true) {
        Write-Host \"\"
        Write-Host \"Web Appliance Dashboard CLI\" -ForegroundColor Cyan
        Write-Host \"===========================\" -ForegroundColor Cyan
        Write-Host \"1. Login\"
        Write-Host \"2. List Appliances\"
        Write-Host \"3. Create Appliance\"
        Write-Host \"4. List SSH Keys\"
        Write-Host \"5. Generate SSH Key\"
        Write-Host \"6. Get Remote Desktop Token\"
        Write-Host \"7. Logout\"
        Write-Host \"8. Exit\"
        Write-Host \"\"
        
        $choice = Read-Host \"Select option\"
        
        switch ($choice) {
            \"1\" {
                $username = Read-Host \"Username\"
                $password = Read-Host \"Password\" -AsSecureString
                $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
                    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
                )
                $client.Login($username, $plainPassword)
            }
            \"2\" {
                $appliances = $client.GetAppliances()
                $appliances | Format-Table -AutoSize
            }
            \"3\" {
                $name = Read-Host \"Name\"
                $url = Read-Host \"URL\"
                $category = Read-Host \"Category\"
                
                $appliance = @{
                    name = $name
                    url = $url
                    category = $category
                }
                
                $created = $client.CreateAppliance($appliance)
                Write-Host \"Created: $($created | ConvertTo-Json)\" -ForegroundColor Green
            }
            \"4\" {
                $keys = $client.GetSSHKeys()
                $keys | Format-Table -AutoSize
            }
            \"5\" {
                $name = Read-Host \"Key name\"
                $key = $client.GenerateSSHKey($name)
                Write-Host \"Generated: $($key | ConvertTo-Json)\" -ForegroundColor Green
            }
            \"6\" {
                $id = Read-Host \"Appliance ID\"
                $token = $client.GetRemoteDesktopToken([int]$id)
                Write-Host \"URL: $($token.url)\" -ForegroundColor Blue
            }
            \"7\" {
                $client.Logout()
            }
            \"8\" {
                Write-Host \"Goodbye!\" -ForegroundColor Yellow
                return
            }
            default {
                Write-Host \"Invalid option\" -ForegroundColor Red
            }
        }
        
        Write-Host \"\"
        Read-Host \"Press Enter to continue\"
    }
}

# Export functions
Export-ModuleMember -Function Example-Usage, Start-ApplianceDashboardCLI -Class ApplianceDashboardClient
```

## Postman Collection

### Collection JSON

```json
{
  \"info\": {
    \"name\": \"Web Appliance Dashboard API v1.1.0\",
    \"description\": \"API collection for Web Appliance Dashboard\",
    \"schema\": \"https://schema.getpostman.com/json/collection/v2.1.0/collection.json\"
  },
  \"auth\": {
    \"type\": \"bearer\",
    \"bearer\": [
      {
        \"key\": \"token\",
        \"value\": \"{{token}}\",
        \"type\": \"string\"
      }
    ]
  },
  \"variable\": [
    {
      \"key\": \"baseUrl\",
      \"value\": \"http://localhost:9080/api\"
    },
    {
      \"key\": \"token\",
      \"value\": \"\"
    }
  ],
  \"item\": [
    {
      \"name\": \"Authentication\",
      \"item\": [
        {
          \"name\": \"Login\",
          \"event\": [
            {
              \"listen\": \"test\",
              \"script\": {
                \"exec\": [
                  \"if (pm.response.code === 200) {\",
                  \"    const response = pm.response.json();\",
                  \"    pm.collectionVariables.set('token', response.token);\",
                  \"    pm.environment.set('token', response.token);\",
                  \"}\"
                ]
              }
            }
          ],
          \"request\": {
            \"auth\": {
              \"type\": \"noauth\"
            },
            \"method\": \"POST\",
            \"header\": [],
            \"body\": {
              \"mode\": \"raw\",
              \"raw\": \"{\
    \\\"username\\\": \\\"admin\\\",\
    \\\"password\\\": \\\"admin123\\\"\
}\",
              \"options\": {
                \"raw\": {
                  \"language\": \"json\"
                }
              }
            },
            \"url\": {
              \"raw\": \"{{baseUrl}}/auth/login\",
              \"host\": [\"{{baseUrl}}\"],
              \"path\": [\"auth\", \"login\"]
            }
          }
        },
        {
          \"name\": \"Logout\",
          \"request\": {
            \"method\": \"POST\",
            \"header\": [],
            \"url\": {
              \"raw\": \"{{baseUrl}}/auth/logout\",
              \"host\": [\"{{baseUrl}}\"],
              \"path\": [\"auth\", \"logout\"]
            }
          }
        }
      ]
    },
    {
      \"name\": \"Appliances\",
      \"item\": [
        {
          \"name\": \"Get All Appliances\",
          \"request\": {
            \"method\": \"GET\",
            \"header\": [],
            \"url\": {
              \"raw\": \"{{baseUrl}}/appliances\",
              \"host\": [\"{{baseUrl}}\"],
              \"path\": [\"appliances\"]
            }
          }
        },
        {
          \"name\": \"Create Appliance\",
          \"request\": {
            \"method\": \"POST\",
            \"header\": [],
            \"body\": {
              \"mode\": \"raw\",
              \"raw\": \"{\
    \\\"name\\\": \\\"Test Server\\\",\
    \\\"url\\\": \\\"https://test.example.com\\\",\
    \\\"category\\\": \\\"development\\\",\
    \\\"ssh_host\\\": \\\"192.168.1.100\\\",\
    \\\"ssh_username\\\": \\\"user\\\",\
    \\\"ssh_port\\\": 22,\
    \\\"remote_desktop_enabled\\\": true,\
    \\\"remote_protocol\\\": \\\"vnc\\\",\
    \\\"remote_host\\\": \\\"192.168.1.100\\\",\
    \\\"remote_port\\\": 5900\
}\",
              \"options\": {
                \"raw\": {
                  \"language\": \"json\"
                }
              }
            },
            \"url\": {
              \"raw\": \"{{baseUrl}}/appliances\",
              \"host\": [\"{{baseUrl}}\"],
              \"path\": [\"appliances\"]
            }
          }
        },
        {
          \"name\": \"Update Appliance\",
          \"request\": {
            \"method\": \"PUT\",
            \"header\": [],
            \"body\": {
              \"mode\": \"raw\",
              \"raw\": \"{\
    \\\"name\\\": \\\"Updated Server\\\",\
    \\\"url\\\": \\\"https://updated.example.com\\\"\
}\",
              \"options\": {
                \"raw\": {
                  \"language\": \"json\"
                }
              }
            },
            \"url\": {
              \"raw\": \"{{baseUrl}}/appliances/1\",
              \"host\": [\"{{baseUrl}}\"],
              \"path\": [\"appliances\", \"1\"]
            }
          }
        },
        {
          \"name\": \"Delete Appliance\",
          \"request\": {
            \"method\": \"DELETE\",
            \"header\": [],
            \"url\": {
              \"raw\": \"{{baseUrl}}/appliances/1\",
              \"host\": [\"{{baseUrl}}\"],
              \"path\": [\"appliances\", \"1\"]
            }
          }
        }
      ]
    },
    {
      \"name\": \"SSH Management\",
      \"item\": [
        {
          \"name\": \"Get SSH Keys\",
          \"request\": {
            \"method\": \"GET\",
            \"header\": [],
            \"url\": {
              \"raw\": \"{{baseUrl}}/ssh/keys\",
              \"host\": [\"{{baseUrl}}\"],
              \"path\": [\"ssh\", \"keys\"]
            }
          }
        },
        {
          \"name\": \"Generate SSH Key\",
          \"request\": {
            \"method\": \"POST\",
            \"header\": [],
            \"body\": {
              \"mode\": \"raw\",
              \"raw\": \"{\
    \\\"name\\\": \\\"test-key\\\",\
    \\\"type\\\": \\\"rsa\\\",\
    \\\"bits\\\": 4096\
}\",
              \"options\": {
                \"raw\": {
                  \"language\": \"json\"
                }
              }
            },
            \"url\": {
              \"raw\": \"{{baseUrl}}/ssh/keys/generate\",
              \"host\": [\"{{baseUrl}}\"],
              \"path\": [\"ssh\", \"keys\", \"generate\"]
            }
          }
        },
        {
          \"name\": \"Test SSH Connection\",
          \"request\": {
            \"method\": \"POST\",
            \"header\": [],
            \"body\": {
              \"mode\": \"raw\",
              \"raw\": \"{\
    \\\"host\\\": \\\"192.168.1.100\\\",\
    \\\"username\\\": \\\"root\\\",\
    \\\"keyId\\\": 1,\
    \\\"port\\\": 22\
}\",
              \"options\": {
                \"raw\": {
                  \"language\": \"json\"
                }
              }
            },
            \"url\": {
              \"raw\": \"{{baseUrl}}/ssh/test\",
              \"host\": [\"{{baseUrl}}\"],
              \"path\": [\"ssh\", \"test\"]
            }
          }
        }
      ]
    },
    {
      \"name\": \"Remote Desktop\",
      \"item\": [
        {
          \"name\": \"Get Remote Desktop Token\",
          \"request\": {
            \"method\": \"POST\",
            \"header\": [],
            \"url\": {
              \"raw\": \"{{baseUrl}}/guacamole/token/1\",
              \"host\": [\"{{baseUrl}}\"],
              \"path\": [\"guacamole\", \"token\", \"1\"]
            }
          }
        }
      ]
    },
    {
      \"name\": \"Service Control\",
      \"item\": [
        {
          \"name\": \"Control Service\",
          \"request\": {
            \"method\": \"POST\",
            \"header\": [],
            \"body\": {
              \"mode\": \"raw\",
              \"raw\": \"{\
    \\\"action\\\": \\\"restart\\\",\
    \\\"service\\\": \\\"nginx\\\"\
}\",
              \"options\": {
                \"raw\": {
                  \"language\": \"json\"
                }
              }
            },
            \"url\": {
              \"raw\": \"{{baseUrl}}/appliances/1/control\",
              \"host\": [\"{{baseUrl}}\"],
              \"path\": [\"appliances\", \"1\", \"control\"]
            }
          }
        }
      ]
    },
    {
      \"name\": \"Backup & Restore\",
      \"item\": [
        {
          \"name\": \"Create Backup\",
          \"request\": {
            \"method\": \"POST\",
            \"header\": [],
            \"url\": {
              \"raw\": \"{{baseUrl}}/backup/create\",
              \"host\": [\"{{baseUrl}}\"],
              \"path\": [\"backup\", \"create\"]
            }
          }
        },
        {
          \"name\": \"Download Backup\",
          \"request\": {
            \"method\": \"GET\",
            \"header\": [],
            \"url\": {
              \"raw\": \"{{baseUrl}}/backup/download/latest\",
              \"host\": [\"{{baseUrl}}\"],
              \"path\": [\"backup\", \"download\", \"latest\"]
            }
          }
        }
      ]
    }
  ]
}
```

## Testing & Best Practices

### Unit Testing Example (JavaScript/Jest)

```javascript
// __tests__/api-client.test.js
const ApplianceDashboardClient = require('../api-client');
const nock = require('nock');

describe('ApplianceDashboardClient', () => {
  let client;
  const baseURL = 'http://localhost:9080/api';
  
  beforeEach(() => {
    client = new ApplianceDashboardClient(baseURL);
  });
  
  afterEach(() => {
    nock.cleanAll();
  });
  
  describe('login', () => {
    it('should login successfully and store token', async () => {
      const mockResponse = {
        token: 'test-token',
        user: { id: 1, username: 'admin', role: 'admin' }
      };
      
      nock(baseURL)
        .post('/auth/login', { username: 'admin', password: 'admin123' })
        .reply(200, mockResponse);
      
      const result = await client.login('admin', 'admin123');
      
      expect(result).toEqual(mockResponse);
      expect(client.token).toBe('test-token');
    });
  });
  
  describe('getAppliances', () => {
    it('should get appliances with authentication', async () => {
      client.token = 'test-token';
      const mockAppliances = [
        { id: 1, name: 'Test Server', url: 'https://test.com' }
      ];
      
      nock(baseURL)
        .get('/appliances')
        .matchHeader('Authorization', 'Bearer test-token')
        .reply(200, mockAppliances);
      
      const result = await client.getAppliances();
      
      expect(result).toEqual(mockAppliances);
    });
  });
});
```

### Error Handling Best Practices

```javascript
// Retry logic with exponential backoff
class ResilientClient extends ApplianceDashboardClient {
  async retryRequest(fn, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        
        // Don't retry on client errors (4xx)
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
          throw error;
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }
  
  async getAppliances(params = {}) {
    return this.retryRequest(() => super.getAppliances(params));
  }
}
```

### Rate Limiting Handler

```javascript
// Rate limit aware client
class RateLimitedClient extends ApplianceDashboardClient {
  constructor(baseURL, token, requestsPerMinute = 60) {
    super(baseURL, token);
    this.queue = [];
    this.requestsPerMinute = requestsPerMinute;
    this.interval = 60000 / requestsPerMinute;
    this.processing = false;
  }
  
  async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const { fn, resolve, reject } = this.queue.shift();
      
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
      
      await new Promise(resolve => setTimeout(resolve, this.interval));
    }
    
    this.processing = false;
  }
  
  async rateLimitedRequest(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.processQueue();
    });
  }
  
  async getAppliances(params = {}) {
    return this.rateLimitedRequest(() => super.getAppliances(params));
  }
}
```

### WebSocket/SSE Integration

```javascript
// Real-time updates handler
class RealtimeClient extends ApplianceDashboardClient {
  subscribeToUpdates(callbacks = {}) {
    const eventSource = new EventSource(`${this.baseURL}/sse`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'appliance.updated':
          callbacks.onApplianceUpdate?.(data.payload);
          break;
        case 'service.status':
          callbacks.onServiceStatus?.(data.payload);
          break;
        case 'ssh.activity':
          callbacks.onSSHActivity?.(data.payload);
          break;
        default:
          callbacks.onUnknownEvent?.(data);
      }
    };
    
    eventSource.onerror = (error) => {
      callbacks.onError?.(error);
      
      // Implement reconnection logic
      setTimeout(() => {
        if (eventSource.readyState === EventSource.CLOSED) {
          this.subscribeToUpdates(callbacks);
        }
      }, 5000);
    };
    
    return () => eventSource.close();
  }
}
```

### Integration Testing

```python
# test_integration.py
import pytest
import asyncio
from appliance_dashboard_client import ApplianceDashboardClient

@pytest.fixture
async def client():
    client = ApplianceDashboardClient()
    await client.login('admin', 'admin123')
    yield client
    await client.logout()

@pytest.mark.asyncio
async def test_full_workflow(client):
    # Create appliance
    appliance = await client.create_appliance({
        'name': 'Test Integration Server',
        'url': 'https://integration-test.example.com',
        'category': 'test'
    })
    
    assert appliance['id'] is not None
    
    # Generate SSH key
    ssh_key = await client.generate_ssh_key('integration-test-key')
    assert ssh_key['public_key'] is not None
    
    # Assign key to appliance
    updated = await client.update_appliance(appliance['id'], {
        'ssh_key_id': ssh_key['id']
    })
    
    # Get remote desktop token
    rd_token = await client.get_remote_desktop_token(appliance['id'])
    assert 'url' in rd_token
    
    # Cleanup
    await client.delete_appliance(appliance['id'])
```

## SDK Packaging

### NPM Package (JavaScript)

```json
{
  \"name\": \"@appliance-dashboard/client\",
  \"version\": \"1.1.0\",
  \"description\": \"Official JavaScript/TypeScript client for Web Appliance Dashboard API\",
  \"main\": \"dist/index.js\",
  \"types\": \"dist/index.d.ts\",
  \"scripts\": {
    \"build\": \"tsc\",
    \"test\": \"jest\",
    \"prepublishOnly\": \"npm run build\"
  },
  \"keywords\": [\"appliance\", \"dashboard\", \"api\", \"client\"],
  \"author\": \"Alf Lewerken\",
  \"license\": \"MIT\",
  \"dependencies\": {
    \"axios\": \"^1.4.0\"
  },
  \"devDependencies\": {
    \"@types/node\": \"^18.0.0\",
    \"typescript\": \"^5.0.0\",
    \"jest\": \"^29.0.0\"
  }
}
```

### PyPI Package (Python)

```python
# setup.py
from setuptools import setup, find_packages

setup(
    name=\"appliance-dashboard-client\",
    version=\"1.1.0\",
    author=\"Alf Lewerken\",
    description=\"Official Python client for Web Appliance Dashboard API\",
    long_description=open(\"README.md\").read(),
    long_description_content_type=\"text/markdown\",
    url=\"https://github.com/alflewerken/web-appliance-dashboard\",
    packages=find_packages(),
    classifiers=[
        \"Programming Language :: Python :: 3\",
        \"License :: OSI Approved :: MIT License\",
        \"Operating System :: OS Independent\",
    ],
    python_requires=\">=3.7\",
    install_requires=[
        \"requests>=2.28.0\",
        \"aiohttp>=3.8.0\",
    ],
)
```

## Best Practices Summary

1. **Authentication**
   - Store tokens securely (never in plain text)
   - Implement token refresh logic
   - Handle 401 errors gracefully

2. **Error Handling**
   - Implement retry logic with exponential backoff
   - Distinguish between client and server errors
   - Provide meaningful error messages

3. **Performance**
   - Use connection pooling
   - Implement request caching where appropriate
   - Respect rate limits

4. **Security**
   - Always use HTTPS in production
   - Validate SSL certificates
   - Sanitize all inputs

5. **Monitoring**
   - Log all API calls
   - Track response times
   - Monitor error rates

---

**Version:** 1.1.0 | **Letzte Aktualisierung:** 24. Juli 2025`
}
Antwort

Successfully appended to /Users/alflewerken/Desktop/web-appliance-dashboard/docs/api-client-sdks.md (706 lines) ✅ File written successfully! (706 lines)
            
💡 Performance tip: For optimal speed, consider chunking files into ≤30 line pieces in future operations.