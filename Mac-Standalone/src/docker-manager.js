const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const DockerInitializer = require('./docker-initializer');

class DockerManager {
  constructor() {
    // In der Entwicklung: Verwende das Eltern-Verzeichnis
    // In der gepackten App: Verwende Application Support Verzeichnis
    const appSupportPath = path.join(os.homedir(), 'Library', 'Application Support', 'web-appliance-dashboard');
    
    // Versuche gespeicherten Projekt-Pfad zu laden
    let savedProjectPath = null;
    const projectPathFile = path.join(appSupportPath, 'project-path.txt');
    if (fs.existsSync(projectPathFile)) {
      savedProjectPath = fs.readFileSync(projectPathFile, 'utf8').trim();
    }
    
    // Projekt-Pfad je nach Umgebung
    if (process.env.NODE_ENV === 'development') {
      // Entwicklung: macos-app Verzeichnis
      this.projectPath = path.join(__dirname, '..', '..');
    } else {
      // Produktion: Verwende das macos-app Verzeichnis aus dem Hauptprojekt
      // Die App wird aus /Applications gestartet, aber die docker-compose.app.yml 
      // liegt im ursprünglichen Projekt-Verzeichnis
      this.projectPath = '/Users/alflewerken/Desktop/web-appliance-dashboard/macos-app';
    }
    
    // Eindeutiger Projekt-Name für die App-Container
    // WICHTIG: Muss 'web-appliance-app' sein für korrekte Container-Namen
    this.projectName = 'web-appliance-app';
    
    console.log('Docker project path:', this.projectPath);
    console.log('Docker project name:', this.projectName);
    console.log('Expected container prefix: wad_app_');
    
    // Erweiterte PATH-Einstellungen für macOS
    this.dockerEnv = {
      ...process.env,
      PATH: '/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:/Applications/Docker.app/Contents/Resources/bin',
      // Docker Desktop Socket-Pfad für macOS
      DOCKER_HOST: `unix://${process.env.HOME}/.docker/run/docker.sock`,
      // Compose Projekt-Name für isolierte Container
      COMPOSE_PROJECT_NAME: this.projectName
    };
    
    this.mainWindow = null;
    this.initializer = null;
    
    if (process.env.NODE_ENV !== 'development' && process.resourcesPath) {
      this.initializer = new DockerInitializer(process.resourcesPath);
    }
    
    // Binde alle Methoden an this
    this.getStatus = this.getStatus.bind(this);
    this.startContainers = this.startContainers.bind(this);
    this.stopContainers = this.stopContainers.bind(this);
    this.restartContainers = this.restartContainers.bind(this);
    this.getLogs = this.getLogs.bind(this);
  }

  initialize(mainWindow) {
    this.mainWindow = mainWindow;
  }

