# Dockerfile für Guacamole mit Header Authentication

FROM guacamole/guacamole:1.5.5

# Arbeite als root für die Installation
USER root

# Kopiere die guacamole.properties
COPY guacamole.properties /home/guacamole/.guacamole/guacamole.properties

# Setze die richtigen Berechtigungen
RUN chown -R guacamole:guacamole /home/guacamole/.guacamole/

# Wechsle zurück zum guacamole user
USER guacamole
