#!/bin/bash

# Skript zum Umbenennen der Bilddateien von Deutsch nach Englisch
# Für das Web Appliance Dashboard Projekt

cd /Users/alflewerken/Desktop/web-appliance-dashboard/docs/user-manual/images

echo "🖼️  Benenne Bilddateien um..."

# Erstelle Backup-Verzeichnis
backup_dir="../images-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup_dir"

# Kopiere alle Dateien ins Backup
cp *.png *.jpeg "$backup_dir/" 2>/dev/null

# Umbenennen der Dateien
rename_file() {
    if [ -f "$1" ]; then
        mv "$1" "$2"
        echo "✅ $1 → $2"
    else
        echo "⚠️  $1 nicht gefunden"
    fi
}

# Hauptdateien die in README referenziert werden
rename_file "Benutzerverwaltung.png" "User Management.png"
rename_file "Service anlegen.png" "Create Service.png"
rename_file "Einstellungen Kategorien.png" "Settings Categories.png"
rename_file "Einstellungen Hintergrundbild.png" "Settings Background.png"
rename_file "Einstellungen Backup Restore.png" "Settings Backup Restore.png"

# Weitere Dateien
rename_file "Audit Log.png" "Audit Log.png" # Bleibt gleich
rename_file "Audit Log Aktion Auswahlmenu.png" "Audit Log Action Selection Menu.png"
rename_file "Audit Log Eintrag Service geändert.png" "Audit Log Entry Service Changed.png"
rename_file "Audit Log Resources Auswahlmenu.png" "Audit Log Resources Selection Menu.png"
rename_file "Benutzer bearbeiten.png" "Edit User.png"
rename_file "Desktop Ansicht.png" "Desktop View.png"
rename_file "Einstellungen SSH Remote Control.png" "Settings SSH Remote Control.png"
rename_file "Miniaur-Widget-Ansicht.png" "Miniature Widget View.png"
rename_file "Mobile.jpeg" "Mobile.jpeg" # Bleibt gleich
rename_file "Service-Card Detailansicht (grüner Statusbar für Service läuft).png" "Service Card Detail View (green statusbar service running).png"
rename_file "Service-Card ohne Details (roter Statusbar für Service läuft nicht).png" "Service Card without Details (red statusbar service not running).png"
rename_file "iPad Ansicht.png" "iPad View.png"
rename_file "Custom Commands.jpeg" "Custom Commands.jpeg" # Bleibt gleich

echo ""
echo "✅ Umbenennung abgeschlossen!"
echo "📁 Backups gespeichert in: $backup_dir"
echo ""
echo "⚠️  WICHTIG: Bitte prüfen Sie alle Referenzen in:"
echo "   - README.md"
echo "   - README.en.md" 
echo "   - docs/user-manual/index.html"
echo "   - Andere Dokumentationsdateien"
