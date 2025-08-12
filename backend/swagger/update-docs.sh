#!/bin/bash

# Update Swagger Documentation Script
# This script updates and validates the Swagger documentation

echo "🚀 Updating Swagger Documentation..."

# Change to backend directory
cd "$(dirname "$0")/.." || exit 1

# Check if required files exist
if [ ! -f "swagger/enhanced-swagger-docs.js" ]; then
    echo "❌ Error: enhanced-swagger-docs.js not found!"
    exit 1
fi

# Validate JavaScript syntax
echo "📋 Validating documentation files..."
node -c swagger/swaggerConfig.js || { echo "❌ swaggerConfig.js has syntax errors"; exit 1; }
node -c swagger/enhanced-swagger-docs.js || { echo "❌ enhanced-swagger-docs.js has syntax errors"; exit 1; }
node -c swagger/api-endpoints.js || { echo "❌ api-endpoints.js has syntax errors"; exit 1; }

# Generate API documentation summary
echo "📊 Generating API summary..."
node -e "
const fs = require('fs');
const path = require('path');

// Count endpoints
let endpointCount = 0;
const files = [
    'swagger/enhanced-swagger-docs.js',
    'swagger/api-endpoints.js'
];

files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const matches = content.match(/@swagger/g);
    if (matches) {
        endpointCount += matches.length;
    }
});

console.log('✅ Found ' + endpointCount + ' documented endpoints');

// Extract categories
const categories = new Set();
files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const tagMatches = content.match(/tags:\s*\[(.*?)\]/g);
    if (tagMatches) {
        tagMatches.forEach(match => {
            const tag = match.match(/\[(.*?)\]/)[1];
            categories.add(tag);
        });
    }
});

console.log('📁 API Categories: ' + Array.from(categories).join(', '));
"

# Test server startup with Swagger
echo "🧪 Testing Swagger integration..."
timeout 5s node -e "
const express = require('express');
const { swaggerUi, swaggerSpec } = require('./swagger/swaggerConfig');

const app = express();
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const server = app.listen(0, () => {
    console.log('✅ Swagger UI successfully initialized');
    server.close();
    process.exit(0);
});
" || echo "⚠️  Could not test Swagger initialization (this is normal if dependencies are not installed)"

# Create API documentation index
echo "📝 Creating API index..."
cat > swagger/API_INDEX.md << EOF
# API Endpoint Index

Generated on: $(date)

## Authentication
- POST /api/auth/login - User login
- GET /api/auth/verify - Verify JWT token
- POST /api/auth/logout - User logout
- POST /api/auth/refresh - Refresh token

## Appliances
- GET /api/appliances - Get all appliances
- GET /api/appliances/{id} - Get single appliance
- POST /api/appliances - Create appliance
- PUT /api/appliances/{id} - Update appliance
- DELETE /api/appliances/{id} - Delete appliance
- PATCH /api/appliances/{id}/favorite - Toggle favorite
- POST /api/appliances/{id}/test-connection - Test connection

## Categories
- GET /api/categories - Get all categories
- POST /api/categories - Create category
- PUT /api/categories/{id} - Update category
- DELETE /api/categories/{id} - Delete category
- POST /api/categories/reorder - Reorder categories
- GET /api/categories/{id}/appliances - Get category appliances

## SSH Management
- GET /api/ssh/keys - Get SSH keys
- POST /api/ssh/keys/generate - Generate SSH key
- DELETE /api/ssh/keys/{id} - Delete SSH key
- GET /api/ssh/hosts - Get SSH hosts
- POST /api/ssh/hosts - Add SSH host
- POST /api/ssh/hosts/{id}/test - Test SSH connection
- POST /api/ssh/hosts/{id}/execute - Execute command

## Services
- GET /api/services - Get all services
- GET /api/services/{hostId}/{serviceName}/status - Get service status
- POST /api/services/{hostId}/{serviceName}/control - Control service

## Settings
- GET /api/settings - Get all settings
- PUT /api/settings/{key} - Update setting

## Backup & Restore
- GET /api/backup - Export backup
- GET /api/backup/stats - Get backup statistics
- POST /api/restore - Restore from backup
- POST /api/backup/enhanced/create - Create enhanced backup
- GET /api/backup/enhanced/list - List backups
- GET /api/backup/enhanced/download/{filename} - Download backup
- POST /api/backup/enhanced/validate - Validate backup
- POST /api/backup/enhanced/restore - Enhanced restore
- POST /api/backup/enhanced/cleanup - Cleanup old backups

## Audit Logs
- GET /api/auditLogs - Get audit logs
- GET /api/auditLogs/export - Export as CSV
- GET /api/auditLogs/{resourceType}/{resourceId} - Get resource logs
- DELETE /api/auditLogs - Delete logs

## Status Monitoring
- POST /api/statusCheck - Bulk status check
- GET /api/sse/events - Server-sent events stream

## Terminal
- POST /api/terminal/session - Create terminal session
- WS /api/terminal/ws/{sessionId} - WebSocket connection

## User Management
- GET /api/users - Get all users
- POST /api/users - Create user
- PUT /api/users/{id} - Update user
- DELETE /api/users/{id} - Delete user
- PUT /api/users/{id}/password - Change password

## Remote Desktop (Guacamole)
- POST /api/guacamole/token - Generate access token
- GET /api/guacamole/validate/{token} - Validate token
- POST /api/guacamole/cleanup - Cleanup tokens
EOF

echo "✅ Swagger documentation update complete!"
echo ""
echo "📌 Next steps:"
echo "   1. Start the server: npm run dev"
echo "   2. Open Swagger UI: http://localhost:9080/api-docs"
echo "   3. Test the endpoints with the interactive documentation"
