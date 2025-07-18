const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class DockerInitializer {
  constructor() {
    this.dockerSocketPaths = [
      `${process.env.HOME}/.docker/run/docker.sock`,
      '/var/run/docker.sock',
      `${process.env.HOME}/.colima/default/docker.sock`,
      `${process.env.HOME}/.rd/docker.sock`
    ];
  }

  async checkDockerInstalled() {
    return new Promise((resolve) => {
      const env = this.getDockerEnv();
      exec('docker --version', { env }, (error, stdout) => {
        if (error) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  async checkDockerRunning() {
    return new Promise((resolve) => {
      const env = this.getDockerEnv();
      exec('docker info', { env }, (error) => {
        if (error) {
          // Versuche Docker-Context zu setzen
          exec('docker context use desktop-linux && docker info', { env, shell: true }, (error2) => {
            resolve(!error2);
          });
          return;
        }
        resolve(true);
      });
    });
  }

  getDockerEnv() {
    const env = { ...process.env };
    
    // PATH erweitern für verschiedene Docker-Installationen
    const additionalPaths = [
      '/usr/local/bin',
      '/opt/homebrew/bin',
      '/Applications/Docker.app/Contents/Resources/bin',
      `${process.env.HOME}/.docker/bin`
    ];
    
    env.PATH = additionalPaths.join(':') + ':' + (process.env.PATH || '');
    
    // Docker Socket suchen
    for (const socketPath of this.dockerSocketPaths) {
      if (fs.existsSync(socketPath)) {
        env.DOCKER_HOST = `unix://${socketPath}`;
        break;
      }
    }
    
    return env;
  }

  async startDocker() {
    const platform = os.platform();
    
    if (platform === 'darwin') {
      // macOS: Versuche Docker Desktop zu starten
      return new Promise((resolve, reject) => {
        exec('open -a "Docker"', (error) => {
          if (error) {
            reject(new Error('Konnte Docker Desktop nicht starten'));
          } else {
            // Warte bis Docker bereit ist
            this.waitForDocker(resolve, reject);
          }
        });
      });
    } else {
      throw new Error('Docker-Start auf dieser Plattform nicht unterstützt');
    }
  }

  async waitForDocker(resolve, reject, attempts = 0) {
    if (attempts > 30) { // 30 Sekunden Timeout
      reject(new Error('Docker Start Timeout'));
      return;
    }

    const running = await this.checkDockerRunning();
    if (running) {
      resolve();
    } else {
      setTimeout(() => this.waitForDocker(resolve, reject, attempts + 1), 1000);
    }
  }

  async execCommand(command) {
    return new Promise((resolve, reject) => {
      const env = this.getDockerEnv();
      exec(command, { env, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout);
        }
      });
    });
  }

  async initializeContainers() {
    console.log('Starting Docker containers...');
    
    // Get the app's resource path
    const appPath = process.resourcesPath || path.join(__dirname, '..');
    const projectPath = path.join(appPath, '..', '..', '..');
    
    // Change to project directory and start containers
    const command = `cd "${projectPath}" && docker-compose -f docker-compose.app.yml up -d`;
    
    try {
      const output = await this.execCommand(command);
      console.log('Containers started:', output);
      
      // Wait for containers to be ready
      await this.waitForContainers();
      
      // Initialize database
      await this.initializeDatabase();
      
      return true;
    } catch (error) {
      console.error('Failed to start containers:', error);
      throw error;
    }
  }

  async waitForContainers() {
    console.log('Waiting for containers to be ready...');
    
    const containers = ['wad_app_db', 'wad_app_backend', 'wad_app_webserver', 'wad_app_ttyd'];
    
    for (const container of containers) {
      let retries = 30;
      while (retries > 0) {
        try {
          const output = await this.execCommand(`docker inspect -f '{{.State.Running}}' ${container}`);
          if (output.trim() === 'true') {
            console.log(`✅ ${container} is running`);
            break;
          }
        } catch (error) {
          // Container doesn't exist yet
        }
        
        retries--;
        if (retries === 0) {
          throw new Error(`Container ${container} failed to start`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  async initializeDatabase() {
    console.log('Initializing database...');
    
    // Wait for database to be ready
    let retries = 30;
    while (retries > 0) {
      try {
        await this.execCommand('docker exec wad_app_db mariadb -u root -prootpassword123 -e "SELECT 1"');
        console.log('✅ Database is ready');
        break;
      } catch (error) {
        retries--;
        if (retries === 0) {
          throw new Error('Database initialization timeout');
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Create missing tables
    const createTableQueries = [
      `CREATE TABLE IF NOT EXISTS user_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        session_id VARCHAR(255) NOT NULL UNIQUE,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_session_id (session_id),
        INDEX idx_user_id (user_id),
        INDEX idx_expires_at (expires_at)
      );`
    ];

    for (const query of createTableQueries) {
      try {
        await this.execCommand(`docker exec wad_app_db mariadb -u root -prootpassword123 appliance_dashboard -e "${query}"`);
        console.log('✅ Database tables initialized successfully');
      } catch (error) {
        console.error('Warning: Could not create table:', error.message);
      }
    }
    
    // Restart backend to ensure all migrations run
    try {
      await this.execCommand('docker restart wad_app_backend');
      console.log('✅ Backend restarted successfully');
    } catch (error) {
      console.error('Warning: Could not restart backend:', error.message);
    }
  }

  async stopContainers() {
    console.log('Stopping Docker containers...');
    
    try {
      const appPath = process.resourcesPath || path.join(__dirname, '..');
      const projectPath = path.join(appPath, '..', '..', '..');
      
      const command = `cd "${projectPath}" && docker-compose -f docker-compose.app.yml down`;
      const output = await this.execCommand(command);
      console.log('Containers stopped:', output);
      return true;
    } catch (error) {
      console.error('Failed to stop containers:', error);
      return false;
    }
  }

  async getContainerStatus() {
    try {
      const output = await this.execCommand('docker ps --format "{{.Names}}\\t{{.Status}}" | grep wad_app');
      const lines = output.trim().split('\n').filter(line => line);
      
      const status = {};
      for (const line of lines) {
        const [name, containerStatus] = line.split('\t');
        status[name] = containerStatus;
      }
      
      return status;
    } catch (error) {
      console.error('Failed to get container status:', error);
      return {};
    }
  }

  async checkHealth() {
    const health = {
      docker: false,
      database: false,
      backend: false,
      frontend: false,
      terminal: false
    };

    try {
      // Check Docker
      health.docker = await this.checkDockerRunning();
      
      if (health.docker) {
        // Check containers
        const status = await this.getContainerStatus();
        
        health.database = status['wad_app_db']?.includes('Up') || false;
        health.backend = status['wad_app_backend']?.includes('Up') || false;
        health.frontend = status['wad_app_webserver']?.includes('Up') || false;
        health.terminal = status['wad_app_ttyd']?.includes('Up') || false;
      }
    } catch (error) {
      console.error('Health check error:', error);
    }

    return health;
  }
}

module.exports = DockerInitializer;
