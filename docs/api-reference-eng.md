# Web Appliance Dashboard API Reference

Version: 1.1.1

## Table of Contents

1. [Introduction](#introduction)
2. [Authentication](#authentication)
3. [API Endpoints](#api-endpoints)
   - [Auth Endpoints](#auth-endpoints)
   - [Appliance Endpoints](#appliance-endpoints)
   - [SSH Endpoints](#ssh-endpoints)
   - [Remote Desktop Endpoints](#remote-desktop-endpoints)
   - [Backup Endpoints](#backup-endpoints)
   - [User Management](#user-management)
   - [Audit Log](#audit-log)
4. [Error Handling](#error-handling)
5. [Rate Limiting](#rate-limiting)
6. [WebSocket Events](#websocket-events)

## Introduction

The Web Appliance Dashboard API provides a RESTful interface for managing web appliances, SSH connections, remote desktop sessions, and system administration tasks.

**Base URL**: `http://localhost:3000/api`

**API Version**: 1.1.1

**Content-Type**: `application/json`

## Authentication

The API uses JWT (JSON Web Token) authentication. All requests (except login and health endpoints) require a valid JWT token.

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "your-password"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

### Using the Token

Include the token in the Authorization header for all subsequent requests:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## API Endpoints

### Auth Endpoints

#### Login
```http
POST /api/auth/login
```
Authenticate user and receive JWT token.

#### Verify Token
```http
GET /api/auth/verify
Authorization: Bearer <token>
```
Verify if the current token is valid.

#### Logout
```http
POST /api/auth/logout
Authorization: Bearer <token>
```
Invalidate the current session.

### Appliance Endpoints

#### List All Appliances
```http
GET /api/appliances
Authorization: Bearer <token>
```

**Query Parameters:**
- `category` (optional): Filter by category
- `search` (optional): Search term

**Response:**
```json
{
  "success": true,
  "appliances": [
    {
      "id": 1,
      "name": "Production Server",
      "category": "server",
      "url": "https://server.example.com",
      "icon": "server",
      "color": "#007AFF",
      "order": 1,
      "is_active": true,
      "show_in_sidebar": true
    }
  ]
}
```

#### Get Single Appliance
```http
GET /api/appliances/:id
Authorization: Bearer <token>
```

#### Create Appliance
```http
POST /api/appliances
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "New Server",
  "category": "server",
  "url": "https://new-server.example.com",
  "icon": "server",
  "color": "#007AFF"
}
```

#### Update Appliance
```http
PUT /api/appliances/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Server Name",
  "url": "https://updated-server.example.com"
}
```

#### Delete Appliance
```http
DELETE /api/appliances/:id
Authorization: Bearer <token>
```

#### Check Appliance Status
```http
GET /api/appliances/:id/status
Authorization: Bearer <token>
```

#### Proxy Requests
```http
ALL /api/appliances/:id/proxy/*
Authorization: Bearer <token>
```
Proxy requests to the appliance.

### SSH Endpoints

#### List SSH Hosts
```http
GET /api/ssh/hosts
Authorization: Bearer <token>
```

#### Create SSH Host
```http
POST /api/ssh/hosts
Authorization: Bearer <token>
Content-Type: application/json

{
  "hostname": "production-server",
  "host": "192.168.1.100",
  "port": 22,
  "username": "admin",
  "password": "password"
}
```

#### Setup SSH Key
```http
POST /api/ssh/setup
Authorization: Bearer <token>
Content-Type: application/json

{
  "hostname": "production-server",
  "host": "192.168.1.100",
  "username": "admin",
  "password": "password"
}
```
#### Update SSH Host
```http
PUT /api/ssh/hosts/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "hostname": "updated-server",
  "password": "new-password"
}
```

#### Delete SSH Host
```http
DELETE /api/ssh/hosts/:id
Authorization: Bearer <token>
```

#### Execute SSH Command
```http
POST /api/ssh/execute
Authorization: Bearer <token>
Content-Type: application/json

{
  "hostId": 1,
  "command": "ls -la"
}
```

#### SSH File Upload
```http
POST /api/ssh/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <binary>
hostId: 1
remotePath: /home/user/
```

### Remote Desktop Endpoints

#### List Remote Desktop Connections
```http
GET /api/remote-desktop/connections
Authorization: Bearer <token>
```

#### Create Connection
```http
POST /api/remote-desktop/connections
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "VNC Server",
  "protocol": "vnc",
  "parameters": {
    "hostname": "192.168.1.100",
    "port": 5900,
    "password": "vnc-password"
  }
}
```

#### Get Connection Token
```http
GET /api/remote-desktop/token/:connectionId
Authorization: Bearer <token>
```

**Response:**
```json
{
  "token": "ABC123DEF456",
  "url": "http://localhost:9070/guacamole/#/client/ABC123DEF456"
}
```

#### Clear Guacamole Cache
```http
POST /api/remote-desktop/clear-cache
Authorization: Bearer <token>
```

### Backup Endpoints

#### Create Backup
```http
GET /api/backup
Authorization: Bearer <token>
```

**Response:**
```json
{
  "metadata": {
    "version": "1.1.1",
    "created_at": "2025-01-27T12:00:00Z",
    "appliances_count": 10,
    "users_count": 5
  },
  "appliances": [...],
  "users": [...],
  "ssh_hosts": [...],
  "encryption_key": "your-encryption-key"
}
```

#### Restore Backup
```http
POST /api/backup/restore
Authorization: Bearer <token>
Content-Type: application/json

{
  "metadata": {...},
  "appliances": [...],
  "users": [...],
  "ssh_hosts": [...]
}
```

### User Management

#### List Users
```http
GET /api/users
Authorization: Bearer <token>
```

#### Create User
```http
POST /api/users
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "newuser",
  "password": "password123",
  "email": "user@example.com",
  "role": "user"
}
```

#### Update User
```http
PUT /api/users/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "newemail@example.com",
  "role": "admin"
}
```

#### Delete User
```http
DELETE /api/users/:id
Authorization: Bearer <token>
```

#### Change Password
```http
PUT /api/users/:id/password
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

### Audit Log

#### Get Audit Logs
```http
GET /api/audit
Authorization: Bearer <token>
```

**Query Parameters:**
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string
- `action` (optional): Filter by action type
- `user` (optional): Filter by username

#### Export Audit Logs
```http
GET /api/audit/export
Authorization: Bearer <token>
```

## Error Handling

The API returns consistent error responses:

```json
{
  "success": false,
  "error": "Error message description",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

- `401` - Unauthorized (invalid or missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Resource not found
- `409` - Conflict (e.g., duplicate entry)
- `422` - Validation error
- `429` - Too many requests (rate limit exceeded)
- `500` - Internal server error

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Default limit**: 100 requests per 15 minutes per IP
- **Proxy endpoints**: 60 requests per 15 minutes per user
- **SSH operations**: 30 requests per 15 minutes per user

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: UTC timestamp when limit resets

## WebSocket Events

The API supports Server-Sent Events (SSE) for real-time updates:

```http
GET /api/events
Authorization: Bearer <token>
Accept: text/event-stream
```

### Event Types

#### Status Update
```json
{
  "type": "status_update",
  "data": {
    "applianceId": 1,
    "status": "online",
    "responseTime": 125
  }
}
```

#### SSH Session Update
```json
{
  "type": "ssh_session",
  "data": {
    "hostId": 1,
    "status": "connected",
    "sessionId": "abc123"
  }
}
```

#### System Notification
```json
{
  "type": "notification",
  "data": {
    "level": "info",
    "message": "Backup completed successfully"
  }
}
```

## SDK Examples

For language-specific examples, see [API Client SDKs](./api-client-sdks.md).

## OpenAPI Specification

The complete OpenAPI 3.0 specification is available at [openapi.yaml](./openapi.yaml).

---

Last updated: January 2025 | Version: 1.1.1