  async ensureSetup() {
    // Nur in Production
    if (process.env.NODE_ENV === 'development') {
      return true;
    }
    
    const os = require('os');
    const appSupportDir = path.join(os.homedir(), 'Library', 'Application Support', 'web-appliance-dashboard');
    const setupMarker = path.join(appSupportDir, '.setup-complete');
    
    // Prüfe ob Setup bereits durchgeführt wurde
    if (fs.existsSync(setupMarker)) {
      // Prüfe ob docker-compose.yml existiert
      const composeFile = path.join(appSupportDir, 'docker-compose.yml');
      if (!fs.existsSync(composeFile)) {
        console.log('docker-compose.yml fehlt, führe erneutes Setup durch...');
        // Lösche Setup-Marker für erneutes Setup
        fs.unlinkSync(setupMarker);
      } else {
        return true;
      }
    }
    
    console.log('Erste Ausführung erkannt, führe automatisches Setup durch...');
    
    try {
      // 1. Erstelle Application Support Verzeichnis
      if (!fs.existsSync(appSupportDir)) {
        fs.mkdirSync(appSupportDir, { recursive: true });
      }
      
      // 2. Finde das Projekt-Verzeichnis dynamisch
      let projectDir = this.findProjectDirectory();
      if (!projectDir) {
        // Wenn nicht gefunden, versuche bekannte Pfade
        const fallbackPaths = [
          '/Users/alflewerken/Desktop/web-appliance-dashboard',
          path.join(os.homedir(), 'Desktop', 'web-appliance-dashboard'),
          path.join(os.homedir(), 'Documents', 'web-appliance-dashboard')
        ];
        
        for (const testPath of fallbackPaths) {
          if (fs.existsSync(testPath) && 
              fs.existsSync(path.join(testPath, 'backend')) &&
              fs.existsSync(path.join(testPath, 'frontend'))) {
            projectDir = testPath;
            console.log('Projekt gefunden über Fallback:', projectDir);
            break;
          }
        }
        
        if (!projectDir) {
          throw new Error('Web Appliance Dashboard Projekt nicht gefunden');
        }
      }
      
      console.log('Projekt gefunden in:', projectDir);
      
      // 3. Generiere docker-compose.yml mit absoluten Pfaden
      const dockerComposeContent = this.generateDockerCompose(projectDir);
      fs.writeFileSync(path.join(appSupportDir, 'docker-compose.yml'), dockerComposeContent);
      
      // 4. Speichere Projekt-Pfad für spätere Verwendung
      fs.writeFileSync(path.join(appSupportDir, 'project-path.txt'), projectDir);
      
      // 5. Erstelle Setup-Marker
      fs.writeFileSync(setupMarker, new Date().toISOString());
      
      console.log('Setup erfolgreich abgeschlossen!');
      return true;
      
    } catch (error) {
      console.error('Setup fehlgeschlagen:', error);
      
      // Letzter Versuch mit hartkodiertem Pfad
      try {
        const hardcodedPath = '/Users/alflewerken/Desktop/web-appliance-dashboard';
        if (fs.existsSync(hardcodedPath)) {
          console.log('Verwende hartkodierten Pfad als letzten Versuch...');
          const dockerComposeContent = this.generateDockerCompose(hardcodedPath);
          fs.writeFileSync(path.join(appSupportDir, 'docker-compose.yml'), dockerComposeContent);
          fs.writeFileSync(path.join(appSupportDir, 'project-path.txt'), hardcodedPath);
          fs.writeFileSync(setupMarker, new Date().toISOString());
          console.log('Fallback-Setup erfolgreich!');
          return true;
        }
      } catch (fallbackError) {
        console.error('Auch Fallback-Setup fehlgeschlagen:', fallbackError);
      }
      
      return false;
    }
  }
  
  findProjectDirectory() {
    // Mögliche Pfade wo das Projekt sein könnte
    const possiblePaths = [
      // Standard-Pfad aus der Zusammenfassung
      '/Users/alflewerken/Desktop/web-appliance-dashboard',
      // Relativ zum App Bundle
      path.join(process.resourcesPath, '..', '..', '..', '..'),
      // Home Directory Varianten
      path.join(os.homedir(), 'Desktop', 'web-appliance-dashboard'),
      path.join(os.homedir(), 'Documents', 'web-appliance-dashboard'),
      path.join(os.homedir(), 'web-appliance-dashboard'),
      // Aktuelles Verzeichnis
      process.cwd()
    ];
    
    // Prüfe jeden möglichen Pfad
    for (const testPath of possiblePaths) {
      // Normalisiere den Pfad
      const normalizedPath = path.resolve(testPath);
      
      // Prüfe ob es das richtige Verzeichnis ist (enthält docker-compose.yml und backend/frontend)
      if (fs.existsSync(path.join(normalizedPath, 'docker-compose.yml')) &&
          fs.existsSync(path.join(normalizedPath, 'backend')) &&
          fs.existsSync(path.join(normalizedPath, 'frontend'))) {
        return normalizedPath;
      }
    }
    
    // Wenn nicht gefunden, suche rekursiv im Desktop und Documents
    const searchPaths = [
      path.join(os.homedir(), 'Desktop'),
      path.join(os.homedir(), 'Documents')
    ];
    
    for (const searchPath of searchPaths) {
      const found = this.searchForProject(searchPath, 'web-appliance-dashboard', 2);
      if (found) return found;
    }
    
    return null;
  }
  
