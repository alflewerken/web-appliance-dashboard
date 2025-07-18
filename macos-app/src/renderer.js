// Warte bis DOM geladen ist
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM geladen');
    
    // UI Elemente
    const statusIndicator = document.getElementById('statusIndicator');
    const statusDot = statusIndicator.querySelector('.status-dot');
    const statusText = statusIndicator.querySelector('.status-text');
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const restartBtn = document.getElementById('restartBtn');
    const containerList = document.getElementById('containerList');
    const logsOutput = document.getElementById('logsOutput');
    const logService = document.getElementById('logService');
    const refreshLogsBtn = document.getElementById('refreshLogsBtn');
    const setupOverlay = document.getElementById('setupOverlay');

    console.log('Renderer geladen, setupOverlay:', setupOverlay);

    // Zeige Setup-Overlay initial beim Laden
    if (setupOverlay) {
        console.log('Zeige Setup-Overlay initial');
        setupOverlay.style.display = 'flex';
        
        // Setze explizit die Styles für das Overlay
        setupOverlay.style.position = 'fixed';
        setupOverlay.style.top = '0';
        setupOverlay.style.left = '0';
        setupOverlay.style.width = '100%';
        setupOverlay.style.height = '100%';
        setupOverlay.style.backgroundColor = 'rgba(0,0,0,0.8)';
        setupOverlay.style.zIndex = '1000';
        setupOverlay.style.alignItems = 'center';
        setupOverlay.style.justifyContent = 'center';
    }

    // Status Update Funktion
    async function updateStatus() {
        // Update Setup-Status wenn Overlay sichtbar ist
        const setupStatus = document.getElementById('setupStatus');
        if (setupOverlay && setupOverlay.style.display === 'flex' && setupStatus) {
            setupStatus.innerHTML = '<p>🔄 Prüfe Docker-Status...</p>';
        }
        
        try {
            const status = await window.electronAPI.docker.getStatus();
            
            // Verstecke Setup-Overlay nach erstem erfolgreichen Status-Check oder bei Fehler
            if (setupOverlay && setupOverlay.style.display === 'flex') {
                console.log('Verstecke Setup-Overlay');
                setupOverlay.style.display = 'none';
            }
            
            if (status.error) {
                statusDot.className = 'status-dot stopped';
                statusText.textContent = 'Docker Fehler';
                
                // Spezielle Behandlung für Projekt nicht gefunden
                if (status.error.includes('Projekt nicht gefunden')) {
                    containerList.innerHTML = `
                        <div class="error-message">
                            <p><strong>Web Appliance Dashboard Projekt nicht gefunden!</strong></p>
                            <p>Die App konnte das Haupt-Projekt nicht automatisch finden.</p>
                            <p><strong>Bitte stellen Sie sicher, dass:</strong></p>
                            <ul>
                                <li>Das Projekt im Ordner <code>web-appliance-dashboard</code> liegt</li>
                                <li>Es sich auf dem Desktop oder in Documents befindet</li>
                                <li>Die Ordnerstruktur intakt ist (backend, frontend, docker-compose.yml)</li>
                            </ul>
                            <p><strong>Erwartete Projekt-Struktur:</strong></p>
                            <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px;">
web-appliance-dashboard/
├── backend/
├── frontend/
├── docker-compose.yml
└── ...</pre>
                        </div>
                    `;
                } else {
                    // Zeige normale Fehlermeldung
                    containerList.innerHTML = `
                        <div class="error-message">
                            <p><strong>Fehler:</strong> ${status.error}</p>
                            ${status.details ? `<p><strong>Details:</strong> ${status.details}</p>` : ''}
                            ${status.path ? `<p><strong>Projekt-Pfad:</strong> ${status.path}</p>` : ''}
                            <p><strong>Lösungsvorschläge:</strong></p>
                            <ul>
                                <li>Stellen Sie sicher, dass Docker Desktop läuft</li>
                                <li>Prüfen Sie, ob das Docker-Projekt im richtigen Pfad liegt</li>
                                <li>Versuchen Sie die Container manuell zu starten</li>
                            </ul>
                        </div>
                    `;
                }
                
                startBtn.disabled = false;
                stopBtn.disabled = true;
                restartBtn.disabled = true;
                return;
            }
            
            if (status.running) {
                statusDot.className = 'status-dot running';
                statusText.textContent = 'Alle Container laufen';
                startBtn.disabled = true;
                stopBtn.disabled = false;
                restartBtn.disabled = false;
            } else {
                statusDot.className = 'status-dot stopped';
                statusText.textContent = 'Container gestoppt';
                startBtn.disabled = false;
                stopBtn.disabled = true;
                restartBtn.disabled = true;
            }

            // Container Liste aktualisieren
            if (status.containers && status.containers.length > 0) {
                containerList.innerHTML = status.containers.map(container => `
                    <div class="container-item">
                        <span class="container-name">${container.name}</span>
                        <span class="container-state ${container.state}">${container.state}</span>
                    </div>
                `).join('');
            } else if (status.message) {
                containerList.innerHTML = `<p class="info-message">${status.message}</p>`;
            } else {
                containerList.innerHTML = '<p class="loading">Keine Container gefunden</p>';
            }
        } catch (error) {
            console.error('Fehler beim Status-Update:', error);
            statusDot.className = 'status-dot stopped';
            statusText.textContent = 'Fehler beim Abrufen des Status';
            containerList.innerHTML = `<p class="error-message">Fehler: ${error.message}</p>`;
            
            // Verstecke Setup-Overlay auch bei Fehler
            if (setupOverlay && setupOverlay.style.display === 'flex') {
                console.log('Verstecke Setup-Overlay nach Fehler');
                setupOverlay.style.display = 'none';
            }
        }
    }

    // Docker Befehle
    async function startDocker() {
        startBtn.disabled = true;
        statusText.textContent = 'Starte Container...';
        logsOutput.textContent = 'Starte Docker Container...\n';
        
        try {
            await window.electronAPI.docker.start();
            setTimeout(updateStatus, 2000);
        } catch (error) {
            console.error('Fehler beim Starten:', error);
            logsOutput.textContent += '\nFehler: ' + error.message;
        } finally {
            startBtn.disabled = false;
        }
    }

    async function stopDocker() {
        stopBtn.disabled = true;
        statusText.textContent = 'Stoppe Container...';
        logsOutput.textContent = 'Stoppe Docker Container...\n';
        
        try {
            await window.electronAPI.docker.stop();
            setTimeout(updateStatus, 2000);
        } catch (error) {
            console.error('Fehler beim Stoppen:', error);
            logsOutput.textContent += '\nFehler: ' + error.message;
        } finally {
            stopBtn.disabled = false;
        }
    }

    async function restartDocker() {
        restartBtn.disabled = true;
        statusText.textContent = 'Starte Container neu...';
        logsOutput.textContent = 'Starte Docker Container neu...\n';
        
        try {
            await window.electronAPI.docker.restart();
            setTimeout(updateStatus, 2000);
        } catch (error) {
            console.error('Fehler beim Neustart:', error);
            logsOutput.textContent += '\nFehler: ' + error.message;
        } finally {
            restartBtn.disabled = false;
        }
    }

    async function refreshLogs() {
        try {
            const result = await window.electronAPI.docker.getLogs(logService.value);
            if (result.logs) {
                logsOutput.textContent = result.logs;
                logsOutput.scrollTop = logsOutput.scrollHeight;
            } else if (result.error) {
                logsOutput.textContent = 'Fehler beim Abrufen der Logs: ' + result.error;
            }
        } catch (error) {
            console.error('Fehler beim Abrufen der Logs:', error);
            logsOutput.textContent = 'Fehler: ' + error.message;
        }
    }
    
    // Make refreshLogs globally available
    window.refreshLogs = refreshLogs;

    // Event Listeners
    startBtn.addEventListener('click', startDocker);
    stopBtn.addEventListener('click', stopDocker);
    restartBtn.addEventListener('click', restartDocker);
    refreshLogsBtn.addEventListener('click', refreshLogs);

    // Docker Output Listener
    window.electronAPI.docker.onOutput((event, data) => {
        logsOutput.textContent += data;
        logsOutput.scrollTop = logsOutput.scrollHeight;
    });

    // Initial Status Update
    updateStatus();

    // Regelmäßige Status-Updates
    setInterval(updateStatus, 10000); // Alle 10 Sekunden

}); // Ende von DOMContentLoaded
