# Remote Desktop Setup Guide

## Version 1.1.1

This document describes the setup and configuration of Remote Desktop functionality via Apache Guacamole in the Web Appliance Dashboard.

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [Protocols](#protocols)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Performance Optimization](#performance-optimization)

## 🎯 Overview

Apache Guacamole is a clientless remote desktop gateway that enables VNC, RDP, and SSH connections through a web browser. In version 1.1.1, Guacamole has been fully integrated into the Web Appliance Dashboard.

### Main Features

- **Protocol Support**: VNC, RDP, SSH
- **Browser-based**: No client software required
- **Token Authentication**: Secure, temporary access
- **Multi-User**: Simultaneous connections possible
- **Encryption**: End-to-end encrypted connections

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web Browser   │────▶│    Guacamole    │────▶│     guacd       │
│                 │     │   (Web Client)  │     │  (Proxy Daemon) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                          │
                        ┌─────────────────────────────────┼─────────────┐
                        │                                 │             │
                  ┌─────▼─────┐                   ┌──────▼────┐ ┌──────▼────┐
                  │    VNC     │                   │    RDP    │ │    SSH    │
                  │  Servers   │                   │   Hosts   │ │   Hosts   │
                  └───────────┘                   └───────────┘ └───────────┘
```

### Container Structure

- **guacamole**: Web frontend (Tomcat-based)
- **guacd**: Proxy daemon for protocol translation
- **guacamole-postgres**: Configuration database

## 📦 Installation

### 1. Standard Installation (with build script)

```bash
# Complete installation with Remote Desktop
./scripts/build.sh --nocache
```

### 2. Add to Existing Installation

```bash
# Add Remote Desktop to existing installation
./scripts/update-remote-desktop.sh
```

### 3. Manual Installation

```bash
# Start Docker services
docker compose up -d guacamole-postgres guacd guacamole

# Initialize database
docker exec -i guacamole-postgres psql -U guacamole_user guacamole_db < guacamole/initdb.sql

# Reload Nginx configuration
docker exec appliance_nginx nginx -s reload
```

## ⚙️ Configuration

### Environment Variables

#### Backend (.env)

```env
# Guacamole Database
GUACAMOLE_DB_NAME=guacamole_db
GUACAMOLE_DB_USER=guacamole_user
GUACAMOLE_DB_PASSWORD=your_secure_password
GUACAMOLE_DB_HOST=guacamole-postgres
GUACAMOLE_DB_PORT=5432

# Guacamole Settings
GUACAMOLE_HOME=/etc/guacamole
POSTGRES_INITDB_ARGS=--auth=scram-sha-256
```

#### Docker Compose Configuration