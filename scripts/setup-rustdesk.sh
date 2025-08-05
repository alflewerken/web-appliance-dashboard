#!/bin/bash
# RustDesk Setup Script für Web Appliance Dashboard

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🚀 RustDesk Integration Setup"
echo "============================"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p "$PROJECT_ROOT/rustdesk/data"
mkdir -p "$PROJECT_ROOT/rustdesk/web-config"

# Start RustDesk containers
echo "🐳 Starting RustDesk containers..."
cd "$PROJECT_ROOT"
docker-compose -f docker-compose.rustdesk.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 5

# Check if services are running
echo "✅ Checking service status..."
docker-compose -f docker-compose.rustdesk.yml ps

# Get server key
echo "🔑 Server Public Key:"
if [ -f "./rustdesk/data/id_ed25519.pub" ]; then
    cat "./rustdesk/data/id_ed25519.pub"
else
    echo "Key will be generated on first start..."
fi

echo ""
echo "✅ RustDesk setup complete!"
echo ""
echo "Service URLs:"
echo "- ID Server: localhost:21116"
echo "- Relay Server: localhost:21117"
echo "- Web Client: http://localhost:21121"
echo "- API: http://localhost:21119"
echo ""
echo "Next steps:"
echo "1. Restart main application: docker-compose restart backend nginx"
echo "2. Access Remote Desktop from appliance cards"
echo "3. RustDesk will be installed automatically on first use"
