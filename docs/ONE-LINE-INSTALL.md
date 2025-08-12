# Web Appliance Dashboard - One Line Install

## The Dream: One Command Installation

### Option 1: Direct from GitHub (Simplest)
```bash
curl -sSL https://get.web-appliance.io | bash
```
Or:
```bash
curl -sSL https://raw.githubusercontent.com/alflewerken/web-appliance-dashboard/main/install.sh | bash
```

### Option 2: Using Docker Run with Installer
```bash
docker run --rm -it \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v ${PWD}:/install \
  ghcr.io/alflewerken/web-appliance-dashboard:installer
```

### Option 3: Docker Compose from URL
```bash
curl -sSL https://raw.githubusercontent.com/alflewerken/web-appliance-dashboard/main/docker-compose.yml | \
  docker compose -f - up -d
```

### Option 4: All-in-One Container (Development)
```bash
docker run -d \
  --name web-appliance \
  -p 80:80 -p 443:443 \
  --restart unless-stopped \
  ghcr.io/alflewerken/web-appliance-dashboard:all-in-one
```

### Option 5: Using Docker Compose Plugin
```bash
docker compose up -d \
  --file https://raw.githubusercontent.com/alflewerken/web-appliance-dashboard/main/docker-compose.yml
```

## What Each Method Does

### The Install Script Method
1. Checks for Docker and Docker Compose
2. Creates installation directory
3. Downloads docker-compose.yml
4. Generates secure passwords
5. Creates SSL certificates
6. Starts all services
7. Shows access URLs

### The Installer Container Method
1. Runs a container that has access to Docker socket
2. Sets up everything inside the container
3. Deploys the actual application
4. Cleans up after itself

### The Direct Compose Method
1. Downloads and runs docker-compose.yml directly
2. Uses default settings
3. Fastest but less customizable

## For Package Maintainers

### Homebrew (Mac)
```bash
brew tap alflewerken/web-appliance
brew install web-appliance-dashboard
```

### Snap (Linux)
```bash
snap install web-appliance-dashboard
```

### Helm (Kubernetes)
```bash
helm repo add web-appliance https://alflewerken.github.io/charts
helm install my-dashboard web-appliance/dashboard
```

## Environment Variables for Customization

```bash
# Custom installation
HTTP_PORT=8080 HTTPS_PORT=8443 \
  curl -sSL https://get.web-appliance.io | bash
```

## Uninstall

```bash
# If installed with script
docker compose -f ~/web-appliance-dashboard/docker-compose.yml down -v

# If installed as single container
docker rm -f web-appliance
```

## Update

```bash
# Pull latest images and restart
docker compose -f ~/web-appliance-dashboard/docker-compose.yml pull
docker compose -f ~/web-appliance-dashboard/docker-compose.yml up -d
```
