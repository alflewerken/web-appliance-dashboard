#!/bin/bash
# Debug-Version des SSH-Wrappers

# Debug-Ausgabe
echo "=================================================================================="
echo "DEBUG: Terminal Connection Diagnostics"
echo "=================================================================================="
echo ""
echo "Environment Variables:"
echo "  QUERY_STRING: '$QUERY_STRING'"
echo "  REQUEST_URI: '$REQUEST_URI'"
echo "  HTTP_REFERER: '$HTTP_REFERER'"
echo ""

# Funktion zum Parsen von Query-Parametern
get_query_param() {
    local param=$1
    echo "$QUERY_STRING" | grep -oE "(^|&)$param=([^&]*)" | cut -d= -f2 | sed 's/%20/ /g' | sed 's/%40/@/g'
}

# Parse URL-Parameter
URL_HOST=$(get_query_param "host")
URL_USER=$(get_query_param "user")
URL_PORT=$(get_query_param "port")
URL_HOST_ID=$(get_query_param "hostId")

echo "Parsed Parameters:"
echo "  host: '$URL_HOST'"
echo "  user: '$URL_USER'"
echo "  port: '$URL_PORT'"
echo "  hostId: '$URL_HOST_ID'"
echo ""
echo "Press any key to continue..."
read -n 1
