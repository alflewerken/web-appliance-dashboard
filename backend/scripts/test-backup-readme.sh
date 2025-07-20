#!/bin/bash

# Make test script executable
chmod +x test-enhanced-backup.js

echo "Enhanced Backup Test Script"
echo "========================="
echo ""
echo "This script tests the enhanced backup/restore functionality."
echo ""
echo "Prerequisites:"
echo "1. The Web Appliance Dashboard must be running"
echo "2. You need a valid auth token"
echo ""
echo "To get an auth token:"
echo "1. Login via the API:"
echo "   curl -X POST http://localhost:3001/api/auth/login \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"username\":\"admin\",\"password\":\"your-password\"}'"
echo ""
echo "2. Copy the token from the response"
echo ""
echo "3. Run the test with:"
echo "   export AUTH_TOKEN='your-token-here'"
echo "   ./test-enhanced-backup.js"
echo ""
echo "Or run directly with:"
echo "   AUTH_TOKEN='your-token-here' node test-enhanced-backup.js"
echo ""