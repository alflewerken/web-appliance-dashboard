#!/bin/bash

# Build Script für Web Appliance Dashboard macOS App
# Dieses Script automatisiert den kompletten Build-Prozess

echo "🏗️  Web Appliance Dashboard macOS App Build Script"
echo "================================================"

# Setze Variablen
PROJECT_ROOT="$(dirname "$(dirname "$(pwd)")")"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
MACAPP_DIR="$(pwd)"

# Prüfe ob wir im richtigen Verzeichnis sind
if [ ! -f "package.json" ]; then
    echo "❌ Fehler: package.json nicht gefunden!"
    echo "Bitte führen Sie dieses Script im macos-app Verzeichnis aus."
    exit 1
fi

# Funktion für Fortschrittsanzeige
show_progress() {
    echo ""
    echo "➡️  $1"
    echo "-----------------------------------"
}

# 1. Frontend bauen
show_progress "Building Frontend..."
cd "$FRONTEND_DIR"
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi
echo "🔨 Building frontend..."
npm run build

# 2. Zurück zum macOS App Verzeichnis
cd "$MACAPP_DIR"

# 3. Dependencies installieren
show_progress "Installing macOS App Dependencies..."
npm install

# 4. Docker Images bauen
show_progress "Building Docker Images..."
docker-compose -f docker-compose.app.yml build

# 5. Erstelle notwendige Verzeichnisse
show_progress "Creating necessary directories..."
mkdir -p assets
mkdir -p dist/scripts

# 6. Erstelle Icons wenn nicht vorhanden
if [ ! -f "assets/icon.png" ]; then
    echo "🎨 Creating placeholder icons..."
    # Erstelle einen einfachen Platzhalter mit sips (macOS built-in)
    echo "<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<svg width=\"512\" height=\"512\" viewBox=\"0 0 512 512\" xmlns=\"http://www.w3.org/2000/svg\">
  <rect width=\"512\" height=\"512\" fill=\"#2196F3\"/>
  <text x=\"256\" y=\"280\" font-family=\"Arial\" font-size=\"200\" fill=\"white\" text-anchor=\"middle\">W</text>
</svg>" > assets/icon.svg
    
    # Konvertiere zu PNG
    qlmanage -t -s 512 -o assets assets/icon.svg 2>/dev/null || echo "⚠️  Icon conversion skipped"
    mv assets/icon.svg.png assets/icon.png 2>/dev/null || touch assets/icon.png
fi

if [ ! -f "assets/tray-icon.png" ]; then
    # Erstelle Tray Icon (22x22 für macOS)
    echo "<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<svg width=\"22\" height=\"22\" viewBox=\"0 0 22 22\" xmlns=\"http://www.w3.org/2000/svg\">
  <rect width=\"22\" height=\"22\" fill=\"#2196F3\"/>
  <text x=\"11\" y=\"17\" font-family=\"Arial\" font-size=\"16\" fill=\"white\" text-anchor=\"middle\">W</text>
</svg>" > assets/tray-icon.svg
    
    qlmanage -t -s 22 -o assets assets/tray-icon.svg 2>/dev/null || echo "⚠️  Tray icon conversion skipped"
    mv assets/tray-icon.svg.png assets/tray-icon.png 2>/dev/null || touch assets/tray-icon.png
fi

# 7. Erstelle .icns Datei für macOS
if [ ! -f "assets/icon.icns" ]; then
    echo "🎨 Creating .icns file..."
    mkdir -p assets/icon.iconset
    
    # Erstelle verschiedene Größen (vereinfacht)
    for size in 16 32 64 128 256 512; do
        touch "assets/icon.iconset/icon_${size}x${size}.png"
    done
    
    iconutil -c icns assets/icon.iconset -o assets/icon.icns 2>/dev/null || touch assets/icon.icns
    rm -rf assets/icon.iconset
fi

# 8. Erstelle Docker Init Script
show_progress "Creating Docker initialization script..."
cat > dist/scripts/init-docker.sh << 'EOF'
#!/bin/bash
# Docker Initialization Script für Mac App

echo "🐳 Initializing Docker containers..."

# Warte auf Docker
while ! docker info >/dev/null 2>&1; do
    echo "Waiting for Docker to start..."
    sleep 2
done

