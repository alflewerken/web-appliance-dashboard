// PM2 Configuration for Production
// Usage: pm2 start ecosystem.config.js

module.exports = {
  apps: [
    {
      name: 'web-appliance-backend',
      script: './server.js',
      cwd: '/opt/web-appliance-dashboard/backend',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: '/var/log/web-appliance/backend-error.log',
      out_file: '/var/log/web-appliance/backend-out.log',
      log_file: '/var/log/web-appliance/backend-combined.log',
      time: true,
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000
    },
    {
      name: 'snmp-polling-service',
      script: './polling-worker.js',
      cwd: '/opt/web-appliance-dashboard/backend',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        ENABLE_SNMP_POLLING: 'true',
        SNMP_POLL_INTERVAL: '60',
        LOG_LEVEL: 'info'
      },
      error_file: '/var/log/web-appliance/polling-error.log',
      out_file: '/var/log/web-appliance/polling-out.log',
      log_file: '/var/log/web-appliance/polling-combined.log',
      time: true,
      kill_timeout: 10000,
      autorestart: true,
      restart_delay: 10000,
      max_restarts: 10,
      min_uptime: 60000
    }
  ],

  // Deploy configuration (optional)
  deploy: {
    production: {
      user: 'www-data',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'https://github.com/alflewerken/web-appliance-dashboard.git',
      path: '/opt/web-appliance-dashboard',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-deploy-local': '',
      env: {
        NODE_ENV: 'production'
      }
    }
  }
};
