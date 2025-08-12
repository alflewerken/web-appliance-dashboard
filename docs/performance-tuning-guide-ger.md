# Leitfaden zur Leistungsoptimierung

## Web Appliance Dashboard v1.1.1

Dieser Leitfaden bietet detaillierte Anleitungen zur Leistungsoptimierung des Web Appliance Dashboards für verschiedene Einsatzszenarien.

## 📋 Inhaltsverzeichnis

- [Übersicht](#übersicht)
- [System-Anforderungen](#system-anforderungen)
- [Docker Optimierung](#docker-optimierung)
- [Datenbank Tuning](#datenbank-tuning)
- [Backend Optimierung](#backend-optimierung)
- [Frontend Optimierung](#frontend-optimierung)
- [Nginx Konfiguration](#nginx-konfiguration)
- [Caching Strategien](#caching-strategien)
- [Monitoring & Metriken](#monitoring--metriken)
- [Skalierung](#skalierung)

## 🎯 Übersicht

Die Leistung des Web Appliance Dashboards hängt von verschiedenen Faktoren ab:

- **Hardware-Ressourcen**: CPU, RAM, Disk I/O
- **Netzwerk-Latenz**: Besonders wichtig für Remote Desktop
- **Anzahl der Benutzer**: Concurrent Sessions
- **Anzahl der Appliances**: Datenbankgröße
- **Update-Frequenz**: Health Checks und Status Updates

## 💻 System-Anforderungen

### Minimal (bis 10 User, 50 Appliances)
- **CPU**: 2 Cores
- **RAM**: 2 GB
- **Disk**: 10 GB SSD
- **Netzwerk**: 100 Mbps

### Empfohlen (bis 50 User, 500 Appliances)
- **CPU**: 4 Cores
- **RAM**: 8 GB
- **Disk**: 50 GB SSD
- **Netzwerk**: 1 Gbps

### Enterprise (100+ User, 1000+ Appliances)
- **CPU**: 8+ Cores
- **RAM**: 16+ GB
- **Disk**: 100+ GB NVMe SSD
- **Netzwerk**: 10 Gbps

## 🐳 Docker Optimierung

### 1. Resource Limits

Erstellen Sie eine `docker-compose.override.yml`:

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

### 2. Docker Daemon Optimierung

`/etc/docker/daemon.json`:

```json
{
  "storage-driver": "overlay2",
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 64000,
      "Soft": 64000
    }
  },
  "live-restore": true,
  "userland-proxy": false
}
```

### 3. Kernel Parameter

```bash
# /etc/sysctl.conf
vm.swappiness = 10
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15
net.core.netdev_max_backlog = 65535
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_probes = 5
net.ipv4.tcp_keepalive_intvl = 15

# Anwenden
sysctl -p
```

## 🗄️ Datenbank Tuning

### MariaDB Optimierung

Erstellen Sie `/my-data/mariadb/custom.cnf`:

```ini
[mysqld]
# Connection Settings
max_connections = 200
max_allowed_packet = 64M
thread_cache_size = 50
open_files_limit = 65535

# InnoDB Settings
innodb_buffer_pool_size = 1G  # 50-70% des verfügbaren RAM
innodb_buffer_pool_instances = 4
innodb_log_file_size = 256M
innodb_log_buffer_size = 32M
innodb_flush_log_at_trx_commit = 2
innodb_flush_method = O_DIRECT
innodb_file_per_table = 1
innodb_io_capacity = 2000
innodb_io_capacity_max = 4000
innodb_read_io_threads = 4
innodb_write_io_threads = 4

# Query Cache (für Read-Heavy Workloads)
query_cache_type = 1
query_cache_size = 128M
query_cache_limit = 2M

# Temp Tables
tmp_table_size = 64M
max_heap_table_size = 64M

# Logging
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 2

# Other
sort_buffer_size = 4M
read_buffer_size = 4M
join_buffer_size = 8M
```

### PostgreSQL Optimierung (Guacamole)

`/my-data/postgres/postgresql.conf`:

```ini
# Memory
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB

# Checkpoints
checkpoint_completion_target = 0.9
wal_buffers = 16MB
max_wal_size = 1GB
min_wal_size = 80MB

# Connections
max_connections = 100

# Logging
log_min_duration_statement = 1000  # Log queries > 1s
```

### Index-Optimierung

```sql
-- Performance Indizes für häufige Queries
CREATE INDEX idx_appliances_user_category ON appliances(user_id, category_id);
CREATE INDEX idx_service_status_appliance_created ON service_status(appliance_id, created_at DESC);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_user_created ON audit_logs(user_id, created_at DESC);

-- Analyse und Optimierung
ANALYZE TABLE appliances;
ANALYZE TABLE service_status;
ANALYZE TABLE audit_logs;
```

## 🚀 Backend Optimierung

### 1. Node.js Konfiguration

```javascript
// server.js Optimierungen
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster && process.env.NODE_ENV === 'production') {
  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork();
  });
} else {
  // Worker process
  startServer();
}
```

### 2. Connection Pooling

```javascript
// Database Connection Pool
const pool = mysql.createPool({
  connectionLimit: 50,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Redis für Session Management (optional)
const redis = require('redis');
const RedisStore = require('connect-redis')(session);
const redisClient = redis.createClient({
  host: 'redis',
  port: 6379,
  password: process.env.REDIS_PASSWORD
});

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));
```

### 3. API Response Caching

```javascript
// Cache Middleware
const mcache = require('memory-cache');

const cache = (duration) => {
  return (req, res, next) => {
    const key = '__express__' + req.originalUrl || req.url;
    const cachedBody = mcache.get(key);
    
    if (cachedBody) {
      res.send(cachedBody);
      return;
    }
    
    res.sendResponse = res.send;
    res.send = (body) => {
      mcache.put(key, body, duration * 1000);
      res.sendResponse(body);
    };
    next();
  };
};

// Verwendung
app.get('/api/appliances', authenticate, cache(10), getAppliances);
app.get('/api/categories', authenticate, cache(300), getCategories);
```

### 4. Async/Await Optimierung

```javascript
// Parallele Datenabfragen
async function getDashboardData(userId) {
  const [appliances, recentLogs, systemStatus] = await Promise.all([
    getAppliances(userId),
    getRecentAuditLogs(userId, 10),
    getSystemStatus()
  ]);
  
  return {
    appliances,
    recentLogs,
    systemStatus
  };
}
```

## ⚛️ Frontend Optimierung

### 1. React Performance

```javascript
// Lazy Loading von Komponenten
const ServicePanel = React.lazy(() => import('./components/ServicePanel'));
const Settings = React.lazy(() => import('./components/Settings'));
const AuditLog = React.lazy(() => import('./components/AuditLog'));

// Memoization
const ApplianceCard = React.memo(({ appliance, onUpdate }) => {
  // Component code
}, (prevProps, nextProps) => {
  return prevProps.appliance.id === nextProps.appliance.id &&
         prevProps.appliance.status === nextProps.appliance.status;
});

// Virtual Scrolling für große Listen
import { FixedSizeList } from 'react-window';

const ApplianceList = ({ appliances }) => (
  <FixedSizeList
    height={600}
    itemCount={appliances.length}
    itemSize={120}
    width="100%"
  >
    {({ index, style }) => (
      <div style={style}>
        <ApplianceCard appliance={appliances[index]} />
      </div>
    )}
  </FixedSizeList>
);
```

### 2. Build Optimierung

```json
// package.json
{
  "scripts": {
    "build": "GENERATE_SOURCEMAP=false react-scripts build",
    "build:analyze": "source-map-explorer 'build/static/js/*.js'"
  }
}
```

```javascript
// webpack.config.js (wenn ejected)
module.exports = {
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10
        },
        common: {
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true
        }
      }
    },
    runtimeChunk: 'single',
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: true,
          },
        },
      }),
    ],
  }
};
```

### 3. Asset Optimierung

```bash
# Bilder optimieren
find ./public -name "*.png" -exec pngquant --quality=65-80 {} \;
find ./public -name "*.jpg" -exec jpegoptim -m80 {} \;

# WebP Konvertierung
for file in ./public/images/*.{jpg,png}; do
  cwebp -q 80 "$file" -o "${file%.*}.webp"
done
```

## 🔧 Nginx Konfiguration

### Optimierte nginx.conf

```nginx
worker_processes auto;
worker_rlimit_nofile 65535;

events {
    worker_connections 4096;
    use epoll;
    multi_accept on;
}

http {
    # Basic Settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 100M;
    
    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript 
               application/json application/javascript application/xml+rss 
               application/rss+xml application/atom+xml image/svg+xml;
    
    # Brotli Compression (wenn verfügbar)
    brotli on;
    brotli_comp_level 6;
    brotli_types text/plain text/css text/xml text/javascript 
                 application/json application/javascript application/xml+rss;
    
    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Cache Settings
    open_file_cache max=2000 inactive=20s;
    open_file_cache_valid 30s;
    open_file_cache_min_uses 2;
    open_file_cache_errors on;
    
    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;
    
    server {
        listen 80;
        server_name _;
        
        # Static Files Caching
        location ~* \.(jpg|jpeg|png|gif|ico|css|js|webp|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            access_log off;
        }
        
        # API Rate Limiting
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://backend:3001;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            
            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }
        
        # Auth Rate Limiting
        location /api/auth/ {
            limit_req zone=auth burst=5 nodelay;
            proxy_pass http://backend:3001;
            # ... rest of proxy settings
        }
    }
}
```

## 💾 Caching Strategien

### 1. Browser Caching

```javascript
// Service Worker für Offline-Funktionalität
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('v1').then((cache) => {
      return cache.addAll([
        '/',
        '/static/css/main.css',
        '/static/js/main.js',
        '/manifest.json'
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
```

### 2. Redis Caching (Optional)

```yaml
# docker-compose.override.yml
services:
  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    networks:
      - appliance_network
```

```javascript
// Backend Redis Integration
const redis = require('redis');
const { promisify } = require('util');

const client = redis.createClient({ host: 'redis' });
const getAsync = promisify(client.get).bind(client);
const setAsync = promisify(client.setex).bind(client);

// Cache Helper
async function getCachedData(key, fetchFunction, ttl = 300) {
  const cached = await getAsync(key);
  if (cached) {
    return JSON.parse(cached);
  }
  
  const data = await fetchFunction();
  await setAsync(key, ttl, JSON.stringify(data));
  return data;
}

// Verwendung
app.get('/api/dashboard-stats', async (req, res) => {
  const stats = await getCachedData(
    `dashboard-stats-${req.user.id}`,
    () => getDashboardStats(req.user.id),
    60 // 1 Minute TTL
  );
  res.json(stats);
});
```

### 3. CDN Integration

```nginx
# CloudFlare oder anderes CDN
location /static/ {
    proxy_pass http://cdn.example.com/;
    proxy_cache_valid 200 365d;
    expires 365d;
    add_header Pragma public;
    add_header Cache-Control "public";
}
```

## 📊 Monitoring & Metriken

### 1. Performance Monitoring Setup

```yaml
# docker-compose.monitoring.yml
version: '3.8'
services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    networks:
      - appliance_network
      
  grafana:
    image: grafana/grafana:latest
    volumes:
      - grafana_data:/var/lib/grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    networks:
      - appliance_network
      
  node-exporter:
    image: prom/node-exporter:latest
    ports:
      - "9100:9100"
    networks:
      - appliance_network
```

### 2. Application Metrics

```javascript
// Backend Metrics mit prom-client
const prometheus = require('prom-client');
const register = new prometheus.Registry();

// Metriken definieren
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const activeConnections = new prometheus.Gauge({
  name: 'websocket_active_connections',
  help: 'Number of active WebSocket connections'
});

register.registerMetric(httpRequestDuration);
register.registerMetric(activeConnections);

// Middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path || 'unknown', res.statusCode)
      .observe(duration);
  });
  next();
});

// Metrics Endpoint
app.get('/metrics', (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(register.metrics());
});
```

### 3. Log Aggregation

```yaml
# ELK Stack für Log-Analyse
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    volumes:
      - es_data:/usr/share/elasticsearch/data
      
  kibana:
    image: docker.elastic.co/kibana/kibana:8.11.0
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
```

## 🔄 Skalierung

### Horizontal Scaling mit Docker Swarm

```bash
# Swarm initialisieren
docker swarm init

# Service erstellen
docker service create \
  --name appliance_backend \
  --replicas 3 \
  --publish published=3001,target=3001 \
  --env-file .env \
  appliance_backend:latest

# Skalieren
docker service scale appliance_backend=5
```

### Load Balancing

```nginx
# nginx.conf für mehrere Backend-Instanzen
upstream backend_cluster {
    least_conn;
    server backend1:3001 weight=10 max_fails=3 fail_timeout=30s;
    server backend2:3001 weight=10 max_fails=3 fail_timeout=30s;
    server backend3:3001 weight=10 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

server {
    location /api/ {
        proxy_pass http://backend_cluster;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }
}
```

### Database Replication

```yaml
# Master-Slave Replication für MariaDB
services:
  mariadb-master:
    image: mariadb:11
    environment:
      MYSQL_ROOT_PASSWORD: root_password
      MYSQL_REPLICATION_MODE: master
      MYSQL_REPLICATION_USER: repl_user
      MYSQL_REPLICATION_PASSWORD: repl_password
    command: --log-bin --server-id=1
    
  mariadb-slave:
    image: mariadb:11
    environment:
      MYSQL_ROOT_PASSWORD: root_password
      MYSQL_REPLICATION_MODE: slave
      MYSQL_MASTER_HOST: mariadb-master
      MYSQL_MASTER_USER: repl_user
      MYSQL_MASTER_PASSWORD: repl_password
    command: --server-id=2
```

## 🎯 Performance Checkliste

### ✅ Quick Wins
- [ ] Gzip/Brotli Kompression aktivieren
- [ ] Browser Caching für statische Assets
- [ ] Datenbank-Indizes erstellen
- [ ] Unnötige Logs deaktivieren
- [ ] Docker Resource Limits setzen

### ✅ Mittelfristig
- [ ] Redis für Session/Cache Management
- [ ] CDN für statische Assets
- [ ] Monitoring mit Prometheus/Grafana
- [ ] Load Testing mit k6/JMeter
- [ ] Query Optimierung

### ✅ Langfristig
- [ ] Horizontal Scaling
- [ ] Database Sharding
- [ ] Microservices Architektur
- [ ] Kubernetes Deployment
- [ ] Auto-Scaling

## 📈 Performance Benchmarks

### Load Testing mit k6

```javascript
// performance-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp-up
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 0 },   // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.1'],    // Error rate under 10%
  },
};

export default function () {
  const params = {
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN',
      'Content-Type': 'application/json',
    },
  };

  // Test API endpoints
  let responses = http.batch([
    ['GET', 'http://localhost:9080/api/appliances', null, params],
    ['GET', 'http://localhost:9080/api/categories', null, params],
    ['GET', 'http://localhost:9080/api/audit-logs?limit=10', null, params],
  ]);

  // Prüfen responses
  responses.forEach(response => {
    check(response, {
      'status is 200': (r) => r.status === 200,
      'response time < 500ms': (r) => r.timings.duration < 500,
    });
  });

  sleep(1);
}
```

### Erwartete Performance-Werte

| Metrik | Minimal Setup | Empfohlen | Enterprise |
|--------|---------------|-----------|------------|
| API Response Time (p95) | <500ms | <200ms | <100ms |
| Concurrent Users | 10 | 50 | 200+ |
| Requests/Second | 100 | 500 | 2000+ |
| Database Queries/Sec | 50 | 250 | 1000+ |
| Memory Usage | <500MB | <2GB | <8GB |
| CPU Usage (Avg) | <40% | <30% | <25% |

---

**Version:** 1.1.0 | **Letzte Aktualisierung:** 24. Juli 2025