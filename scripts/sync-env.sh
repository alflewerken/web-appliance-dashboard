#!/bin/bash

# Script to sync environment variables across all .env files
# This ensures consistency between main .env, backend/.env, and frontend/.env

set -e

echo "🔄 Syncing environment variables..."
echo "=================================="

# Function to extract value from .env file
get_env_value() {
    local file=$1
    local key=$2
    if [ -f "$file" ]; then
        grep "^$key=" "$file" | cut -d= -f2- || echo ""
    else
        echo ""
    fi
}

# Function to update value in .env file
update_env_value() {
    local file=$1
    local key=$2
    local value=$3
    
    if [ -f "$file" ]; then
        if grep -q "^$key=" "$file"; then
            # Key exists, update it
            # Use sed with different delimiter to handle special characters
            sed -i.bak "s|^$key=.*|$key=$value|" "$file"
        else
            # Key doesn't exist, append it
            echo "$key=$value" >> "$file"
        fi
        # Remove backup file
        rm -f "$file.bak"
    fi
}

# Check if main .env exists
if [ ! -f ".env" ]; then
    echo "❌ Main .env file not found!"
    echo "Please run ./scripts/setup-env.sh first"
    exit 1
fi

# Extract values from main .env
echo "📖 Reading values from main .env..."
DB_HOST=$(get_env_value ".env" "DB_HOST")
DB_PORT=$(get_env_value ".env" "DB_PORT")
DB_USER=$(get_env_value ".env" "DB_USER")
DB_PASSWORD=$(get_env_value ".env" "DB_PASSWORD")
DB_NAME=$(get_env_value ".env" "DB_NAME")
MYSQL_ROOT_PASSWORD=$(get_env_value ".env" "MYSQL_ROOT_PASSWORD")
MYSQL_DATABASE=$(get_env_value ".env" "MYSQL_DATABASE")
MYSQL_USER=$(get_env_value ".env" "MYSQL_USER")
MYSQL_PASSWORD=$(get_env_value ".env" "MYSQL_PASSWORD")
JWT_SECRET=$(get_env_value ".env" "JWT_SECRET")
SSH_KEY_ENCRYPTION_SECRET=$(get_env_value ".env" "SSH_KEY_ENCRYPTION_SECRET")
DEFAULT_SSH_USER=$(get_env_value ".env" "DEFAULT_SSH_USER")
DEFAULT_SSH_PASS=$(get_env_value ".env" "DEFAULT_SSH_PASS")
NODE_ENV=$(get_env_value ".env" "NODE_ENV")
ALLOWED_ORIGINS=$(get_env_value ".env" "ALLOWED_ORIGINS")
EXTERNAL_URL=$(get_env_value ".env" "EXTERNAL_URL")

# Sync backend/.env
if [ -f "backend/.env" ]; then
    echo "🔄 Syncing backend/.env..."
    
    # Database settings
    update_env_value "backend/.env" "DB_HOST" "${DB_HOST:-database}"
    update_env_value "backend/.env" "DB_PORT" "${DB_PORT:-3306}"
    update_env_value "backend/.env" "DB_USER" "${DB_USER:-dashboard_user}"
    update_env_value "backend/.env" "DB_PASSWORD" "${DB_PASSWORD:-$MYSQL_PASSWORD}"
    update_env_value "backend/.env" "DB_NAME" "${DB_NAME:-appliance_dashboard}"
    
    # MySQL settings (for consistency)
    update_env_value "backend/.env" "MYSQL_ROOT_PASSWORD" "$MYSQL_ROOT_PASSWORD"
    update_env_value "backend/.env" "MYSQL_DATABASE" "${MYSQL_DATABASE:-appliance_dashboard}"
    update_env_value "backend/.env" "MYSQL_USER" "${MYSQL_USER:-dashboard_user}"
    update_env_value "backend/.env" "MYSQL_PASSWORD" "$MYSQL_PASSWORD"
    
    # Security settings
    update_env_value "backend/.env" "JWT_SECRET" "$JWT_SECRET"
    update_env_value "backend/.env" "SSH_KEY_ENCRYPTION_SECRET" "$SSH_KEY_ENCRYPTION_SECRET"
    update_env_value "backend/.env" "ENCRYPTION_SECRET" "$SSH_KEY_ENCRYPTION_SECRET"
    
    # SSH settings
    update_env_value "backend/.env" "DEFAULT_SSH_USER" "$DEFAULT_SSH_USER"
    update_env_value "backend/.env" "DEFAULT_SSH_PASS" "$DEFAULT_SSH_PASS"
    
    # Environment
    update_env_value "backend/.env" "NODE_ENV" "${NODE_ENV:-production}"
    
    # CORS
    update_env_value "backend/.env" "ALLOWED_ORIGINS" "$ALLOWED_ORIGINS"
    update_env_value "backend/.env" "CORS_ORIGIN" "$ALLOWED_ORIGINS"
    
    # External URL
    if [ -n "$EXTERNAL_URL" ]; then
        update_env_value "backend/.env" "EXTERNAL_URL" "$EXTERNAL_URL"
    fi
    
    echo "✅ backend/.env synced"