# Starte Container
cd "$(dirname "$0")/../.."
docker-compose -f docker-compose.app.yml up -d

# Warte auf Datenbank
echo "⏳ Waiting for database..."
until docker exec wad_app_db mariadb -u root -prootpassword123 -e "SELECT 1" >/dev/null 2>&1; do
    sleep 2
done

# Erstelle fehlende Tabellen
echo "📊 Creating missing tables..."
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

# Initialisiere Guacamole Datenbank
echo "🖥️ Initializing Guacamole database..."
docker exec wad_app_guacamole_db psql -U guacamole_user -d guacamole_db -c "SELECT 1" >/dev/null 2>&1 || true

echo "✅ Docker initialization complete!"
EOF

chmod +x dist/scripts/init-docker.sh

# 9. Erstelle Admin User Creation Script
show_progress "Creating admin user creation script..."
cat > dist/scripts/create-admin-user.js << 'EOF'
const mariadb = require('mariadb');
const bcrypt = require('bcryptjs');

async function createAdminUser() {
  const pool = mariadb.createPool({
    host: 'localhost',
    port: 3307,
    user: 'dashboard_user',
    password: 'dashboard_pass123',
    database: 'appliance_dashboard',
    connectionLimit: 5
  });

  let connection;
  try {
    connection = await pool.getConnection();
    
    // Prüfe ob bereits Benutzer existieren
    const existingUsers = await connection.query('SELECT COUNT(*) as count FROM users');
    
    if (existingUsers[0].count > 0) {
      console.log('✅ Es existieren bereits Benutzer in der Datenbank.');
      return;
    }
    
    // Erstelle Admin-Benutzer
    const password = 'admin123';
    const passwordHash = await bcrypt.hash(password, 10);
    
    await connection.query(
      'INSERT INTO users (username, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)',
      ['admin', 'admin@localhost', passwordHash, 'Administrator', true]
    );
    
    console.log('✅ Admin-Benutzer wurde erfolgreich erstellt!');
    console.log('   Benutzername: admin');
    console.log('   Passwort: admin123');
    console.log('   ⚠️  Bitte ändern Sie das Passwort nach dem ersten Login!');
    
  } catch (error) {
    console.error('❌ Fehler beim Erstellen des Admin-Benutzers:', error.message);
  } finally {
    if (connection) await connection.release();
    await pool.end();
  }
}

// Warte 10 Sekunden bevor wir versuchen zu verbinden (für Container-Start)
setTimeout(() => {
  createAdminUser();
}, 10000);
EOF

# 10. Baue die macOS App
show_progress "Building macOS Application..."
npm run dist

# 11. Post-Build Aufgaben
show_progress "Post-build tasks..."

# Kopiere wichtige Skripte
cp setup-mac-app.sh dist/scripts/ 2>/dev/null || true
cp health-check.sh dist/scripts/ 2>/dev/null || true

echo ""
echo "✅ Build erfolgreich abgeschlossen!"
echo "================================================"
echo ""
echo "📱 Die App finden Sie unter: dist/"
echo ""
echo "📋 Build-Details:"
echo "- Frontend wurde neu gebaut"
echo "- Docker Images wurden erstellt"
echo "- Container-Präfix: wad_app_*"
echo "- Ports: Frontend 9081, API 3002, Terminal 7682, DB 3307, Guacamole 9871"
echo ""
echo "🖥️ Remote Desktop (Guacamole) Integration:"
echo "- Guacamole läuft auf Port 9871"
echo "- VNC und RDP Support aktiviert"
echo "- Native Electron-Fenster für Remote Desktop"
echo ""
echo "🚀 Installation & Start:"
echo "1. Öffnen Sie dist/Web Appliance Dashboard.app"
echo "2. Docker Desktop muss installiert und gestartet sein"
echo "3. Beim ersten Start werden die Container automatisch initialisiert"
echo ""
echo "👤 Login-Daten:"
echo "- Benutzername: admin"
echo "- Passwort: admin123"
echo "- ⚠️  Bitte ändern Sie das Passwort nach dem ersten Login!"
echo ""
echo "🔧 Troubleshooting:"
echo "- Logs anzeigen: docker logs wad_app_backend"
echo "- Health Check: ./dist/scripts/health-check.sh"
echo "- Neustart: docker-compose -f docker-compose.app.yml restart"
