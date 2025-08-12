# Nginx Configuration for Web Appliance Dashboard

## Overview

This directory contains the nginx configuration for the Web Appliance Dashboard Docker container.

## Structure

### Main Configuration
- `nginx.conf` - Main nginx configuration file
- `Dockerfile` - Docker build configuration for nginx container

### Configuration Directory (conf.d/)
- `00-real-ip-map.conf` - Real IP mapping configuration
- `appliance-proxy.conf` - Appliance proxy configuration
- `default.conf` - Default server configuration
- `guacamole-performance.conf` - Guacamole performance optimizations
- `guacamole-websocket.conf` - Guacamole WebSocket configuration
- `rustdesk.conf` - RustDesk integration configuration

### Static Resources
- Various favicon files (*.png, *.ico, *.svg) - Application icons
- `manifest.json` - PWA manifest
- `terminal-manifest.json` - Terminal PWA manifest

### Directories
- `conf.d/` - Additional nginx configurations
- `js/` - JavaScript files
- `lua/` - Lua scripts for JWT validation
- `ssl/` - SSL certificates (if configured)
- `static/` - Static resources

### Service Worker & Scripts
- `terminal-sw.js` - Terminal service worker
- `theme-handler.js` - Theme handling script
- `sw-remote-desktop.js` - Remote desktop service worker
- `terminal-error-suppressor.js` - Terminal error suppression

### HTML Files
- `index.html` - Main index page
- `remote-desktop.html` - Remote desktop interface
- `remote-desktop-redirect.html` - Remote desktop redirect
- `service-panel.html` - Service panel
- `terminal-window.html` - Terminal window interface

## Docker Usage

The nginx container is built and configured through Docker Compose. The configuration serves:
- Frontend application on port 8070
- API proxy to backend services
- WebSocket connections for terminal and remote desktop
- Static file serving

## Port Configuration

Default port: **8070** (configurable via WEBSERVER_PORT in .env)

## Health Check

The container includes a health check endpoint at `/health`
