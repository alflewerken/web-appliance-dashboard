# Web Appliance Dashboard API Documentation

## Overview

This directory contains the Swagger/OpenAPI documentation for the Web Appliance Dashboard API.

## Files

- `swaggerConfig.js` - Main Swagger configuration with schemas and API definitions
- `api-endpoints.js` - Detailed endpoint documentation with examples
- `enhanced-api-docs.md` - Comprehensive API documentation with code examples in curl, Python, and JavaScript

## Accessing the Documentation

### 1. Swagger UI (Interactive)

When the backend server is running, access the interactive API documentation at:

```
http://localhost:3001/api-docs
```

This provides:
- Interactive API testing
- Schema visualization
- Try-it-out functionality
- Authentication testing

### 2. Enhanced Documentation

For detailed examples and code snippets, see `enhanced-api-docs.md` which includes:
- Complete API endpoint descriptions
- Request/response examples
- Code examples in multiple languages (curl, Python, JavaScript)
- Error handling patterns
- Best practices
- Complete example applications

## Using the API

### Quick Start

1. **Get Authentication Token**:
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}'
```

2. **Use Token in Requests**:
```bash
curl -X GET http://localhost:3001/api/appliances \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Example Clients

#### Python
```python
import requests

class WebApplianceAPI:
    def __init__(self, base_url='http://localhost:3001'):
        self.base_url = base_url
        self.token = None
    
    def login(self, username, password):
        response = requests.post(
            f'{self.base_url}/api/auth/login',
            json={'username': username, 'password': password}
        )
        data = response.json()
        self.token = data['token']
        return data['user']
    
    def get_appliances(self):
        response = requests.get(
            f'{self.base_url}/api/appliances',
            headers={'Authorization': f'Bearer {self.token}'}
        )
        return response.json()

# Usage
api = WebApplianceAPI()
api.login('admin', 'password123')
appliances = api.get_appliances()
```

#### JavaScript
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
    const data = await response.json();
    this.token = data.token;
    return data.user;
  }

  async getAppliances() {
    const response = await fetch(`${this.baseUrl}/api/appliances`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    return response.json();
  }
}

// Usage
const api = new WebApplianceAPI();
await api.login('admin', 'password123');
const appliances = await api.getAppliances();
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login and get JWT token

### Appliances
- `GET /api/appliances` - Get all appliances
- `POST /api/appliances` - Create new appliance
- `PUT /api/appliances/:id` - Update appliance
- `DELETE /api/appliances/:id` - Delete appliance

### Categories
- `GET /api/categories` - Get all categories with counts

### Services
- `GET /api/services` - Get all services
- `POST /api/services/:name/:action` - Control service (start/stop/restart)

### Settings
- `GET /api/settings` - Get all settings
- `PUT /api/settings/:key` - Update setting

### SSH
- `GET /api/ssh/keys` - Get SSH keys
- `POST /api/ssh/keys/generate` - Generate new SSH key pair

### Backup & Restore
- `POST /api/backup` - Create backup
- `POST /api/restore` - Restore from backup

### Audit & Monitoring
- `GET /api/audit-logs` - Get audit logs
- `POST /api/status-check` - Check appliance status

### Real-time Events
- `GET /api/sse` - Subscribe to server-sent events

## Authentication

All API endpoints (except `/api/auth/login`) require JWT authentication.

Include the token in the Authorization header:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

## Rate Limiting

- Login endpoint: 20 requests per 15 minutes per IP
- Other endpoints: No rate limiting by default

Rate limit headers:
- `RateLimit-Limit`: Maximum requests allowed
- `RateLimit-Remaining`: Requests remaining
- `RateLimit-Reset`: Time when limit resets

## Error Handling

Standard HTTP status codes:
- `200 OK` - Success
- `201 Created` - Resource created
- `400 Bad Request` - Invalid request
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

Error response format:
```json
{
  "error": "Error message",
  "details": "Additional details (development only)"
}
```

## WebSocket Endpoints

### Terminal WebSocket
Connect to: `ws://localhost:3001/api/terminal/ws?token=YOUR_TOKEN&applianceId=APPLIANCE_ID`

## Development

To update the Swagger documentation:

1. Modify schemas in `swaggerConfig.js`
2. Update endpoint documentation in route files
3. Regenerate documentation if needed

## Testing

Use the Swagger UI "Try it out" feature to test endpoints directly from the browser.

For automated testing, see the example clients in `enhanced-api-docs.md`.

## Contributing

When adding new endpoints:
1. Add JSDoc comments to the route file
2. Update schemas in `swaggerConfig.js` if needed
3. Add examples to `enhanced-api-docs.md`
4. Test using Swagger UI

## Resources

- [OpenAPI Specification](https://swagger.io/specification/)
- [Swagger JSDoc](https://github.com/Surnet/swagger-jsdoc)
- [Project Repository](https://github.com/alflewerken/web-appliance-dashboard)
