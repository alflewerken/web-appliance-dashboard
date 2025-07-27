#!/bin/bash

echo "Testing macOS App Terminal..."
echo ""

# Check if ttyd container is running
echo "1. Checking ttyd container:"
docker ps | grep wad_app_ttyd

echo ""
echo "2. Testing terminal endpoint directly on ttyd port:"
curl -s -o /dev/null -w "   ttyd direct (7682): %{http_code}\n" http://localhost:7682/

echo ""
echo "3. Testing terminal endpoint through nginx:"
curl -s -o /dev/null -w "   nginx proxy (9081): %{http_code}\n" http://localhost:9081/terminal/

echo ""
echo "4. Testing with full URL as used by iframe:"
curl -s -o /dev/null -w "   full URL: %{http_code}\n" http://localhost:9081/terminal/?

echo ""
echo "5. Checking nginx logs:"
docker logs wad_app_webserver --tail 10 2>&1 | grep terminal || echo "   No terminal requests in logs"

echo ""
echo "6. Checking ttyd logs:"
docker logs wad_app_ttyd --tail 10

echo ""
echo "7. Testing if nginx container can reach ttyd:"
docker exec wad_app_webserver sh -c "wget -O /dev/null -q http://wad_app_ttyd:7681/ && echo '   ✓ nginx can reach ttyd' || echo '   ✗ nginx cannot reach ttyd'"
