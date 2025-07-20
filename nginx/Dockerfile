# Nginx with Lua JWT support for Guacamole proxy
FROM openresty/openresty:alpine

# Install required packages including perl for opm
RUN apk add --no-cache \
    curl \
    bash \
    openssl \
    perl \
    perl-dev \
    build-base

# Install Lua JWT library
RUN opm get SkyLothar/lua-resty-jwt

# Copy configuration files
COPY nginx.conf /etc/nginx/nginx.conf
COPY conf.d/ /etc/nginx/conf.d/

# Create log directory
RUN mkdir -p /var/log/nginx

# Expose port
EXPOSE 8070

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
    CMD curl -f http://localhost:8070/health || exit 1

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
