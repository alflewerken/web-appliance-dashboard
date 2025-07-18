# Entfernung von User-Badge und Logout-Button

## Änderungen

### AppHeader.js
1. **Import bereinigt**:
   - `LogOut` Icon entfernt
   - `useAuth` Hook Import entfernt

2. **Component Code**:
   - `const { user, logout } = useAuth();` entfernt
   - User-Control Div mit User-Badge und Logout-Button komplett entfernt

## Resultat
- Header zeigt nur noch: Suchfeld, Größen-Slider und Status-Toggle
- Cleaner, minimalistischer Header ohne User-spezifische Elemente
- Logout muss jetzt über die Sidebar erfolgen (falls dort noch vorhanden)

## CSS
- Die CSS-Klassen `.user-control`, `.user-name` und `.logout-button` bleiben in Auth.css erhalten
- Sie werden einfach nicht mehr verwendet und können bei Bedarf später entfernt werden
