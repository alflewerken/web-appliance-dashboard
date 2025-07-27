# Debugging Proxy Authentication Issue

## Aktueller Status

Wir haben folgende Änderungen vorgenommen:

1. **Frontend (JavaScript)**:
   - `apiService.js`: Neue Funktion `isPrivateIP()` um zu erkennen, ob eine IP im privaten Netzwerk ist
   - `proxyService.js`: Erweiterte Logik, die externe Services (öffentliche IPs) direkt aufruft
   - Die URLs sollten jetzt korrekt generiert werden mit Token als Query-Parameter

2. **Backend (Node.js)**:
   - `authDebug.js`: Debug-Middleware erstellt für besseres Logging
   - `applianceProxy.js`: Angepasst um die Debug-Middleware zu verwenden

## Das Problem

Wenn Sie eine interne URL über den Proxy aufrufen, erhalten Sie einen "Unauthorized" Fehler.

## Debugging-Schritte

### 1. Frontend-Token prüfen
Öffnen Sie die Browser-Konsole (F12) und führen Sie aus:
```javascript
// Token prüfen
const token = localStorage.getItem('token');
console.log('Token:', token);

// ProxyService testen
if (typeof proxyService !== 'undefined') {
    const testAppliance = { id: 45, ip_address: '192.168.1.100', port: 8080 };
    const url = proxyService.getProxyUrl(testAppliance.id);
    console.log('Generated URL:', url);
}
```

### 2. Backend-Logs prüfen
```bash
# Alle Logs anzeigen
docker logs -f $(docker ps -q -f name=backend)

# Nach AUTH-Logs suchen
docker logs $(docker ps -q -f name=backend) 2>&1 | grep "AUTH DEBUG"
```

### 3. Direkt testen
```bash
# Mit Token im Query
curl "http://localhost:9080/api/appliances/45/proxy/?token=YOUR_TOKEN_HERE"

# Mit Token im Header
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" "http://localhost:9080/api/appliances/45/proxy/"
```

## Vermutete Ursachen

1. **Build nicht vollständig**: Das Frontend wurde neu gebaut, aber möglicherweise wurde der neue Bundle nicht in den Nginx-Container kopiert
2. **Route-Konflikt**: Die Proxy-Route wird möglicherweise von einer anderen Route überschrieben
3. **Token-Format**: Der Token wird möglicherweise nicht korrekt aus dem Query-Parameter extrahiert

## Nächste Schritte

1. **Frontend-Bundle kopieren**:
```bash
docker cp /Users/alflewerken/Desktop/web-appliance-dashboard/frontend/build/. $(docker ps -q -f name=webserver):/usr/share/nginx/html/
```

2. **Backend vollständig neu bauen**:
```bash
cd /Users/alflewerken/Desktop/web-appliance-dashboard
docker-compose build backend
docker-compose up -d backend
```

3. **Browser-Cache leeren**:
- Cmd+Shift+R (Mac) oder Ctrl+Shift+R (Windows/Linux)
- Oder: Entwicklertools öffnen → Netzwerk-Tab → "Cache deaktivieren" aktivieren

## Alternative Lösung

Falls das Problem weiterhin besteht, können wir einen Cookie-basierten Ansatz implementieren:

1. Beim Login wird der Token auch als HttpOnly-Cookie gesetzt
2. Der Proxy liest dann automatisch den Cookie
3. Keine Query-Parameter mehr nötig

Dies wäre sicherer und würde das Problem umgehen.
