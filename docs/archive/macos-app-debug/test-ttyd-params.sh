#!/bin/bash

echo "Testing ttyd with URL parameters..."
echo ""

# Test 1: Default parameters
echo "Test 1: Default (no parameters)"
echo "URL: http://localhost:7682/terminal/"
echo ""

# Test 2: Custom host
echo "Test 2: Custom host"
echo "URL: http://localhost:7682/terminal/?host=testhost&user=testuser&port=2222"
echo ""

# Test 3: With hostId
echo "Test 3: With hostId"  
echo "URL: http://localhost:7682/terminal/?hostId=1&host=mac&user=alflewerken&port=22"
echo ""

echo "Öffne diese URLs im Browser, um die Parameter-Übergabe zu testen."
echo ""
echo "Tipp: In der Mac-App wird automatisch die richtige URL mit Parametern generiert."
