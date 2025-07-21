FROM tsl0922/ttyd:latest

# Skip SSH client installation due to space/GPG issues
# SSH functionality can be handled by the backend container instead

# Create .ssh directory for keys
RUN mkdir -p /root/.ssh && chmod 700 /root/.ssh

WORKDIR /root

# The container will still work for basic terminal functionality
# SSH connections can be proxied through the backend API
