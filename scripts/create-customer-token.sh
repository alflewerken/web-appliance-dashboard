#!/bin/bash

# GitHub Personal Access Token Generator Script
# This script helps create PATs for customers to access private Docker images

echo "======================================"
echo "GitHub Access Token Creation Guide"
echo "======================================"
echo ""
echo "To create an access token for your customer:"
echo ""
echo "1. Go to: https://github.com/settings/tokens/new"
echo ""
echo "2. Configure the token:"
echo "   - Note: 'Docker Access for [Customer Name]'"
echo "   - Expiration: Set appropriate expiration (30 days, 60 days, etc.)"
echo "   - Select scopes:"
echo "     ✓ read:packages (Required for pulling Docker images)"
echo ""
echo "3. Click 'Generate token' and copy it immediately"
echo ""
echo "4. Share with customer via secure channel"
echo ""
echo "======================================"
echo "Alternative: Use GitHub CLI"
echo "======================================"
echo ""
echo "gh auth token"
echo ""
echo "Or create a new token:"
echo "gh auth login --scopes read:packages"
echo ""
echo "======================================"
echo "Customer Instructions Template:"
echo "======================================"
echo ""
cat << 'EOF'
Dear Customer,

Here are your access credentials for the Web Appliance Dashboard:

Docker Registry: ghcr.io
Username: customer-read-only
Access Token: ghp_xxxxxxxxxxxxxxxxxxxx

To login:
docker login ghcr.io -u customer-read-only -p ghp_xxxxxxxxxxxxxxxxxxxx

Or more securely:
echo "ghp_xxxxxxxxxxxxxxxxxxxx" | docker login ghcr.io -u customer-read-only --password-stdin

This token expires on: [DATE]

Please refer to INSTALLATION.md for detailed setup instructions.

Best regards,
Alflewerken Team
EOF
