FROM tsl0922/ttyd:latest

# Install SSH client
RUN apt-get update && \
    apt-get install -y --no-install-recommends openssh-client && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create .ssh directory for keys
RUN mkdir -p /root/.ssh && chmod 700 /root/.ssh

WORKDIR /root
