# Swagger API Dokumentation

## Übersicht

Die Web Appliance Dashboard API ist vollständig mit Swagger/OpenAPI 3.0 dokumentiert. Die Dokumentation bietet:

- **Interaktive API-Dokumentation**: Testen Sie Endpoints direkt im Browser
- **Detaillierte Beschreibungen**: Jeder Endpoint ist ausführlich dokumentiert
- **Beispiele**: Request/Response-Beispiele für alle Endpoints
- **Schemas**: Vollständige Datenmodell-Definitionen
- **Authentifizierung**: JWT-basierte Sicherheit

## Zugriff auf die Dokumentation

### Entwicklungsumgebung
```
http://localhost:9080/api-docs
```

### Produktionsumgebung
```
http://[YOUR-SERVER]:9080/api-docs
```

## Struktur der Dokumentation

### 1. API-Kategorien

Die API ist in logische Bereiche unterteilt:

- **Authentication**: Anmeldung, Token-Verwaltung
- **Appliances**: Verwaltung von Web-Appliances
- **Categories**: Organisation in Kategorien
- **SSH Management**: SSH-Schlüssel und Hosts
- **Services**: Systemdienste-Verwaltung
- **Settings**: Systemkonfiguration
- **Backup & Restore**: Datensicherung
- **Audit Logs**: Aktivitätsprotokollierung
- **Remote Desktop**: VNC/RDP-Zugriff
- **Terminal**: Web-basiertes Terminal
- **Status Monitoring**: Echtzeit-Überwachung
- **User Management**: Benutzerverwaltung

### 2. Authentifizierung

Alle API-Endpoints (außer `/api/auth/login`) erfordern einen JWT-Token:

```bash
# 1. Login
curl -X POST http://localhost:9080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password"}'

# 2. Verwende den Token
curl -X GET http://localhost:9080/api/appliances \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. Wichtige Features

#### Echtzeit-Updates (SSE)
```javascript
const eventSource = new EventSource('/api/sse/events', {
  headers: {
    'Authorization': 'Bearer ' + token
  }
});

eventSource.addEventListener('status-update', (event) => {
  const data = JSON.parse(event.data);
  console.log('Status update:', data);
});
```

#### Bulk-Operationen
- Status-Check für mehrere Appliances gleichzeitig
- Batch-Updates für Einstellungen
- Massen-Import/Export von Konfigurationen

#### Sicherheitsfeatures
- Rate Limiting auf Login-Endpoint
- Verschlüsselte SSH-Key-Speicherung
- Audit-Logging aller Aktionen
- Rollenbasierte Zugriffskontrolle

## Erweiterte Nutzung

### Python-Client Beispiel
```python
import requests
import json

class ApplianceDashboardAPI:
    def __init__(self, base_url, username, password):
        self.base_url = base_url
        self.token = self.login(username, password)
        
    def login(self, username, password):
        response = requests.post(
            f"{self.base_url}/api/auth/login",
            json={"username": username, "password": password}
        )
        return response.json()["token"]
    
    def get_appliances(self):
        headers = {"Authorization": f"Bearer {self.token}"}
        response = requests.get(
            f"{self.base_url}/api/appliances",
            headers=headers
        )
        return response.json()

# Verwendung
api = ApplianceDashboardAPI("http://localhost:9080", "admin", "password")
appliances = api.get_appliances()
```

### JavaScript/Node.js Client
```javascript
const axios = require('axios');

class ApplianceDashboardClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.token = null;
  }
  
  async login(username, password) {
    const response = await axios.post(`${this.baseUrl}/api/auth/login`, {
      username,
      password
    });
    this.token = response.data.token;
    return this.token;
  }
  
  async getAppliances() {
    const response = await axios.get(`${this.baseUrl}/api/appliances`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });
    return response.data;
  }
}

// Verwendung
const client = new ApplianceDashboardClient('http://localhost:9080');
await client.login('admin', 'password');
const appliances = await client.getAppliances();
```

## Fehlerbehandlung

Die API verwendet standardisierte HTTP-Statuscodes:

- `200 OK`: Erfolgreiche Anfrage
- `201 Created`: Ressource erfolgreich erstellt
- `400 Bad Request`: Ungültige Anfrage/Parameter
- `401 Unauthorized`: Keine oder ungültige Authentifizierung
- `403 Forbidden`: Keine Berechtigung für diese Aktion
- `404 Not Found`: Ressource nicht gefunden
- `429 Too Many Requests`: Rate Limit überschritten
- `500 Internal Server Error`: Serverfehler

Fehlerantworten haben folgendes Format:
```json
{
  "error": "Fehlerbeschreibung",
  "details": "Zusätzliche Details (nur im Development-Modus)"
}
```

## Entwicklung

### Neue Endpoints hinzufügen

1. Erstellen Sie die Route in `/backend/routes/`
2. Fügen Sie JSDoc-Kommentare hinzu:
```javascript
/**
 * @swagger
 * /api/your-endpoint:
 *   get:
 *     summary: Kurze Beschreibung
 *     tags: [YourCategory]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Ausführliche Beschreibung mit Markdown-Unterstützung.
 *       
 *       **Features**:
 *       - Feature 1
 *       - Feature 2
 *     responses:
 *       200:
 *         description: Erfolgreiche Antwort
 */
```

3. Starten Sie den Server neu, um die Dokumentation zu aktualisieren

### Swagger-Konfiguration anpassen

Die Hauptkonfiguration befindet sich in:
- `/backend/swagger/swaggerConfig.js`: Basis-Konfiguration
- `/backend/swagger/enhanced-swagger-docs.js`: Erweiterte Dokumentation
- `/backend/swagger/api-endpoints.js`: Legacy-Endpoints

## Best Practices

1. **Versionierung**: Nutzen Sie Versionierung für Breaking Changes
2. **Pagination**: Implementieren Sie Pagination für große Datensätze
3. **Filtering**: Bieten Sie Filteroptionen für Listen-Endpoints
4. **Caching**: Nutzen Sie HTTP-Caching-Header
5. **Idempotenz**: PUT/DELETE sollten idempotent sein
6. **Konsistenz**: Verwenden Sie einheitliche Namenskonventionen

## Support

Bei Fragen oder Problemen:
- Öffnen Sie ein Issue auf GitHub
- Konsultieren Sie die Inline-Dokumentation
- Prüfen Sie die Beispiel-Clients im `/swagger`-Verzeichnis
