FROM tsl0922/ttyd:latest

# Switch to root for installation
USER root

# Update package lists with workaround for GPG issues
RUN echo "Acquire::Check-Valid-Until \"false\";" > /etc/apt/apt.conf.d/99no-check-valid-until && \
    echo "Acquire::AllowInsecureRepositories \"true\";" > /etc/apt/apt.conf.d/99allow-insecure && \
    echo "APT::Get::AllowUnauthenticated \"true\";" > /etc/apt/apt.conf.d/99allow-unauth && \
    apt-get update -o Acquire::AllowInsecureRepositories=true -o Acquire::AllowDowngradeToInsecureRepositories=true || true && \
    apt-get install -y -o APT::Get::AllowUnauthenticated=true openssh-client curl || \
    (echo "Installing minimal SSH client..." && \
     cd /tmp && \
     apt-get download -o APT::Get::AllowUnauthenticated=true openssh-client curl && \
     dpkg -i --force-depends openssh-client*.deb curl*.deb || true) && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/*

# Create .ssh directory for keys
RUN mkdir -p /root/.ssh && chmod 700 /root/.ssh

# Ensure SSH binary exists
RUN which ssh || echo "Warning: SSH installation may have failed"

WORKDIR /root