  searchForProject(startPath, projectName, maxDepth) {
    if (!fs.existsSync(startPath) || maxDepth <= 0) return null;
    
    try {
      const items = fs.readdirSync(startPath);
      
      for (const item of items) {
        const itemPath = path.join(startPath, item);
        const stat = fs.statSync(itemPath);
        
        if (stat.isDirectory()) {
          // Prüfe ob es das Projekt ist
          if (item.includes(projectName) || item === projectName) {
            if (fs.existsSync(path.join(itemPath, 'docker-compose.yml')) &&
                fs.existsSync(path.join(itemPath, 'backend')) &&
                fs.existsSync(path.join(itemPath, 'frontend'))) {
              return itemPath;
            }
          }
          
          // Rekursiv weitersuchen
          const found = this.searchForProject(itemPath, projectName, maxDepth - 1);
          if (found) return found;
        }
      }
    } catch (error) {
      // Ignoriere Fehler (z.B. keine Berechtigung)
    }
    
    return null;
  }
  
  generateDockerCompose(projectDir) {
    return `# Docker Compose für Web Appliance Dashboard macOS App
# Automatisch generiert am ${new Date().toISOString()}

services:
  # MariaDB Database
  database:
    image: mariadb:latest
    container_name: wad_app_db
    restart: always
    ports:
      - "3307:3306"
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword123
      MYSQL_DATABASE: appliance_dashboard
      MYSQL_USER: dashboard_user
      MYSQL_PASSWORD: dashboard_pass123
    volumes:
      - app_db_data:/var/lib/mysql
      - ${projectDir}/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    networks:
      - app_network
    healthcheck:
      test: ["CMD", "mariadb-admin", "ping", "-h", "localhost"]
      timeout: 10s
      retries: 20
      start_period: 40s

  # Node.js Backend API
  backend:
    build:
      context: ${projectDir}/backend
      dockerfile: Dockerfile
    container_name: wad_app_backend
    restart: always
    ports:
      - "3002:3001"
    environment:
      DB_HOST: database
      DB_PORT: 3306
      DB_USER: dashboard_user
      DB_PASSWORD: dashboard_pass123
      DB_NAME: appliance_dashboard
      JWT_SECRET: V2FUAJ3cOAghJY8B3FprwknN5/ZktN0gX+x/D4GEhQv+dk2dDoYYwWjIhNR7KPkXWNXrX/+Sx2C9U/UCDYiaSw==
      SSH_KEY_ENCRYPTION_SECRET: o2ZGotcuB3cTBhs/7xQoAj3WXCIZEs8CyOLbmgdHx5M=
      NODE_ENV: production
      ALLOWED_ORIGINS: "http://localhost,https://localhost,http://localhost:9081,https://localhost:9444"
      SSH_TOOLS_ENABLED: "true"
      SSH_AUTO_INIT: "true"
    depends_on:
      database:
        condition: service_healthy
    networks:
      - app_network
    volumes:
      - ${projectDir}/backend:/app
      - /app/node_modules
      - app_ssh_keys:/root/.ssh
      - app_uploads:/app/uploads
    healthcheck:
      test: ["CMD", "sh", "-c", "curl -f http://localhost:3001/api/health && which ssh && which ssh-copy-id && which sshpass"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Nginx Web Server
  webserver:
    image: nginx:alpine
    container_name: wad_app_webserver
    restart: always
    ports:
      - "9081:80"
      - "9444:443"
    volumes:
      - ${projectDir}/nginx/nginx-macapp-docker.conf:/etc/nginx/nginx.conf:ro
      - ${projectDir}/nginx/conf.d:/etc/nginx/conf.d:ro
      - ${projectDir}/frontend/build:/usr/share/nginx/html:ro
      - ${projectDir}/nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      backend:
        condition: service_healthy
      ttyd:
        condition: service_started
      # Guacamole is optional
    networks:
      - app_network

  # ttyd Web Terminal
  ttyd:
    build: ${projectDir}/ttyd
    container_name: wad_app_ttyd
    restart: always
    ports:
      - "7682:7681"
    command: >
      ttyd
      --writable
      --port 7681
      --base-path /
      --terminal-type xterm-256color
      /scripts/ttyd-ssh-wrapper.sh
    environment:
      SSH_HOST: \${TTYD_DEFAULT_HOST:-192.168.178.70}
      SSH_USER: \${TTYD_DEFAULT_USER:-alflewerken}
      SSH_PORT: \${TTYD_DEFAULT_PORT:-22}
    networks:
      - app_network
    volumes:
      - app_ssh_keys:/root/.ssh:ro
      - ${projectDir}/scripts:/scripts:ro

  # ====================================================================
  # REMOTE DESKTOP SERVICES (GUACAMOLE)
  # ====================================================================
  
  # Guacamole Proxy Daemon
  guacd:
    image: guacamole/guacd:1.5.5
    platform: linux/amd64  # Rosetta 2 wird für M1/M2 Macs verwendet
    container_name: wad_app_guacd
    restart: always
    volumes:
      - app_guacamole_drive:/drive:rw
      - app_guacamole_record:/record:rw
    environment:
      GUACD_LOG_LEVEL: info
    networks:
      - app_network
    healthcheck:
      test: ["CMD", "nc", "-z", "localhost", "4822"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Guacamole PostgreSQL Database
  guacamole-postgres:
    image: postgres:15-alpine
    container_name: wad_app_guacamole_db
    restart: always
    environment:
      POSTGRES_DB: guacamole_db
      POSTGRES_USER: guacamole_user
      POSTGRES_PASSWORD: guacamole_pass123
    volumes:
      - app_guacamole_db:/var/lib/postgresql/data
      - ${projectDir}/guacamole/initdb.sql:/docker-entrypoint-initdb.d/initdb.sql:ro
    networks:
      - app_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U guacamole_user"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Guacamole Web Application
  guacamole:
    image: guacamole/guacamole:1.5.5
    platform: linux/amd64  # Rosetta 2 wird für M1/M2 Macs verwendet
    container_name: wad_app_guacamole
    restart: always
    depends_on:
      guacd:
        condition: service_healthy
      guacamole-postgres:
        condition: service_healthy service_healthy
      guacamole-postgres:
        condition: service_healthy
    environment:
      GUACD_HOSTNAME: guacd
      POSTGRES_HOSTNAME: guacamole-postgres
      POSTGRES_DATABASE: guacamole_db
      POSTGRES_USER: guacamole_user
      POSTGRES_PASSWORD: guacamole_pass123
      # Integration settings
      HEADER_ENABLED: 'true'
      # CORS für iFrame
      EXTENSION_PRIORITY: '*'
      # Optional: Custom settings
      GUACAMOLE_HOME: /etc/guacamole
    ports:
      - "9782:8080"
    networks:
      - app_network
    volumes:
      - ${projectDir}/guacamole/extensions:/opt/guacamole/extensions:ro
      - app_guacamole_home:/etc/guacamole
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/guacamole/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

volumes:
  app_db_data:
    driver: local
    name: wad_app_db_data
  app_ssh_keys:
    driver: local
    name: wad_app_ssh_keys
  app_uploads:
    driver: local
    name: wad_app_uploads
  # Guacamole volumes
  app_guacamole_db:
    driver: local
    name: wad_app_guacamole_db
  app_guacamole_drive:
    driver: local
    name: wad_app_guacamole_drive
  app_guacamole_record:
    driver: local
    name: wad_app_guacamole_record
  app_guacamole_home:
    driver: local
    name: wad_app_guacamole_home

networks:
  app_network:
    driver: bridge
    name: wad_app_network
`;
  }

