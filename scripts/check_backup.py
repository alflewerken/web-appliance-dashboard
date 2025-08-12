#!/usr/bin/env python3

import json
import subprocess
import sys

def run_db_query(query):
    """Führt eine Datenbankabfrage aus"""
    cmd = [
        "docker", "compose", "exec", "-T", "database",
        "mariadb", "-u", "dashboard_user", 
        "-pzhEaHMuUdD99NHeN9Y5Uz+PU2MAHq+jO",
        "appliance_dashboard", "-e", query, "-N"
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, cwd="/Users/alflewerken/Desktop/web-appliance-dashboard")
        if result.returncode == 0:
            return result.stdout.strip()
        else:
            print(f"Fehler bei Query: {result.stderr}")
            return None
    except Exception as e:
        print(f"Fehler: {e}")
        return None

# Backup laden
with open('/Users/alflewerken/Desktop/web-appliance-dashboard/my-data/backup.json', 'r') as f:
    backup = json.load(f)

print("=" * 80)
print("BACKUP vs DATENBANK VERGLEICH")
print("=" * 80)
print(f"Backup erstellt: {backup['created_at']}")
print(f"Backup Version: {backup['version']}")
print()

# Tabellen im Backup zählen
backup_tables = {}
for table_name, data in backup['data'].items():
    if isinstance(data, list):
        backup_tables[table_name] = len(data)

# Datenbank-Tabellen abfragen
db_tables_result = run_db_query("SHOW TABLES;")
if db_tables_result:
    db_tables = db_tables_result.split('\n')
else:
    print("Fehler: Konnte Tabellen nicht abrufen")
    sys.exit(1)

# Datensätze in DB zählen
db_counts = {}
for table in db_tables:
    if table and table not in ['migrations', 'backup_metadata']:
        count_result = run_db_query(f"SELECT COUNT(*) FROM {table};")
        if count_result:
            db_counts[table] = int(count_result)

print(f"\n{'Tabelle':<35} {'Backup':>10} {'Datenbank':>10} {'Status':>10}")
print("-" * 70)

all_ok = True
for table in sorted(set(backup_tables.keys()) | set(db_counts.keys())):
    backup_count = backup_tables.get(table, 0)
    db_count = db_counts.get(table, 0)
    
    if backup_count == db_count:
        status = "✅"
    else:
        status = f"❌ ({db_count - backup_count:+d})"
        all_ok = False
    
    print(f"{table:<35} {backup_count:>10} {db_count:>10} {status:>10}")

print("-" * 70)

if all_ok:
    print("\n✅ ALLE DATEN SIND VOLLSTÄNDIG IN DER DATENBANK VORHANDEN!")
else:
    print("\n⚠️  Es gibt Unterschiede zwischen Backup und Datenbank!")
    
# Zusammenfassung
print(f"\nZusammenfassung:")
print(f"  Backup Einträge gesamt: {sum(backup_tables.values())}")
print(f"  Datenbank Einträge gesamt: {sum(db_counts.values())}")
