# Performance Tuning Guide

## Web Appliance Dashboard v1.1.1

This guide provides detailed instructions for optimizing the performance of the Web Appliance Dashboard for various deployment scenarios.

## 📋 Table of Contents

- [Overview](#overview)
- [System Requirements](#system-requirements)
- [Docker Optimization](#docker-optimization)
- [Database Tuning](#database-tuning)
- [Backend Optimization](#backend-optimization)
- [Frontend Optimization](#frontend-optimization)
- [Nginx Configuration](#nginx-configuration)
- [Caching Strategies](#caching-strategies)
- [Monitoring & Metrics](#monitoring--metrics)
- [Scaling](#scaling)

## 🎯 Overview

The performance of the Web Appliance Dashboard depends on various factors:

- **Hardware Resources**: CPU, RAM, Disk I/O
- **Network Latency**: Especially important for Remote Desktop
- **Number of Users**: Concurrent sessions
- **Number of Appliances**: Database size
- **Update Frequency**: Health checks and status updates

## 💻 System Requirements

### Minimal (up to 10 users, 50 appliances)
- **CPU**: 2 Cores
- **RAM**: 2 GB
- **Disk**: 10 GB SSD
- **Network**: 100 Mbps

### Recommended (up to 50 users, 500 appliances)
- **CPU**: 4 Cores
- **RAM**: 8 GB
- **Disk**: 50 GB SSD
- **Network**: 1 Gbps

### Enterprise (100+ users, 1000+ appliances)
- **CPU**: 8+ Cores
- **RAM**: 16+ GB
- **Disk**: 100+ GB NVMe SSD
- **Network**: 10 Gbps

## 🐳 Docker Optimization

### 1. Resource Limits

Create a `docker-compose.override.yml`:

```yaml
version: '3.8'
services:
  nginx:
    mem_limit: 512m
    mem_reservation: 256m
    cpus: '0.5'
    restart: unless-stopped
    
  backend:
    mem_limit: 2g
    mem_reservation: 1g
    cpus: '2.0'
    restart: unless-stopped
    environment:
      NODE_OPTIONS: '--max-old-space-size=1536'
    
  database:
    mem_limit: 2g
    mem_reservation: 1g
    cpus: '1.5'
    restart: unless-stopped
    command: --max-connections=200 --innodb-buffer-pool-size=1G
    
  ttyd:
    mem_limit: 256m
    mem_reservation: 128m
    cpus: '0.25'
    restart: unless-stopped
    
  guacamole:
    mem_limit: 1g
    mem_reservation: 512m
    cpus: '1.0'
    restart: unless-stopped
    environment:
      JAVA_OPTS: '-Xmx768m -Xms256m -XX:+UseG1GC'
    
  guacd:
    mem_limit: 2g
    mem_reservation: 1g
    cpus: '2.0'
    restart: unless-stopped
```