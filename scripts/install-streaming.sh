#!/bin/bash

# Sunshine/Moonlight Streaming Setup Script for Web Appliance Dashboard
# This script handles the installation and configuration of streaming components

set -e

echo "🎮 Web Appliance Dashboard - Streaming Setup"
echo "==========================================="

# Detect OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    OS="windows"
else
    echo "❌ Unsupported OS: $OSTYPE"
    exit 1
fi

echo "📦 Detected OS: $OS"

# Function to install Sunshine
install_sunshine() {
    echo "📥 Installing Sunshine..."
    
    case $OS in
        linux)
            # Add Sunshine repository
            wget -qO - https://packagecloud.io/LizardByte/stable/gpgkey | sudo apt-key add -
            echo "deb https://packagecloud.io/LizardByte/stable/ubuntu/ $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/sunshine.list
            
            # Update and install
            sudo apt update
            sudo apt install -y sunshine
            
            # Install additional dependencies
            sudo apt install -y \
                libavdevice-dev \
                libboost-thread-dev \
                libboost-filesystem-dev \
                libboost-log-dev \
                libpulse-dev \
                libopus-dev \
                libevdev-dev
            ;;
            
        macos)
            # Install via Homebrew
            if ! command -v brew &> /dev/null; then
                echo "❌ Homebrew not found. Please install Homebrew first."
                exit 1
            fi
            
            brew install --cask sunshine
            ;;
            
        windows)
            echo "📥 Downloading Sunshine for Windows..."
            curl -L -o sunshine-installer.exe https://github.com/LizardByte/Sunshine/releases/latest/download/sunshine-windows-installer.exe
            echo "Please run sunshine-installer.exe to complete installation"
            ;;
    esac
    
    echo "✅ Sunshine installation completed"
}

# Function to configure Sunshine for integration
configure_sunshine() {
    echo "⚙️  Configuring Sunshine..."
    
    # Create config directory
    SUNSHINE_CONFIG_DIR="$HOME/.config/sunshine"
    mkdir -p "$SUNSHINE_CONFIG_DIR"
    
    # Generate basic configuration
    cat > "$SUNSHINE_CONFIG_DIR/sunshine.conf" << EOF
# Sunshine Configuration for Web Appliance Dashboard
# Auto-generated configuration

# Network
port = 47989
https_port = 47990
pkey = $SUNSHINE_CONFIG_DIR/credentials/cacert.pem
cert = $SUNSHINE_CONFIG_DIR/credentials/cakey.pem
origin_pin = 0000
upnp = off
ping_timeout = 10000

# Video
encoder = auto
hw_device = auto
codec = auto
preset = 1
tune = 0
rate_control = 1
bitrate = 20000
maxrate = 30000
vbv_size = 1000
qp = 0
min_threads = 2

# Audio  
audio_sink = auto
audio_codec = opus
audio_bitrate = 128

# Input
gamepad = auto
mouse = auto
keyboard = auto

# Display
output_name = 0
adapter_name = auto
resolution = 1920x1080
fps = 60

# Apps config
apps_config_file = $SUNSHINE_CONFIG_DIR/apps.json

# Logging
log_level = 2
log_path = $SUNSHINE_CONFIG_DIR/sunshine.log
EOF

    # Create apps configuration
    cat > "$SUNSHINE_CONFIG_DIR/apps.json" << EOF
{
  "env": {
    "PATH": "$(PATH)"
  },
  "apps": [
    {
      "name": "Desktop",
      "image": null,
      "cmd": null,
      "prep-cmd": [],
      "detached": []
    }
  ]
}
EOF

    echo "✅ Sunshine configuration completed"
}

# Function to setup systemd service (Linux)
setup_systemd_service() {
    if [[ "$OS" == "linux" ]]; then
        echo "🔧 Setting up systemd service..."
        
        cat > /tmp/sunshine.service << EOF
[Unit]
Description=Sunshine Game Stream Server
After=network.target

[Service]
Type=simple
User=$USER
ExecStart=/usr/bin/sunshine
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

        sudo mv /tmp/sunshine.service /etc/systemd/system/
        sudo systemctl daemon-reload
        sudo systemctl enable sunshine
        echo "✅ Systemd service configured"
    fi
}

# Function to install Moonlight web client dependencies
install_moonlight_web() {
    echo "📥 Installing Moonlight web client dependencies..."
    
    cd ../frontend
    
    # Install WebRTC adapter
    npm install --save webrtc-adapter
    
    # Install gamepad API polyfill
    npm install --save gamepad
    
    # Install video decoder libraries
    npm install --save \
        h264-video-decoder \
        @peculiar/webcrypto
    
    echo "✅ Moonlight web dependencies installed"
}

# Function to update backend
update_backend() {
    echo "📝 Updating backend configuration..."
    
    cd ../backend
    
    # Add streaming route to server.js
    if ! grep -q "streaming" server.js; then
        sed -i "/const auditRoutes/a const streamingRoutes = require('./routes/streaming');" server.js
        sed -i "/app.use('\/api\/audit'/a app.use('/api/streaming', streamingRoutes);" server.js
    fi
    
    # Install additional dependencies
    npm install --save node-pty ws express-ws
    
    echo "✅ Backend updated"
}

# Function to update nginx configuration
update_nginx() {
    echo "🔧 Updating nginx configuration..."
    
    cat > ../nginx/conf.d/streaming.conf << 'EOF'
# Streaming configuration
location /api/streaming/ {
    proxy_pass http://backend:3001/api/streaming/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # WebSocket specific
    proxy_read_timeout 86400;
}

# Moonlight WebRTC signaling
location /moonlight-ws/ {
    proxy_pass http://backend:47984/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400;
}
EOF

    echo "✅ Nginx configuration updated"
}

# Main installation flow
main() {
    echo "🚀 Starting installation..."
    
    # Check if running from correct directory
    if [[ ! -f "../package.json" ]]; then
        echo "❌ Please run this script from the scripts directory"
        exit 1
    fi
    
    # Install Sunshine
    install_sunshine
    
    # Configure Sunshine
    configure_sunshine
    
    # Setup systemd service (Linux only)
    setup_systemd_service
    
    # Install Moonlight web dependencies
    install_moonlight_web
    
    # Update backend
    update_backend
    
    # Update nginx
    update_nginx
    
    echo ""
    echo "✅ Installation completed!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Restart the application: docker-compose down && docker-compose up -d"
    echo "2. Access the dashboard and navigate to an appliance"
    echo "3. Click on the 'Stream' button to start game streaming"
    echo "4. First time: You'll need to pair your device using the PIN shown"
    echo ""
    echo "🔑 Default PIN: 0000 (change in Sunshine settings)"
    echo "🌐 Sunshine Web UI: https://localhost:47990"
}

# Run main installation
main
