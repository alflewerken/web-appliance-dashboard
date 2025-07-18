# API Integration Guide

Dieses Dokument zeigt, wie Sie die Web Appliance Dashboard API in Ihre Anwendungen integrieren können.

## Quick Start

### 1. Authentifizierung

Alle API-Requests (außer Login) benötigen einen JWT-Token:

```javascript
// Login
const response = await fetch('http://localhost:3001/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'admin',
    password: 'admin123'
  })
});

const { token } = await response.json();

// Token in weiteren Requests verwenden
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};
```

### 2. Basis-Operationen

```javascript
// Appliances abrufen
const appliances = await fetch('http://localhost:3001/api/appliances', { headers });

// Neue Appliance erstellen
await fetch('http://localhost:3001/api/appliances', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    name: 'Production Server',
    url: 'https://prod.example.com',
    category: 'infrastructure'
  })
});
```

## SDK Downloads

Vorgefertigte Client-Libraries für verschiedene Sprachen:

- **JavaScript/TypeScript**: `npm install @appliance-dashboard/client`
- **Python**: `pip install appliance-dashboard-client`
- **Go**: `go get github.com/alflewerken/appliance-dashboard-go-client`
- **PHP**: `composer require appliance-dashboard/php-client`

## Rate Limiting

- Standard Endpoints: 100 Requests/Stunde
- Auth Endpoints: 5 Requests/Minute
- File Uploads: 10 Requests/Stunde

## Support

- GitHub Issues: [Report a bug](https://github.com/alflewerken/web-appliance-dashboard/issues)
- API Docs: [Full Documentation](./api-reference.md)
- Examples: [Code Examples](./api-reference.md#api-client-beispiele)