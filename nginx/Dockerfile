# Simplified Nginx Docker image for Web Appliance Dashboard
FROM nginx:alpine

# Install additional packages for health checks
RUN apk add --no-cache curl

# Remove the default nginx config that causes conflicts
RUN rm -f /etc/nginx/conf.d/default.conf

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf
COPY conf.d/ /etc/nginx/conf.d/

# Copy static files and assets
COPY *.png *.ico *.svg /usr/share/nginx/html/
COPY manifest.json terminal-manifest.json /usr/share/nginx/html/
COPY *.html /usr/share/nginx/html/
COPY *.js /usr/share/nginx/html/
COPY theme-handler.js /usr/share/nginx/html/

# Create necessary directories
RUN mkdir -p /var/log/nginx /usr/share/nginx/html/static /usr/share/nginx/html/js /usr/share/nginx/html/locales

# Copy directories if they exist
COPY static/ /usr/share/nginx/html/static/
COPY js/ /usr/share/nginx/html/js/
COPY locales/ /usr/share/nginx/html/locales/

# Set proper permissions
RUN chown -R nginx:nginx /usr/share/nginx/html

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
    CMD curl -f http://localhost/health || exit 1

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
