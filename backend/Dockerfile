# Web Appliance Dashboard - Backend
# Node.js with SSH Tools for remote management

FROM node:18-alpine

# Setze Arbeitsverzeichnis
WORKDIR /app

# Installiere System-Dependencies inkl. SSH-Tools und Build-Tools für node-pty
# Diese Reihenfolge ist optimiert für Docker Layer Caching
RUN apk update && \
    apk add --no-cache \
    openssh-client \
    sshpass \
    openssl \
    mysql-client \
    bash \
    curl \
    python3 \
    make \
    g++ \
    util-linux \
    && rm -rf /var/cache/apk/*

# Erstelle SSH-Verzeichnis mit korrekten Berechtigungen
RUN mkdir -p /root/.ssh && \
    chmod 700 /root/.ssh && \
    touch /root/.ssh/config && \
    chmod 600 /root/.ssh/config

# Erstelle SSH-Config mit sicheren Defaults
RUN echo "Host *" > /root/.ssh/config && \
    echo "    StrictHostKeyChecking no" >> /root/.ssh/config && \
    echo "    UserKnownHostsFile /dev/null" >> /root/.ssh/config && \
    echo "    LogLevel QUIET" >> /root/.ssh/config && \
    echo "    ConnectTimeout 10" >> /root/.ssh/config && \
    echo "    ServerAliveInterval 30" >> /root/.ssh/config && \
    echo "    ServerAliveCountMax 3" >> /root/.ssh/config

# Kopiere package.json (package-lock.json wird generiert falls nicht vorhanden)
COPY package.json ./

# Installiere Node.js Dependencies
# Verwende npm install statt npm ci, da package-lock.json möglicherweise fehlt
RUN npm install --only=production && \
    npm cache clean --force

# Rebuild native dependencies for the container architecture
RUN npm rebuild
RUN npm rebuild node-pty

# Kopiere Anwendungs-Code
COPY . .

# Stelle sicher, dass Scripts ausführbar sind
RUN chmod +x post-restore-hook.sh regenerate-ssh-config.js 2>/dev/null || true

# Erstelle Upload-Verzeichnisse
RUN mkdir -p uploads/backgrounds && \
    chmod 755 uploads uploads/backgrounds

# Informationen über SSH-Tools loggen (für Debugging)
RUN echo "=== SSH Tools Installation Check ===" && \
    which ssh && ssh -V || echo "SSH check completed" && \
    which ssh-copy-id && echo "ssh-copy-id available" || echo "ssh-copy-id check completed" && \
    which sshpass && sshpass -V || echo "sshpass check completed" && \
    echo "=== SSH Tools Check Complete ==="

# Exponiere Backend-Port
EXPOSE 3001

# Health Check für Container-Status
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3001/api/health || exit 1

# Starte die Anwendung
# SSH Auto-Initialization wird von der App selbst behandelt
CMD ["node", "server.js"]

# Docker Labels für bessere Organisation
LABEL maintainer="Web Appliance Dashboard"
LABEL version="2.2.0"
LABEL description="Backend API with SSH management capabilities"
LABEL ssh-tools="openssh-client,sshpass"
