#!/usr/bin/env python3

# Read the file
with open('backend/utils/guacamole/GuacamoleDBManager.js', 'r') as f:
    content = f.read()

# Replace back to the correct host name
content = content.replace(
    "host: process.env.GUACAMOLE_DB_HOST || 'guacamole-postgres',",
    "host: process.env.GUACAMOLE_DB_HOST || 'appliance_guacamole_db',"
)

# Write the modified file
with open('backend/utils/guacamole/GuacamoleDBManager.js', 'w') as f:
    f.write(content)

print("File patched successfully - using correct container name")