  async getStatus() {
    return new Promise(async (resolve) => {
      // Stelle sicher, dass Setup durchgeführt wurde
      const setupOk = await this.ensureSetup();
      if (!setupOk) {
        resolve({ 
          running: false, 
          error: 'Automatisches Setup fehlgeschlagen. Bitte prüfen Sie die Berechtigungen.', 
          dockerInstalled: true 
        });
        return;
      }
      
      // Prüfe zuerst, ob Docker überhaupt läuft
      exec('docker version', { env: this.dockerEnv }, (versionError) => {
        if (versionError) {
          console.error('Docker not running:', versionError.message);
          resolve({ 
            running: false, 
            error: 'Docker Desktop scheint nicht zu laufen', 
            dockerInstalled: false 
          });
          return;
        }
        
        // Docker läuft, jetzt Container-Status prüfen
        const composeFile = this.getComposeFile();
          
        const dockerCmd = 'docker';
        const args = ['compose', '-f', composeFile, '-p', this.projectName, 'ps'];
        
        exec(`${dockerCmd} ${args.join(' ')}`, { 
          cwd: this.projectPath,
          env: this.dockerEnv
        }, (error, stdout, stderr) => {
          if (error) {
            console.error('Docker Compose Error:', error.message);
            console.error('Working Directory:', this.projectPath);
            
            // Versuche mit docker-compose (v1)
            exec(`docker-compose -p ${this.projectName} ps`, { 
              cwd: this.projectPath,
              env: this.dockerEnv
            }, (error2, stdout2, stderr2) => {
              if (error2) {
                // Prüfe ob docker-compose.yml existiert
                const composePath = path.join(this.projectPath, 'docker-compose.yml');
                if (!fs.existsSync(composePath)) {
                  resolve({ 
                    running: false, 
                    error: 'docker-compose.yml nicht gefunden', 
                    path: this.projectPath,
                    dockerInstalled: true
                  });
                  return;
                }
                
                resolve({ 
                  running: false, 
                  error: 'Fehler beim Abrufen des Container-Status', 
                  details: stderr2 || stderr,
                  dockerInstalled: true
                });
                return;
              }
              
              this.parseContainerOutput(stdout2, resolve);
            });
            return;
          }
          
          this.parseContainerOutput(stdout, resolve);
        });
      });
    });
  }
  
