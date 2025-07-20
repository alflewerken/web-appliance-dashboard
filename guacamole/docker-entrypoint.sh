#!/bin/bash

# Entrypoint script für Guacamole mit Dashboard Extension

# TEMPORÄR DEAKTIVIERT: Dashboard Extension verursacht Fehler
# Kopiere unsere Extension beim Start
# if [ -f /opt/guacamole/dashboard-auth/guacamole-auth-dashboard-1.0.0.jar ]; then
#     echo "Installing Dashboard Authentication Extension..."
#     mkdir -p /home/guacamole/.guacamole/extensions
#     cp /opt/guacamole/dashboard-auth/guacamole-auth-dashboard-1.0.0.jar /home/guacamole/.guacamole/extensions/
#     chown guacamole:guacamole /home/guacamole/.guacamole/extensions/guacamole-auth-dashboard-1.0.0.jar
#     echo "Dashboard Authentication Extension installed."
# fi

# Führe das originale start.sh aus
exec /opt/guacamole/bin/start.sh "$@"
