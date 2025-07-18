#!/bin/bash
# Setup-Skript für Web Appliance Dashboard Mac App
# Stellt sicher, dass alle Komponenten korrekt konfiguriert sind

set -e

echo "🚀 Web Appliance Dashboard Mac App Setup"
echo "========================================"

# Pfad zum Projekt
PROJECT_DIR="/Users/alflewerken/Desktop/web-appliance-dashboard"
MACAPP_DIR="$PROJECT_DIR/macos-app"

# 1. Frontend bauen
echo "📦 Building Frontend..."
cd "$PROJECT_DIR/frontend"
npm run build

# 2. Docker Images bauen
echo "🐳 Building Docker Images..."
cd "$MACAPP_DIR"
docker-compose -f docker-compose.app.yml build

# 3. Container stoppen und entfernen
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.app.yml down || true

# 4. Volumes bereinigen (optional)
# echo "🧹 Cleaning volumes..."
# docker volume rm wad_app_db_data wad_app_ssh_keys wad_app_uploads 2>/dev/null || true

# 5. Container starten
echo "🚀 Starting containers..."
docker-compose -f docker-compose.app.yml up -d

# 6. Auf Datenbank warten
echo "⏳ Waiting for database to be ready..."
sleep 10

# 7. Fehlende Tabellen erstellen
echo "📊 Creating missing database tables..."
docker exec wad_app_db mariadb -u root -prootpassword123 appliance_dashboard -e "
CREATE TABLE IF NOT EXISTS user_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  session_id VARCHAR(255) NOT NULL UNIQUE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_session_id (session_id),
  INDEX idx_user_id (user_id),
  INDEX idx_expires_at (expires_at)
);" 2>/dev/null || true

# 8. Backend neu starten
echo "🔄 Restarting backend..."
docker restart wad_app_backend

# 9. Status überprüfen
echo ""
echo "✅ Setup Complete!"
echo ""
echo "📊 Container Status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep wad_app

echo ""
echo "🌐 Access URLs:"
echo "   Dashboard: http://localhost:9081"
echo "   API:       http://localhost:3002/api"
echo "   Terminal:  http://localhost:7682"
echo ""
echo "💡 Troubleshooting:"
echo "   - Clear browser cache: CMD+SHIFT+R"
echo "   - View logs: docker logs wad_app_backend"
echo "   - Restart app: docker-compose -f docker-compose.app.yml restart"
