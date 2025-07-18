#!/bin/bash
# Entferne alle Terminal-Handler Überschreibungen

cd "$(dirname "$0")"

echo "Entferne alle Terminal-Handler Überschreibungen..."
echo ""

# Lösche alle Terminal-Handler Dateien
echo "1. Lösche Handler-Dateien..."
rm -f src/*terminal*.js 2>/dev/null
rm -f src/*handler*.js 2>/dev/null
rm -f src/hide-terminal-modal-css.js 2>/dev/null
rm -f src/ipc-test-handler.js 2>/dev/null

echo "   Gelöscht:"
echo "   - Alle terminal-handler.js Dateien"
echo "   - Alle spezial-handler.js Dateien"
echo "   - CSS Modal Hider"
echo "   - IPC Test Handler"
echo ""

echo "2. Bereinige main.js..."
echo "   Die main.js muss manuell bereinigt werden."
echo "   Entferne:"
echo "   - Alle terminalHandlers imports"
echo "   - Alle Handler Injections"
echo "   - Spezielle will-navigate Events"
echo "   - Terminal-spezifische Window Open Handler"
echo ""

echo "3. Nächste Schritte:"
echo "   - Bearbeite src/main.js"
echo "   - Entferne alle Terminal-Handler Code"
echo "   - Starte App neu"
echo "   - Terminal sollte wie im Hauptprojekt funktionieren"
echo ""

# Liste verbleibende Dateien
echo "4. Verbleibende src/ Dateien:"
ls -la src/
