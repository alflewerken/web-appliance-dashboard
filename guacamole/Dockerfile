# Dockerfile für Guacamole mit Header Authentication und Auto-SFTP

FROM guacamole/guacamole:1.5.5

# Arbeite als root für die Installation
USER root

# Installiere PostgreSQL Client für Datenbank-Operationen
RUN apt-get update && apt-get install -y \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Erstelle Extensions-Verzeichnis und Guacamole Home
RUN mkdir -p /opt/guacamole/extensions /home/guacamole/.guacamole/extensions

# Kopiere die guacamole.properties
COPY guacamole.properties /home/guacamole/.guacamole/guacamole.properties

# Kopiere Extensions nach /opt/guacamole/extensions/
COPY extensions/*.jar /opt/guacamole/extensions/

# Erstelle symbolische Links für unsere Extensions
RUN cd /home/guacamole/.guacamole/extensions && \
    for ext in /opt/guacamole/extensions/*.jar; do \
        ln -sf "$ext" . ; \
    done

# Kopiere das SFTP Startup-Script
COPY startup-sftp.sh /opt/guacamole/startup-sftp.sh
COPY startup-enhanced.sh /opt/guacamole/startup-enhanced.sh
RUN chmod +x /opt/guacamole/startup-sftp.sh /opt/guacamole/startup-enhanced.sh

# Erstelle ein Wrapper-Script für den Start
RUN echo '#!/bin/bash\n\
# Start enhanced startup in background\n\
/opt/guacamole/startup-enhanced.sh &\n\
# Start Guacamole normally\n\
exec /opt/guacamole/bin/start.sh' > /opt/guacamole/bin/start-with-sftp.sh \
&& chmod +x /opt/guacamole/bin/start-with-sftp.sh

# Setze die richtigen Berechtigungen
RUN chown -R guacamole:guacamole /home/guacamole/.guacamole/

# Wechsle zurück zum guacamole user
USER guacamole

# Override the entrypoint to use our wrapper
CMD ["/opt/guacamole/bin/start-with-sftp.sh"]