else
    echo "⚠️  backend/.env not found, skipping..."
fi

# Sync frontend/.env
if [ -f "frontend/.env" ]; then
    echo "🔄 Syncing frontend/.env..."
    
    # Environment
    update_env_value "frontend/.env" "NODE_ENV" "${NODE_ENV:-production}"
    
    # API URLs
    if [ -n "$EXTERNAL_URL" ]; then
        # Use external URL
        if [[ "$EXTERNAL_URL" =~ ^https:// ]]; then
            WS_PROTOCOL="wss"
        else
            WS_PROTOCOL="ws"
        fi
        HOST_PART="${EXTERNAL_URL#*://}"
        
        update_env_value "frontend/.env" "REACT_APP_API_URL" "${EXTERNAL_URL}/api"
        update_env_value "frontend/.env" "REACT_APP_WS_URL" "${WS_PROTOCOL}://${HOST_PART}"
        update_env_value "frontend/.env" "REACT_APP_TERMINAL_URL" "${EXTERNAL_URL}/terminal"
        update_env_value "frontend/.env" "REACT_APP_GUACAMOLE_URL" "${EXTERNAL_URL}/guacamole"
        update_env_value "frontend/.env" "REACT_APP_EXTERNAL_URL" "$EXTERNAL_URL"
    else
        # Use localhost
        update_env_value "frontend/.env" "REACT_APP_API_URL" "http://localhost:9080/api"
        update_env_value "frontend/.env" "REACT_APP_WS_URL" "ws://localhost:9080"
        update_env_value "frontend/.env" "REACT_APP_TERMINAL_URL" "http://localhost:9080/terminal"
        update_env_value "frontend/.env" "REACT_APP_GUACAMOLE_URL" "http://localhost:9080/guacamole"
    fi
    
    echo "✅ frontend/.env synced"
else
    echo "⚠️  frontend/.env not found, skipping..."
fi

# Verification
echo ""
echo "🔍 Verifying synchronization..."

# Check if DB passwords match
MAIN_DB_PASS=$(get_env_value ".env" "DB_PASSWORD")
BACKEND_DB_PASS=$(get_env_value "backend/.env" "DB_PASSWORD")

if [ "$MAIN_DB_PASS" = "$BACKEND_DB_PASS" ] || [ "$MYSQL_PASSWORD" = "$BACKEND_DB_PASS" ]; then
    echo "✅ Database passwords are synchronized"
else
    echo "⚠️  WARNING: Database passwords might not be synchronized!"
    echo "   Main .env DB_PASSWORD: $MAIN_DB_PASS"
    echo "   Main .env MYSQL_PASSWORD: $MYSQL_PASSWORD"
    echo "   Backend .env DB_PASSWORD: $BACKEND_DB_PASS"
fi

# Check SSH encryption key
MAIN_SSH_KEY=$(get_env_value ".env" "SSH_KEY_ENCRYPTION_SECRET")
BACKEND_SSH_KEY=$(get_env_value "backend/.env" "SSH_KEY_ENCRYPTION_SECRET")

if [ "$MAIN_SSH_KEY" = "$BACKEND_SSH_KEY" ]; then
    echo "✅ SSH encryption keys are synchronized"
else
    echo "⚠️  WARNING: SSH encryption keys are not synchronized!"
fi

echo ""
echo "✅ Environment synchronization complete!"
echo ""
echo "📌 Next steps:"
echo "1. Verify the values in all .env files"
echo "2. Restart the containers if they're already running:"
echo "   docker compose restart"
echo ""
