#!/usr/bin/env python3

# Read the file
with open('backend/utils/guacamole/GuacamoleDBManager.js', 'r') as f:
    content = f.read()

# Replace the host name
content = content.replace(
    "host: process.env.GUACAMOLE_DB_HOST || 'appliance_guacamole_db',",
    "host: process.env.GUACAMOLE_DB_HOST || 'guacamole-postgres',"
)

# Add logging
old_constructor = """  constructor() {
    // Verbindung zur Guacamole PostgreSQL Datenbank
    this.pool = new Pool({
      host: process.env.GUACAMOLE_DB_HOST || 'guacamole-postgres',
      port: 5432,
      database: process.env.GUACAMOLE_DB_NAME || 'guacamole_db',
      user: process.env.GUACAMOLE_DB_USER || 'guacamole_user',
      password: process.env.GUACAMOLE_DB_PASSWORD || 'guacamole_pass123'
    });
  }"""

new_constructor = """  constructor() {
    // Verbindung zur Guacamole PostgreSQL Datenbank
    const config = {
      host: process.env.GUACAMOLE_DB_HOST || 'guacamole-postgres',
      port: 5432,
      database: process.env.GUACAMOLE_DB_NAME || 'guacamole_db',
      user: process.env.GUACAMOLE_DB_USER || 'guacamole_user',
      password: process.env.GUACAMOLE_DB_PASSWORD || 'guacamole_pass123'
    };
    
    console.log('[GuacamoleDBManager] Connecting with config:', {
      ...config,
      password: '***' // Hide password in logs
    });
    
    this.pool = new Pool(config);
  }"""

content = content.replace(old_constructor, new_constructor)

# Write the modified file
with open('backend/utils/guacamole/GuacamoleDBManager.js', 'w') as f:
    f.write(content)

print("File patched successfully")
