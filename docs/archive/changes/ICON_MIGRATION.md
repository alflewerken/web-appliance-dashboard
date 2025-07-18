# Kategorie Icons Migration: Emojis → Lucide Icons

## Problem
Die Kategorien in den Einstellungen zeigen Emoji-Icons statt Lucide Icons an.

## Lösung
Die Migration konvertiert alle Emoji-Icons in den Kategorien zu Lucide Icon-Namen.

## Durchführung

### Option 1: SQL Migration (Empfohlen)
Führe das SQL-Skript aus:

```bash
# Im Docker Container
docker exec -it web-appliance-dashboard-mysql-1 mysql -u root -prootpassword appliance_dashboard < migrations/update_category_icons_to_lucide.sql

# Oder direkt in MySQL
mysql -u root -p appliance_dashboard < migrations/update_category_icons_to_lucide.sql
```

### Option 2: Node.js Script
Führe das Update-Script aus:

```bash
# Im Backend-Verzeichnis
cd backend
node scripts/updateCategoryIcons.js
```

## Icon Mapping

| Emoji | Lucide Icon | Verwendung |
|-------|-------------|------------|
| 💰 | DollarSign | Finanzen |
| ⚡ | Zap | Productivity |
| 📦 | Box | Mac Docker |
| 📊 | Activity | Monitoring |
| 📺 | Tv | Media |
| 🌐 | Globe | Alf |
| 📄 | FileText | Dokumentation |
| 🤖 | Brain | KI |
| 🏠 | Home | Smart Home |
| ☁️ | Cloud | Cloud Services |
| 🛡️ | Shield | Security |
| 🗃️ | Database | Databases |

## Hinweise

1. **Backup**: Erstelle vor der Migration ein Backup deiner Datenbank
2. **Frontend**: Das Frontend (SimpleIcon Component) unterstützt bereits Lucide Icons
3. **Neue Kategorien**: Werden automatisch mit Lucide Icons erstellt

## Überprüfung

Nach der Migration kannst du die Icons überprüfen:

```sql
SELECT name, icon, color FROM categories ORDER BY `order`;
```

## Rollback

Falls nötig, kannst du die Icons manuell zurücksetzen:

```sql
UPDATE categories SET icon = '💰' WHERE name = 'finanzen';
-- etc.
```