  parseContainerOutput(stdout, resolve) {
    const lines = stdout.split('\n').filter(line => line.trim());
    const containers = [];
    
    // Prüfe ob überhaupt Container vorhanden sind
    if (lines.length <= 1 || (lines[1] && lines[1].includes('no such service'))) {
      console.log('Keine Container gefunden für Projekt:', this.projectName);
      resolve({
        running: false,
        containers: [],
        dockerInstalled: true,
        message: 'Keine Container vorhanden. Klicken Sie auf "Starten" um die Container zu erstellen.'
      });
      return;
    }
    
    // Finde die Header-Zeile
    let headerIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('NAME') && lines[i].includes('STATUS')) {
        headerIndex = i;
        break;
      }
    }
    
    // Parse Container ab der Zeile nach dem Header
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim()) {
        // Extrahiere Felder basierend auf Spalten
        const name = line.substring(0, 30).trim();
        const statusMatch = line.match(/Up \d+ \w+|Exited|Created/);
        const isRunning = line.includes('Up ');
        
        // Filtere nur Container die zu unserem Projekt gehören
        if (name && (name.includes(this.projectName) || 
                    name.includes('web-appliance-app') || 
                    name.includes('wad_app'))) {
          containers.push({
            name: name,
            service: name.replace(`${this.projectName}-`, '')
                        .replace('web-appliance-app-', '')
                        .replace('wad_app_', '')
                        .replace('-1', ''),
            state: isRunning ? 'running' : 'stopped',
            status: statusMatch ? statusMatch[0] : 'Unknown'
          });
        }
      }
    }
    
    const allRunning = containers.length > 0 && 
      containers.every(c => c.state === 'running');
    
    console.log('Parsed containers:', containers);
    
    resolve({
      running: allRunning,
      containers: containers,
      dockerInstalled: true,
      containerCount: containers.length
    });
  }

  getComposeFile() {
    // Verwende immer docker-compose.app.yml aus dem Projekt-Verzeichnis
    const composeFile = path.join(this.projectPath, 'docker-compose.app.yml');
    console.log('Using compose file:', composeFile);
    
    if (!fs.existsSync(composeFile)) {
      console.error('Docker compose file not found:', composeFile);
      throw new Error(`Docker compose file not found: ${composeFile}`);
    }
    
    return composeFile;
  }

  async startContainers() {
    return new Promise(async (resolve, reject) => {
      try {
        // Stelle sicher, dass Setup durchgeführt wurde
        const setupOk = await this.ensureSetup();
        if (!setupOk) {
          reject(new Error('Setup konnte nicht durchgeführt werden'));
          return;
        }
        
        const composeFile = this.getComposeFile();
        
        // Prüfe ob die Compose-Datei existiert
        if (!fs.existsSync(composeFile)) {
          reject(new Error(`Docker Compose Datei nicht gefunden: ${composeFile}`));
          return;
        }
        
        // Starte alle Container ohne komplizierte Volume-Initialisierung
        // Zuerst ohne Service-Namen versuchen (startet alle Services)
        const args = [
          'compose',
          '-f', composeFile,
          '-p', this.projectName,
          'up',
          '-d'
        ];
        
        console.log('Starting containers with docker:', args);
        console.log('Working directory:', this.projectPath);
          
        const dockerProcess = spawn('docker', args, {
          cwd: this.projectPath,
          env: {
            ...this.dockerEnv,
            COMPOSE_PROJECT_NAME: this.projectName
          },
          stdio: 'pipe'
        });

        let output = '';
        let errorOutput = '';
        
        dockerProcess.stdout.on('data', (data) => {
          output += data.toString();
          console.log('Docker stdout:', data.toString());
          this.sendToRenderer('docker:output', data.toString());
        });

        dockerProcess.stderr.on('data', (data) => {
          errorOutput += data.toString();
          console.error('Docker stderr:', data.toString());
          this.sendToRenderer('docker:output', data.toString());
        });

        dockerProcess.on('error', (error) => {
          console.error('Spawn error:', error);
          reject(new Error(`Fehler beim Starten des Docker-Prozesses: ${error.message}`));
        });

        dockerProcess.on('close', async (code) => {
          if (code === 0) {
            // Container erfolgreich gestartet, warte bis sie bereit sind
            console.log('Container erfolgreich gestartet, warte auf Datenbankbereitschaft...');
            
            // Warte 10 Sekunden bis die Datenbank bereit ist
            setTimeout(async () => {
              try {
                await this.createAdminUserIfNeeded();
              } catch (error) {
                console.error('Fehler beim Erstellen des Admin-Benutzers:', error);
                // Fehler beim Admin-Erstellen sollte nicht den Start blockieren
              }
            }, 10000);
            
            resolve({ success: true, output });
          } else {
            const errorMessage = errorOutput || output || `Process exited with code ${code}`;
            reject(new Error(`Docker Compose fehlgeschlagen: ${errorMessage}`));
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }
  
  async runDockerCompose(args) {
    return new Promise((resolve, reject) => {
      const composeFile = this.getComposeFile();
      const fullArgs = ['compose', '-f', composeFile, '-p', this.projectName, ...args];
      
      const proc = spawn('docker', fullArgs, {
        cwd: this.projectPath,
        env: this.dockerEnv
      });
      
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Docker command failed with code ${code}`));
      });
    });
  }

  async stopContainers() {
    return new Promise((resolve, reject) => {
      try {
        const composeFile = this.getComposeFile();
        
        console.log('Stopping containers...');
        console.log('Compose file:', composeFile);
        console.log('Project path:', this.projectPath);
        console.log('Project name:', this.projectName);
        
        const args = [
          'compose',
          '-f', composeFile,
          '-p', this.projectName,
          'down'
        ];
        
        console.log('Docker args:', args);
        
        console.log('Executing docker with args:', args);
          
        const dockerProcess = spawn('docker', args, {
          cwd: this.projectPath,
          env: {
            ...this.dockerEnv,
            COMPOSE_PROJECT_NAME: this.projectName
          },
          stdio: 'pipe'
        });

        let output = '';
        
        dockerProcess.stdout.on('data', (data) => {
          output += data.toString();
          this.sendToRenderer('docker:output', data.toString());
        });

        dockerProcess.stderr.on('data', (data) => {
          output += data.toString();
          this.sendToRenderer('docker:output', data.toString());
        });

        dockerProcess.on('close', (code) => {
          if (code === 0) {
            console.log('Docker compose down completed successfully');
            console.log('All containers stopped');
            resolve({ success: true, output });
          } else {
            console.error('Docker compose down failed with code:', code);
            console.error('Output:', output);
            reject({ success: false, error: `Process exited with code ${code}`, output });
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async restartContainers() {
    await this.stopContainers();
    await this.startContainers();
  }

  async createAdminUserIfNeeded() {
    return new Promise((resolve, reject) => {
      try {
        console.log('Prüfe ob Admin-Benutzer erstellt werden muss...');
        
        // Führe ein Script aus, das prüft und ggf. einen Admin erstellt
        const checkAdminScript = `
          docker exec wad_app_db mariadb -u dashboard_user -pdashboard_pass123 appliance_dashboard -e "SELECT COUNT(*) as count FROM users;" 2>/dev/null | tail -1
        `;
        
        exec(checkAdminScript, async (error, stdout, stderr) => {
          if (error) {
            console.error('Fehler beim Prüfen der Benutzer:', error);
            reject(error);
            return;
          }
          
          const userCount = parseInt(stdout.trim()) || 0;
          
          if (userCount === 0) {
            console.log('Keine Benutzer gefunden, erstelle Admin-Benutzer...');
            
            // Erstelle den Admin-Benutzer
            const createAdminScript = `
              docker exec wad_app_db mariadb -u dashboard_user -pdashboard_pass123 appliance_dashboard -e "
                INSERT INTO users (username, email, password_hash, role, is_active) 
                VALUES ('admin', 'admin@localhost', '\\$2a\\$10\\$yHnyw6YHxiymOqwwlM6JxOpsEjvLa4/yqbLn2P6mQGQYhv4DnC9qq', 'Administrator', TRUE);"
            `;
            
            exec(createAdminScript, (createError, createStdout, createStderr) => {
              if (createError) {
                console.error('Fehler beim Erstellen des Admin-Benutzers:', createError);
                reject(createError);
              } else {
                console.log('✅ Admin-Benutzer wurde erfolgreich erstellt!');
                console.log('   Benutzername: admin');
                console.log('   Passwort: admin123');
                console.log('   ⚠️  Bitte ändern Sie das Passwort nach dem ersten Login!');
                
                // Sende Benachrichtigung an Renderer
                this.sendToRenderer('admin:created', {
                  username: 'admin',
                  password: 'admin123'
                });
                
                resolve(true);
              }
            });
          } else {
            console.log(`Es existieren bereits ${userCount} Benutzer in der Datenbank.`);
            resolve(false);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async getLogs(service) {
    return new Promise((resolve) => {
      const composeFile = this.getComposeFile();
      
      // Erstelle den Befehl mit richtig escapetem Dateipfad
      let cmd;
      if (service) {
        cmd = `docker compose -f "${composeFile}" -p ${this.projectName} logs --tail=100 ${service}`;
      } else {
        cmd = `docker compose -f "${composeFile}" -p ${this.projectName} logs --tail=100`;
      }
      
      console.log('Executing logs command:', cmd);
        
      exec(cmd, { 
        cwd: this.projectPath,
        env: this.dockerEnv,
        maxBuffer: 1024 * 1024 * 5 // 5MB buffer für Logs
      }, (error, stdout, stderr) => {
        if (error) {
          console.error('Logs error:', error);
          // Versuche es mit docker-compose v1
          const cmdV1 = service 
            ? `docker-compose -f "${composeFile}" -p ${this.projectName} logs --tail=100 ${service}`
            : `docker-compose -f "${composeFile}" -p ${this.projectName} logs --tail=100`;
          
          exec(cmdV1, { 
            cwd: this.projectPath,
            env: this.dockerEnv,
            maxBuffer: 1024 * 1024 * 5
          }, (error2, stdout2, stderr2) => {
            if (error2) {
              resolve({ error: `Fehler beim Abrufen der Logs: ${error.message}` });
              return;
            }
            resolve({ logs: stdout2 + stderr2 });
          });
          return;
        }
        resolve({ logs: stdout + stderr });
      });
    });
  }

  sendToRenderer(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }
}

module.exports = new DockerManager();
