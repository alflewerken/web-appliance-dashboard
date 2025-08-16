# Web Appliance Dashboard - Backend
# Node.js with SSH Tools for remote management

FROM node:24-alpine

# Setze Arbeitsverzeichnis
WORKDIR /app

# Installiere System-Dependencies inkl. SSH-Tools und Docker CLI
# Fix für ARM64 Build-Probleme auf GitHub Actions
USER root
RUN set -ex && \
    apk add --no-cache \
    openssh-client \
    sshpass \
    openssl \
    mysql-client \
    bash \
    curl \
    rsync \
    docker-cli || \
    (rm -rf /var/cache/apk/* && \
     apk add --no-cache \
     openssh-client \
     sshpass \
     openssl \
     mysql-client \
     bash \
     curl \
     rsync \
     docker-cli)

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

# Kopiere package.json zuerst für besseres Caching
COPY package*.json ./

# Installiere Node.js Dependencies (ohne node-pty)
RUN npm install --only=production --omit=dev && \
    npm cache clean --force

# Kopiere Anwendungs-Code
COPY . .

# Stelle sicher, dass Scripts ausführbar sind
RUN chmod +x post-restore-hook.sh regenerate-ssh-config.js 2>/dev/null || true

# Erstelle Upload-Verzeichnisse
RUN mkdir -p uploads/backgrounds && \
    chmod 755 uploads uploads/backgrounds

# Exponiere Backend-Port
EXPOSE 3001

# Health Check für Container-Status
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3001/api/health || exit 1

# Starte die Anwendung
CMD ["node", "server.js"]

# Docker Labels für bessere Organisation
LABEL maintainer="Web Appliance Dashboard"
LABEL version="2.2.0"
LABEL description="Backend API with SSH management capabilities"
LABEL ssh-tools="openssh-client,sshpass"
