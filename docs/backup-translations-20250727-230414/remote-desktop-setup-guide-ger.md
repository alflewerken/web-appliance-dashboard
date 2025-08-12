# Remote Desktop Setup Guide

## Version 1.1.1

Dieses Dokument beschreibt die Einrichtung und Konfiguration der Remote Desktop Funktionalität über Apache Guacamole im Web Appliance Dashboard.

## 📋 Inhaltsverzeichnis

- [Übersicht](#übersicht)
- [Architektur](#architektur)
- [Installation](#installation)
- [Konfiguration](#konfiguration)
- [Protokolle](#protokolle)
- [Sicherheit](#sicherheit)
- [Troubleshooting](#troubleshooting)
- [Performance Optimierung](#performance-optimierung)

## 🎯 Übersicht

Apache Guacamole ist ein clientless Remote Desktop Gateway, das VNC, RDP und SSH Verbindungen über einen Webbrowser ermöglicht. In Version 1.1.1 wurde Guacamole vollständig in das Web Appliance Dashboard integriert.

### Hauptfeatures

- **Protokoll-Support**: VNC, RDP, SSH
- **Browser-basiert**: Keine Client-Software erforderlich
- **Token-Authentifizierung**: Sichere, temporäre Zugriffe
- **Multi-User**: Gleichzeitige Verbindungen möglich
- **Verschlüsselung**: Ende-zu-Ende verschlüsselte Verbindungen

## 🏗️ Architektur

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web Browser   │────▶│    Guacamole    │────▶│     guacd       │
│                 │     │   (Web Client)  │     │  (Proxy Daemon) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                          │
                        ┌─────────────────────────────────┼─────────────┐
                        │                                 │             │
                  ┌─────▼─────┐                   ┌──────▼────┐ ┌──────▼────┐
                  │    VNC     │                   │    RDP    │ │    SSH    │
                  │  Servers   │                   │   Hosts   │ │   Hosts   │
                  └───────────┘                   └───────────┘ └───────────┘
```

### Container-Struktur

- **guacamole**: Web-Frontend (Tomcat-basiert)
- **guacd**: Proxy-Daemon für Protokoll-Übersetzung
- **guacamole-postgres**: Konfigurations-Datenbank

## 📦 Installation

### 1. Standard-Installation (mit Build-Script)

```bash
# Vollständige Installation mit Remote Desktop
./scripts/build.sh --nocache
```

### 2. Nachträgliche Installation

```bash
# Remote Desktop zu bestehender Installation hinzufügen
./scripts/update-remote-desktop.sh
```

### 3. Manuelle Installation

```bash
# Docker Services starten
docker compose up -d guacamole-postgres guacd guacamole

# Datenbank initialisieren
docker exec -i guacamole-postgres psql -U guacamole_user guacamole_db < guacamole/initdb.sql

# Nginx Konfiguration neu laden
docker exec appliance_nginx nginx -s reload
```

## ⚙️ Konfiguration

### Umgebungsvariablen

#### Backend (.env)

```env
# Guacamole Database
GUACAMOLE_DB_NAME=guacamole_db
GUACAMOLE_DB_USER=guacamole_user
GUACAMOLE_DB_PASSWORD=your_secure_password
GUACAMOLE_DB_HOST=guacamole-postgres
GUACAMOLE_DB_PORT=5432

# Guacamole Settings
GUACAMOLE_HOME=/etc/guacamole
POSTGRES_INITDB_ARGS=--auth=scram-sha-256
```

#### Docker Compose Konfiguration

```yaml
guacamole:
  image: guacamole/guacamole:1.5.5
  environment:
    GUACD_HOSTNAME: guacd
    POSTGRES_DATABASE: ${GUACAMOLE_DB_NAME}
    POSTGRES_USER: ${GUACAMOLE_DB_USER}
    POSTGRES_PASSWORD: ${GUACAMOLE_DB_PASSWORD}
    POSTGRES_HOSTNAME: guacamole-postgres
  depends_on:
    - guacd
    - guacamole-postgres
  networks:
    - appliance_network

guacd:
  image: guacamole/guacd:1.5.5
  networks:
    - appliance_network

guacamole-postgres:
  image: postgres:16-alpine
  environment:
    POSTGRES_DB: ${GUACAMOLE_DB_NAME}
    POSTGRES_USER: ${GUACAMOLE_DB_USER}
    POSTGRES_PASSWORD: ${GUACAMOLE_DB_PASSWORD}
  volumes:
    - postgres_data:/var/lib/postgresql/data
  networks:
    - appliance_network
```

### Nginx Proxy Konfiguration

```nginx
# Guacamole Proxy
location /guacamole/ {
    proxy_pass http://guacamole:8080/guacamole/;
    proxy_buffering off;
    proxy_http_version 1.1;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $http_connection;
    proxy_cookie_path /guacamole/ /guacamole/;
    access_log off;
    
    # WebSocket Support
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 86400;
}
```

## 🔌 Protokolle

### VNC (Virtual Network Computing)

#### Konfiguration in der Appliance

```javascript
{
  "remoteDesktopEnabled": true,
  "remoteProtocol": "vnc",
  "remoteHost": "192.168.1.100",
  "remotePort": 5900,
  "remotePassword": "vnc_password" // wird verschlüsselt gespeichert
}
```

#### VNC Server Setup (Linux)

```bash
# TigerVNC Installation
sudo apt-get install tigervnc-standalone-server

# VNC Server starten
vncserver :1 -geometry 1920x1080 -depth 24

# Passwort setzen
vncpasswd
```

#### Empfohlene VNC Server

- **Linux**: TigerVNC, TightVNC, x11vnc
- **Windows**: RealVNC, TightVNC, UltraVNC
- **macOS**: Integrierte Bildschirmfreigabe

### RDP (Remote Desktop Protocol)

#### Konfiguration in der Appliance

```javascript
{
  "remoteDesktopEnabled": true,
  "remoteProtocol": "rdp",
  "remoteHost": "192.168.1.200",
  "remotePort": 3389,
  "remoteUsername": "Administrator",
  "remotePassword": "windows_password", // wird verschlüsselt gespeichert
  "remoteDomain": "WORKGROUP" // optional
}
```

#### Windows RDP Aktivierung

```powershell
# RDP aktivieren
Set-ItemProperty -Path 'HKLM:\System\CurrentControlSet\Control\Terminal Server' -name "fDenyTSConnections" -value 0

# Firewall-Regel hinzufügen
Enable-NetFirewallRule -DisplayGroup "Remote Desktop"

# NLA (Network Level Authentication) optional deaktivieren
Set-ItemProperty -Path 'HKLM:\System\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp' -name "UserAuthentication" -value 0
```

### SSH (Secure Shell)

SSH-Verbindungen werden primär über das integrierte Web-Terminal (ttyd) gehandhabt, können aber auch über Guacamole erfolgen.

## 🔒 Sicherheit

### Token-basierte Authentifizierung

1. **Token-Generierung**: Bei jeder Remote Desktop Anfrage wird ein temporärer Token erstellt
2. **Gültigkeit**: Tokens sind 5 Minuten gültig
3. **Single-Use**: Jeder Token kann nur einmal verwendet werden
4. **Verschlüsselung**: Tokens werden mit JWT signiert

```javascript
// Token-Generierung im Backend
const token = jwt.sign({
  username: `user_${userId}`,
  connectionId: connectionId,
  exp: Math.floor(Date.now() / 1000) + 300 // 5 Minuten
}, process.env.JWT_SECRET);
```

### Passwort-Verschlüsselung

Alle Remote Desktop Passwörter werden mit AES-256 verschlüsselt:

```javascript
// Verschlüsselung
const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
const encrypted = cipher.update(password, 'utf8', 'hex') + cipher.final('hex');

// Entschlüsselung
const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
const decrypted = decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
```

### Best Practices

1. **Verwenden Sie starke Passwörter** für alle Remote-Verbindungen
2. **Aktivieren Sie Verschlüsselung** auf VNC/RDP Servern
3. **Begrenzen Sie Netzwerkzugriff** mit Firewalls
4. **Überwachen Sie Zugriffe** über Audit Logs
5. **Rotieren Sie Credentials** regelmäßig

## 🔧 Troubleshooting

### Häufige Probleme

#### 1. Verbindung schlägt fehl

```bash
# Guacamole Logs prüfen
docker logs appliance_guacamole

# Guacd Logs prüfen
docker logs appliance_guacd

# Netzwerk-Konnektivität testen
docker exec appliance_backend nc -zv <remote_host> <remote_port>
```

#### 2. "Invalid Token" Fehler

- Token ist abgelaufen (>5 Minuten)
- Token wurde bereits verwendet
- JWT_SECRET stimmt nicht überein

```bash
# Token-Generierung testen
docker exec appliance_backend node utils/guacamole/test-token.js
```

#### 3. Schwarzer Bildschirm bei VNC

- VNC Server läuft nicht
- Falscher Port konfiguriert
- Firewall blockiert Verbindung
- Desktop-Umgebung nicht gestartet

```bash
# VNC Server Status prüfen
systemctl status vncserver@:1

# X11 Display prüfen
export DISPLAY=:1
xhost +
```

#### 4. RDP Authentication Fehler

- Network Level Authentication (NLA) aktiviert
- Falscher Benutzername/Domäne
- Passwort enthält Sonderzeichen

```powershell
# NLA deaktivieren (Windows)
Set-ItemProperty -Path 'HKLM:\System\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp' -name "UserAuthentication" -value 0
```

### Debug-Modus

```bash
# Guacd im Debug-Modus starten
docker run --rm -it --network appliance_network guacamole/guacd:1.5.5 /usr/local/sbin/guacd -L debug -f

# Verbose Logging aktivieren
docker exec appliance_guacamole sed -i 's/INFO/DEBUG/g' /usr/local/tomcat/conf/logging.properties
docker restart appliance_guacamole
```

## ⚡ Performance Optimierung

### 1. Verbindungsparameter

```javascript
// Optimale VNC Einstellungen
{
  "color-depth": 16,          // Reduzierte Farbtiefe
  "compression": 9,           // Maximale Kompression
  "quality": 6,              // Mittlere Qualität
  "disable-audio": true,      // Audio deaktivieren
  "enable-wallpaper": false   // Desktop-Hintergrund deaktivieren
}

// Optimale RDP Einstellungen
{
  "color-depth": 16,
  "disable-audio": true,
  "disable-wallpaper": true,
  "disable-theming": true,
  "disable-font-smoothing": true,
  "performance-flags": "0x00000001 | 0x00000002 | 0x00000004"
}
```

### 2. Netzwerk-Optimierung

```bash
# TCP Tuning
echo "net.core.rmem_max = 134217728" >> /etc/sysctl.conf
echo "net.core.wmem_max = 134217728" >> /etc/sysctl.conf
echo "net.ipv4.tcp_rmem = 4096 87380 134217728" >> /etc/sysctl.conf
echo "net.ipv4.tcp_wmem = 4096 65536 134217728" >> /etc/sysctl.conf
sysctl -p
```

### 3. Container Resources

```yaml
# docker-compose.override.yml
services:
  guacd:
    mem_limit: 2g
    cpus: '2.0'
    
  guacamole:
    mem_limit: 1g
    cpus: '1.0'
    environment:
      JAVA_OPTS: '-Xmx768m -Xms256m'
```

### 4. Caching

```nginx
# Nginx Cache für statische Guacamole Assets
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## 📊 Monitoring

### Metriken sammeln

```bash
# Aktive Verbindungen
docker exec guacamole-postgres psql -U guacamole_user -d guacamole_db -c "SELECT COUNT(*) FROM guacamole_connection WHERE connection_id IN (SELECT connection_id FROM guacamole_connection_history WHERE end_date IS NULL);"

# Verbindungshistorie
docker exec guacamole-postgres psql -U guacamole_user -d guacamole_db -c "SELECT username, start_date, end_date, remote_host FROM guacamole_connection_history ORDER BY start_date DESC LIMIT 10;"

# Resource Usage
docker stats guacd guacamole guacamole-postgres
```

### Health Checks

```yaml
# docker-compose.yml
guacamole:
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8080/guacamole/"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 60s

guacd:
  healthcheck:
    test: ["CMD", "nc", "-z", "localhost", "4822"]
    interval: 30s
    timeout: 5s
    retries: 3
```

## 🔄 Backup & Restore

### Guacamole Konfiguration sichern

```bash
# Backup erstellen
docker exec guacamole-postgres pg_dump -U guacamole_user guacamole_db > guacamole_backup_$(date +%Y%m%d).sql

# Backup wiederherstellen
docker exec -i guacamole-postgres psql -U guacamole_user guacamole_db < guacamole_backup.sql
```

### Connection Settings exportieren

```bash
# Export als JSON
docker exec appliance_backend node utils/backup/export-remote-connections.js > remote_connections.json

# Import
docker exec appliance_backend node utils/backup/import-remote-connections.js < remote_connections.json
```

## 📚 Weiterführende Ressourcen

- [Apache Guacamole Dokumentation](https://guacamole.apache.org/doc/gug/)
- [VNC Security Best Practices](https://www.realvnc.com/en/connect/docs/security.html)
- [RDP Security Guide](https://docs.microsoft.com/en-us/windows-server/remote/remote-desktop-services/rds-security)
- [Web Appliance Dashboard Wiki](https://github.com/alflewerken/web-appliance-dashboard/wiki)

---

**Version:** 1.1.1 | **Letzte Aktualisierung:** 27. Januar 2025http.Request) {
    req.Header.Set("Authorization", "Bearer "+c.Token)
    req.Header.Set("Content-Type", "application/json")
}

func (c *RemoteDesktopClient) GetConnections() ([]Connection, error) {
    req, err := http.NewRequest("GET", c.BaseURL+"/api/remote-desktop/connections", nil)
    if err != nil {
        return nil, err
    }
    
    c.setHeaders(req)
    resp, err := c.Client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    var connections []Connection
    if err := json.NewDecoder(resp.Body).Decode(&connections); err != nil {
        return nil, err
    }
    
    return connections, nil
}

func (c *RemoteDesktopClient) CreateConnection(conn ConnectionRequest) (*Connection, error) {
    jsonData, err := json.Marshal(conn)
    if err != nil {
        return nil, err
    }
    
    req, err := http.NewRequest("POST", c.BaseURL+"/api/remote-desktop/connections", 
        bytes.NewBuffer(jsonData))
    if err != nil {
        return nil, err
    }
    
    c.setHeaders(req)
    resp, err := c.Client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    var connection Connection
    if err := json.NewDecoder(resp.Body).Decode(&connection); err != nil {
        return nil, err
    }
    
    return &connection, nil
}

func (c *RemoteDesktopClient) GetConnectionToken(connectionID int) (*TokenResponse, error) {
    url := fmt.Sprintf("%s/api/remote-desktop/token/%d", c.BaseURL, connectionID)
    req, err := http.NewRequest("GET", url, nil)
    if err != nil {
        return nil, err
    }
    
    c.setHeaders(req)
    resp, err := c.Client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    var tokenResp TokenResponse
    if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
        return nil, err
    }
    
    return &tokenResp, nil
}

// Example usage
func main() {
    client := NewRemoteDesktopClient("http://localhost:3000", "your-token")
    
    // Create VNC connection
    conn, err := client.CreateConnection(ConnectionRequest{
        Name:     "Test VNC Server",
        Protocol: "vnc",
        Parameters: map[string]interface{}{
            "hostname": "192.168.1.100",
            "port":     5900,
            "password": "vnc-password",
        },
    })
    
    if err != nil {
        panic(err)
    }
    
    // Get connection token
    token, err := client.GetConnectionToken(conn.ID)
    if err != nil {
        panic(err)
    }
    
    fmt.Printf("Guacamole URL: %s\n", token.URL)
}
```

### PHP

```php
<?php
// RemoteDesktopClient.php

class RemoteDesktopClient {
    private $baseUrl;
    private $token;
    
    public function __construct($baseUrl, $token) {
        $this->baseUrl = $baseUrl;
        $this->token = $token;
    }
    
    private function getHeaders() {
        return [
            'Authorization: Bearer ' . $this->token,
            'Content-Type: application/json'
        ];
    }
    
    public function getConnections() {
        $ch = curl_init($this->baseUrl . '/api/remote-desktop/connections');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $this->getHeaders());
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 200) {
            throw new Exception('Failed to get connections');
        }
        
        return json_decode($response, true);
    }
    
    public function createConnection($connectionData) {
        $ch = curl_init($this->baseUrl . '/api/remote-desktop/connections');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($connectionData));
        curl_setopt($ch, CURLOPT_HTTPHEADER, $this->getHeaders());
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 201) {
            throw new Exception('Failed to create connection');
        }
        
        return json_decode($response, true);
    }
    
    public function getConnectionToken($connectionId) {
        $ch = curl_init($this->baseUrl . '/api/remote-desktop/token/' . $connectionId);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $this->getHeaders());
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 200) {
            throw new Exception('Failed to get connection token');
        }
        
        $data = json_decode($response, true);
        return $data['token'];
    }
    
    public function getGuacamoleUrl($connectionId) {
        $token = $this->getConnectionToken($connectionId);
        $guacBase = str_replace(':3000', ':9070', $this->baseUrl);
        return $guacBase . '/guacamole/#/client/' . $token;
    }
}

// Example usage
$client = new RemoteDesktopClient('http://localhost:3000', 'your-token');

// Create VNC connection
$connection = $client->createConnection([
    'name' => 'Test VNC Server',
    'protocol' => 'vnc',
    'parameters' => [
        'hostname' => '192.168.1.100',
        'port' => 5900,
        'password' => 'vnc-password'
    ]
]);

// Get Guacamole URL
$url = $client->getGuacamoleUrl($connection['id']);
echo "Open this URL: $url\n";
?>
```

### Java

```java
// RemoteDesktopClient.java
import java.io.*;
import java.net.*;
import java.util.*;
import com.google.gson.*;
import okhttp3.*;

public class RemoteDesktopClient {
    private final String baseUrl;
    private final String token;
    private final OkHttpClient client;
    private final Gson gson;
    
    public RemoteDesktopClient(String baseUrl, String token) {
        this.baseUrl = baseUrl;
        this.token = token;
        this.client = new OkHttpClient();
        this.gson = new Gson();
    }
    
    private Request.Builder getRequestBuilder(String url) {
        return new Request.Builder()
            .url(url)
            .addHeader("Authorization", "Bearer " + token)
            .addHeader("Content-Type", "application/json");
    }
    
    public List<Connection> getConnections() throws IOException {
        Request request = getRequestBuilder(baseUrl + "/api/remote-desktop/connections")
            .build();
        
        try (Response response = client.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                throw new IOException("Unexpected code " + response);
            }
            
            Type listType = new TypeToken<List<Connection>>(){}.getType();
            return gson.fromJson(response.body().string(), listType);
        }
    }
    
    public Connection createConnection(ConnectionRequest connectionData) throws IOException {
        MediaType JSON = MediaType.parse("application/json; charset=utf-8");
        RequestBody body = RequestBody.create(JSON, gson.toJson(connectionData));
        
        Request request = getRequestBuilder(baseUrl + "/api/remote-desktop/connections")
            .post(body)
            .build();
        
        try (Response response = client.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                throw new IOException("Unexpected code " + response);
            }
            
            return gson.fromJson(response.body().string(), Connection.class);
        }
    }
    
    public TokenResponse getConnectionToken(int connectionId) throws IOException {
        Request request = getRequestBuilder(
            baseUrl + "/api/remote-desktop/token/" + connectionId
        ).build();
        
        try (Response response = client.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                throw new IOException("Unexpected code " + response);
            }
            
            return gson.fromJson(response.body().string(), TokenResponse.class);
        }
    }
    
    public String getGuacamoleUrl(int connectionId) throws IOException {
        TokenResponse token = getConnectionToken(connectionId);
        String guacBase = baseUrl.replace(":3000", ":9070");
        return guacBase + "/guacamole/#/client/" + token.token;
    }
    
    // Model classes
    public static class Connection {
        public int id;
        public String name;
        public String protocol;
        public Map<String, Object> parameters;
    }
    
    public static class ConnectionRequest {
        public String name;
        public String protocol;
        public Map<String, Object> parameters;
        
        public ConnectionRequest(String name, String protocol) {
            this.name = name;
            this.protocol = protocol;
            this.parameters = new HashMap<>();
        }
    }
    
    public static class TokenResponse {
        public String token;
        public String url;
    }
    
    // Example usage
    public static void main(String[] args) {
        try {
            RemoteDesktopClient client = new RemoteDesktopClient(
                "http://localhost:3000", 
                "your-token"
            );
            
            // Create VNC connection
            ConnectionRequest request = new ConnectionRequest("Test VNC", "vnc");
            request.parameters.put("hostname", "192.168.1.100");
            request.parameters.put("port", 5900);
            request.parameters.put("password", "vnc-password");
            
            Connection conn = client.createConnection(request);
            
            // Get Guacamole URL
            String url = client.getGuacamoleUrl(conn.id);
            System.out.println("Guacamole URL: " + url);
            
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
```

### C#/.NET

```csharp
// RemoteDesktopClient.cs
using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;

namespace ApplianceDashboard
{
    public class RemoteDesktopClient
    {
        private readonly HttpClient _httpClient;
        private readonly string _baseUrl;
        
        public RemoteDesktopClient(string baseUrl, string token)
        {
            _baseUrl = baseUrl;
            _httpClient = new HttpClient();
            _httpClient.DefaultRequestHeaders.Authorization = 
                new AuthenticationHeaderValue("Bearer", token);
            _httpClient.DefaultRequestHeaders.Accept.Add(
                new MediaTypeWithQualityHeaderValue("application/json"));
        }
        
        public async Task<List<Connection>> GetConnectionsAsync()
        {
            var response = await _httpClient.GetAsync($"{_baseUrl}/api/remote-desktop/connections");
            response.EnsureSuccessStatusCode();
            
            var json = await response.Content.ReadAsStringAsync();
            return JsonConvert.DeserializeObject<List<Connection>>(json);
        }
        
        public async Task<Connection> CreateConnectionAsync(ConnectionRequest connectionData)
        {
            var json = JsonConvert.SerializeObject(connectionData);
            var content = new StringContent(json, Encoding.UTF8, "application/json");
            
            var response = await _httpClient.PostAsync(
                $"{_baseUrl}/api/remote-desktop/connections", content);
            response.EnsureSuccessStatusCode();
            
            var responseJson = await response.Content.ReadAsStringAsync();
            return JsonConvert.DeserializeObject<Connection>(responseJson);
        }
        
        public async Task<TokenResponse> GetConnectionTokenAsync(int connectionId)
        {
            var response = await _httpClient.GetAsync(
                $"{_baseUrl}/api/remote-desktop/token/{connectionId}");
            response.EnsureSuccessStatusCode();
            
            var json = await response.Content.ReadAsStringAsync();
            return JsonConvert.DeserializeObject<TokenResponse>(json);
        }
        
        public async Task<string> GetGuacamoleUrlAsync(int connectionId)
        {
            var token = await GetConnectionTokenAsync(connectionId);
            var guacBase = _baseUrl.Replace(":3000", ":9070");
            return $"{guacBase}/guacamole/#/client/{token.Token}";
        }
        
        // Model classes
        public class Connection
        {
            public int Id { get; set; }
            public string Name { get; set; }
            public string Protocol { get; set; }
            public Dictionary<string, object> Parameters { get; set; }
        }
        
        public class ConnectionRequest
        {
            public string Name { get; set; }
            public string Protocol { get; set; }
            public Dictionary<string, object> Parameters { get; set; }
            
            public ConnectionRequest()
            {
                Parameters = new Dictionary<string, object>();
            }
        }
        
        public class TokenResponse
        {
            public string Token { get; set; }
            public string Url { get; set; }
        }
    }
    
    // Example usage
    class Program
    {
        static async Task Main(string[] args)
        {
            var client = new RemoteDesktopClient("http://localhost:3000", "your-token");
            
            // Create VNC connection
            var request = new RemoteDesktopClient.ConnectionRequest
            {
                Name = "Test VNC Server",
                Protocol = "vnc",
                Parameters = new Dictionary<string, object>
                {
                    ["hostname"] = "192.168.1.100",
                    ["port"] = 5900,
                    ["password"] = "vnc-password"
                }
            };
            
            var connection = await client.CreateConnectionAsync(request);
            
            // Get Guacamole URL
            var url = await client.GetGuacamoleUrlAsync(connection.Id);
            Console.WriteLine($"Guacamole URL: {url}");
        }
    }
}
```

### Ruby

```ruby
# remote_desktop_client.rb
require 'net/http'
require 'json'
require 'uri'

class RemoteDesktopClient
  def initialize(base_url, token)
    @base_url = base_url
    @token = token
  end
  
  def get_connections
    uri = URI("#{@base_url}/api/remote-desktop/connections")
    request = Net::HTTP::Get.new(uri)
    set_headers(request)
    
    response = Net::HTTP.start(uri.hostname, uri.port) do |http|
      http.request(request)
    end
    
    raise "Failed to get connections" unless response.code == '200'
    JSON.parse(response.body)
  end
  
  def create_connection(connection_data)
    uri = URI("#{@base_url}/api/remote-desktop/connections")
    request = Net::HTTP::Post.new(uri)
    set_headers(request)
    request.body = connection_data.to_json
    
    response = Net::HTTP.start(uri.hostname, uri.port) do |http|
      http.request(request)
    end
    
    raise "Failed to create connection" unless response.code == '201'
    JSON.parse(response.body)
  end
  
  def get_connection_token(connection_id)
    uri = URI("#{@base_url}/api/remote-desktop/token/#{connection_id}")
    request = Net::HTTP::Get.new(uri)
    set_headers(request)
    
    response = Net::HTTP.start(uri.hostname, uri.port) do |http|
      http.request(request)
    end
    
    raise "Failed to get token" unless response.code == '200'
    JSON.parse(response.body)['token']
  end
  
  def get_guacamole_url(connection_id)
    token = get_connection_token(connection_id)
    guac_base = @base_url.gsub(':3000', ':9070')
    "#{guac_base}/guacamole/#/client/#{token}"
  end
  
  private
  
  def set_headers(request)
    request['Authorization'] = "Bearer #{@token}"
    request['Content-Type'] = 'application/json'
  end
end

# Example usage
client = RemoteDesktopClient.new('http://localhost:3000', 'your-token')

# Create VNC connection
connection = client.create_connection({
  name: 'Test VNC Server',
  protocol: 'vnc',
  parameters: {
    hostname: '192.168.1.100',
    port: 5900,
    password: 'vnc-password'
  }
})

# Get Guacamole URL
url = client.get_guacamole_url(connection['id'])
puts "Guacamole URL: #{url}"
```

### cURL/Bash

```bash
#!/bin/bash
# remote_desktop_client.sh

BASE_URL="http://localhost:3000"
TOKEN="your-token"

# Function to make authenticated requests
api_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    if [ -z "$data" ]; then
        curl -s -X "$method" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            "$BASE_URL$endpoint"
    else
        curl -s -X "$method" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint"
    fi
}

# Get all connections
get_connections() {
    api_request "GET" "/api/remote-desktop/connections"
}

# Create a new connection
create_connection() {
    local name=$1
    local protocol=$2
    local hostname=$3
    local port=$4
    local password=$5
    
    local data=$(cat <<EOF
{
    "name": "$name",
    "protocol": "$protocol",
    "parameters": {
        "hostname": "$hostname",
        "port": $port,
        "password": "$password"
    }
}
EOF
)
    
    api_request "POST" "/api/remote-desktop/connections" "$data"
}

# Get connection token
get_connection_token() {
    local connection_id=$1
    api_request "GET" "/api/remote-desktop/token/$connection_id" | jq -r '.token'
}

# Get Guacamole URL
get_guacamole_url() {
    local connection_id=$1
    local token=$(get_connection_token "$connection_id")
    local guac_base=$(echo "$BASE_URL" | sed 's/:3000/:9070/')
    echo "$guac_base/guacamole/#/client/$token"
}

# Example usage
echo "Creating VNC connection..."
response=$(create_connection "Test VNC" "vnc" "192.168.1.100" 5900 "vnc-password")
connection_id=$(echo "$response" | jq -r '.id')

echo "Connection created with ID: $connection_id"

url=$(get_guacamole_url "$connection_id")
echo "Guacamole URL: $url"

# List all connections
echo -e "\nAll connections:"
get_connections | jq '.'
```

### PowerShell

```powershell
# RemoteDesktopClient.ps1

class RemoteDesktopClient {
    [string]$BaseUrl
    [string]$Token
    [hashtable]$Headers
    
    RemoteDesktopClient([string]$baseUrl, [string]$token) {
        $this.BaseUrl = $baseUrl
        $this.Token = $token
        $this.Headers = @{
            'Authorization' = "Bearer $token"
            'Content-Type' = 'application/json'
        }
    }
    
    [object[]] GetConnections() {
        $response = Invoke-RestMethod -Uri "$($this.BaseUrl)/api/remote-desktop/connections" `
            -Headers $this.Headers -Method Get
        return $response
    }
    
    [object] CreateConnection([hashtable]$connectionData) {
        $json = $connectionData | ConvertTo-Json
        $response = Invoke-RestMethod -Uri "$($this.BaseUrl)/api/remote-desktop/connections" `
            -Headers $this.Headers -Method Post -Body $json
        return $response
    }
    
    [string] GetConnectionToken([int]$connectionId) {
        $response = Invoke-RestMethod -Uri "$($this.BaseUrl)/api/remote-desktop/token/$connectionId" `
            -Headers $this.Headers -Method Get
        return $response.token
    }
    
    [string] GetGuacamoleUrl([int]$connectionId) {
        $token = $this.GetConnectionToken($connectionId)
        $guacBase = $this.BaseUrl -replace ':3000', ':9070'
        return "$guacBase/guacamole/#/client/$token"
    }
}

# Example usage
$client = [RemoteDesktopClient]::new('http://localhost:3000', 'your-token')

# Create VNC connection
$connectionData = @{
    name = 'Test VNC Server'
    protocol = 'vnc'
    parameters = @{
        hostname = '192.168.1.100'
        port = 5900
        password = 'vnc-password'
    }
}

$connection = $client.CreateConnection($connectionData)
Write-Host "Created connection with ID: $($connection.id)"

# Get Guacamole URL
$url = $client.GetGuacamoleUrl($connection.id)
Write-Host "Guacamole URL: $url"

# List all connections
$connections = $client.GetConnections()
$connections | Format-Table -Property id, name, protocol
```

## 📦 Postman Collection

```json
{
  "info": {
    "name": "Web Appliance Dashboard - Remote Desktop API",
    "version": "1.1.1",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "auth": {
    "type": "bearer",
    "bearer": [
      {
        "key": "token",
        "value": "{{auth_token}}",
        "type": "string"
      }
    ]
  },
  "variable": [
    {
      "key": "base_url",
      "value": "http://localhost:3000"
    },
    {
      "key": "auth_token",
      "value": ""
    }
  ],
  "item": [
    {
      "name": "Authentication",
      "item": [
        {
          "name": "Login",
          "event": [
            {
              "listen": "test",
              "script": {
                "exec": [
                  "var jsonData = pm.response.json();",
                  "pm.collectionVariables.set('auth_token', jsonData.token);"
                ]
              }
            }
          ],
          "request": {
            "method": "POST",
            "header": [],
            "body": {
              "mode": "raw",
              "raw": "{\n    \"username\": \"admin\",\n    \"password\": \"password\"\n}",
              "options": {
                "raw": {
                  "language": "json"
                }
              }
            },
            "url": {
              "raw": "{{base_url}}/api/auth/login",
              "host": ["{{base_url}}"],
              "path": ["api", "auth", "login"]
            }
          }
        }
      ]
    },
    {
      "name": "Remote Desktop",
      "item": [
        {
          "name": "Get Connections",
          "request": {
            "method": "GET",
            "header": [],
            "url": {
              "raw": "{{base_url}}/api/remote-desktop/connections",
              "host": ["{{base_url}}"],
              "path": ["api", "remote-desktop", "connections"]
            }
          }
        },
        {
          "name": "Create VNC Connection",
          "request": {
            "method": "POST",
            "header": [],
            "body": {
              "mode": "raw",
              "raw": "{\n    \"name\": \"Test VNC Server\",\n    \"protocol\": \"vnc\",\n    \"parameters\": {\n        \"hostname\": \"192.168.1.100\",\n        \"port\": 5900,\n        \"password\": \"vnc-password\"\n    }\n}",
              "options": {
                "raw": {
                  "language": "json"
                }
              }
            },
            "url": {
              "raw": "{{base_url}}/api/remote-desktop/connections",
              "host": ["{{base_url}}"],
              "path": ["api", "remote-desktop", "connections"]
            }
          }
        },
        {
          "name": "Get Connection Token",
          "request": {
            "method": "GET",
            "header": [],
            "url": {
              "raw": "{{base_url}}/api/remote-desktop/token/1",
              "host": ["{{base_url}}"],
              "path": ["api", "remote-desktop", "token", "1"]
            }
          }
        }
      ]
    }
  ]
}
```

## 🧪 Testing und Best Practices

### Unit Testing (JavaScript/Jest)

```javascript
// remote-desktop-client.test.js
const RemoteDesktopClient = require('./remote-desktop-client');

describe('RemoteDesktopClient', () => {
  let client;
  
  beforeEach(() => {
    client = new RemoteDesktopClient('http://localhost:3000', 'test-token');
    global.fetch = jest.fn();
  });
  
  test('should create connection successfully', async () => {
    const mockResponse = { id: 1, name: 'Test VNC' };
    fetch.mockResolvedValueOnce({
      json: async () => mockResponse
    });
    
    const result = await client.createConnection({
      name: 'Test VNC',
      protocol: 'vnc',
      parameters: { hostname: '192.168.1.100' }
    });
    
    expect(result).toEqual(mockResponse);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/remote-desktop/connections',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-token'
        })
      })
    );
  });
});
```

### Best Practices

1. **Error Handling**
   - Always implement retry logic for network failures
   - Handle authentication errors gracefully
   - Provide meaningful error messages

2. **Security**
   - Never hardcode credentials
   - Use environment variables for sensitive data
   - Implement token refresh mechanisms

3. **Performance**
   - Cache connection lists when appropriate
   - Implement connection pooling for high-volume applications
   - Use async/await for better performance

4. **Monitoring**
   - Log all connection attempts
   - Monitor token expiration
   - Track connection success rates