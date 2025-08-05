import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Monitor, Download, Key, CheckCircle, Circle, Loader } from 'lucide-react';
import { getAuthHeaders } from '../utils/auth';
import '../styles/components/RustDeskSetupDialog.css';

function RustDeskSetupDialog({ isOpen, onClose, applianceName, applianceId, onInstall, onManualSave }) {
    const [selectedOption, setSelectedOption] = useState('install');
    const [manualId, setManualId] = useState('');
    const [manualPassword, setManualPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [installationStep, setInstallationStep] = useState(0);
    const [installationStatus, setInstallationStatus] = useState('');
    const [progressPercentage, setProgressPercentage] = useState(0);
    const [progressMessage, setProgressMessage] = useState('');

    const installationSteps = [
        { id: 1, title: 'Verbindung herstellen', description: 'SSH-Verbindung zum Remote-Host wird hergestellt...', progressRange: [0, 10] },
        { id: 2, title: 'System prüfen', description: 'Betriebssystem wird erkannt und Voraussetzungen geprüft...', progressRange: [10, 20] },
        { id: 3, title: 'RustDesk herunterladen', description: 'RustDesk wird heruntergeladen und installiert...', progressRange: [20, 60] },
        { id: 4, title: 'Konfiguration', description: 'RustDesk wird konfiguriert und ID wird ermittelt...', progressRange: [60, 70] },
        { id: 5, title: 'Passwort setzen', description: 'Zugriffspasswort wird automatisch gesetzt...', progressRange: [70, 90] },
        { id: 6, title: 'Berechtigungen prüfen', description: 'macOS-Berechtigungen werden überprüft...', progressRange: [90, 95] },
        { id: 7, title: 'Abschluss', description: 'Installation wird finalisiert...', progressRange: [95, 100] }
    ];

    // Update installation step based on progress
    useEffect(() => {
        const step = installationSteps.findIndex(step => 
            progressPercentage >= step.progressRange[0] && progressPercentage < step.progressRange[1]
        );
        if (step !== -1) {
            setInstallationStep(step);
        } else if (progressPercentage >= 100) {
            setInstallationStep(installationSteps.length - 1);
        }
    }, [progressPercentage]);

    // SSE connection for progress updates
    useEffect(() => {
        if (!isLoading || selectedOption !== 'install') return;

        const authHeaders = getAuthHeaders();
        const token = authHeaders.Authorization?.replace('Bearer ', '');
        const eventSource = new EventSource(`/api/sse/stream?token=${token}`);

        eventSource.addEventListener('rustdesk_progress', (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.applianceId === applianceId) {
                    setProgressPercentage(data.progress);
                    setProgressMessage(data.message);
                }
            } catch (err) {
                console.error('Error parsing SSE data:', err);
            }
        });

        eventSource.onerror = (error) => {
            console.error('SSE error:', error);
            eventSource.close();
        };

        return () => {
            eventSource.close();
        };
    }, [isLoading, selectedOption, applianceId]);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        setError('');
        setIsLoading(true);
        setProgressPercentage(0);
        setProgressMessage('');
        setInstallationStatus('Installation wird gestartet...');

        try {
            if (selectedOption === 'install') {
                const result = await onInstall();
                
                // Only close if installation was successful
                if (result) {
                    setProgressPercentage(100);
                    setInstallationStatus('Installation erfolgreich abgeschlossen!');
                    setTimeout(() => {
                        onClose();
                    }, 1500);
                }
            } else {
                if (!manualId || manualId.length !== 9 || !/^\d{9}$/.test(manualId)) {
                    setError('Bitte geben Sie eine gültige 9-stellige RustDesk ID ein');
                    setIsLoading(false);
                    return;
                }
                const result = await onManualSave(manualId, manualPassword);
                // Only close if save was successful
                if (result) {
                    onClose();
                }
            }
        } catch (err) {
            console.error('Dialog error:', err);
            setError(err.message || 'Ein Fehler ist aufgetreten');
            setProgressPercentage(0);
        } finally {
            setIsLoading(false);
        }
    };

    const dialogContent = (
        <div className="rustdesk-setup-overlay" onClick={onClose}>
            <div className="rustdesk-setup-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="dialog-header">
                    <h2>RustDesk Setup</h2>
                    <button className="close-button" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="dialog-content">
                    <p className="info-text">
                        RustDesk ist noch nicht für <strong>{applianceName}</strong> konfiguriert.
                        Wie möchten Sie fortfahren?
                    </p>

                    <div className="setup-options">
                        <label className={`option-card ${selectedOption === 'install' ? 'selected' : ''}`}>
                            <input
                                type="radio"
                                name="setup-option"
                                value="install"
                                checked={selectedOption === 'install'}
                                onChange={(e) => setSelectedOption(e.target.value)}
                            />
                            <div className="option-content">
                                <Download className="option-icon" size={24} />
                                <div className="option-text">
                                    <h3>RustDesk installieren</h3>
                                    <p>RustDesk wird automatisch auf dem Remote-Host installiert und die ID wird ermittelt.</p>
                                </div>
                            </div>
                        </label>

                        <label className={`option-card ${selectedOption === 'manual' ? 'selected' : ''}`}>
                            <input
                                type="radio"
                                name="setup-option"
                                value="manual"
                                checked={selectedOption === 'manual'}
                                onChange={(e) => setSelectedOption(e.target.value)}
                            />
                            <div className="option-content">
                                <Key className="option-icon" size={24} />
                                <div className="option-text">
                                    <h3>ID manuell eingeben</h3>
                                    <p>Geben Sie eine bestehende RustDesk ID und optional ein Passwort ein.</p>
                                </div>
                            </div>
                        </label>
                    </div>

                    {selectedOption === 'manual' && (
                        <div className="manual-input-section">
                            <div className="input-group">
                                <label htmlFor="rustdesk-id">RustDesk ID (9 Ziffern)</label>
                                <input
                                    type="text"
                                    id="rustdesk-id"
                                    value={manualId}
                                    onChange={(e) => setManualId(e.target.value.replace(/\D/g, '').slice(0, 9))}
                                    placeholder="123456789"
                                    maxLength="9"
                                    className="id-input"
                                />
                            </div>
                            <div className="input-group">
                                <label htmlFor="rustdesk-password">Passwort (optional)</label>
                                <input
                                    type="password"
                                    id="rustdesk-password"
                                    value={manualPassword}
                                    onChange={(e) => setManualPassword(e.target.value)}
                                    placeholder="Passwort eingeben"
                                    className="password-input"
                                />
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="error-message" style={{ marginTop: '15px' }}>
                            <strong>Fehler:</strong> {error}
                        </div>
                    )}
                    
                    {selectedOption === 'install' && isLoading && (
                        <div className="installation-progress" style={{ marginTop: '20px' }}>
                            <h4 style={{ marginBottom: '15px', color: '#333' }}>Installationsfortschritt</h4>
                            
                            {/* Progress bar */}
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ 
                                    width: '100%', 
                                    height: '20px', 
                                    backgroundColor: '#e0e0e0', 
                                    borderRadius: '10px',
                                    overflow: 'hidden'
                                }}>
                                    <div style={{ 
                                        width: `${progressPercentage}%`, 
                                        height: '100%', 
                                        backgroundColor: '#1976d2',
                                        transition: 'width 0.3s ease',
                                        borderRadius: '10px'
                                    }} />
                                </div>
                                <div style={{ 
                                    textAlign: 'center', 
                                    marginTop: '5px', 
                                    fontSize: '0.9em', 
                                    color: '#666' 
                                }}>
                                    {progressPercentage}% - {progressMessage || 'Wird verarbeitet...'}
                                </div>
                            </div>
                            
                            <div className="progress-steps">
                                {installationSteps.map((step, index) => (
                                    <div key={step.id} className="progress-step" style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        marginBottom: '12px',
                                        opacity: index > installationStep ? 0.5 : 1
                                    }}>
                                        <div style={{ marginRight: '12px' }}>
                                            {index < installationStep ? (
                                                <CheckCircle size={20} color="#4CAF50" />
                                            ) : index === installationStep ? (
                                                <Loader size={20} color="#1976d2" className="spinning" />
                                            ) : (
                                                <Circle size={20} color="#ccc" />
                                            )}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: index === installationStep ? 'bold' : 'normal' }}>
                                                {step.title}
                                            </div>
                                            {index === installationStep && (
                                                <div style={{ fontSize: '0.85em', color: '#666', marginTop: '2px' }}>
                                                    {progressMessage || step.description}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {installationStatus && progressPercentage === 100 && (
                                <div style={{ 
                                    marginTop: '15px', 
                                    padding: '10px', 
                                    backgroundColor: '#E8F5E9', 
                                    borderRadius: '4px',
                                    color: '#2E7D32',
                                    textAlign: 'center'
                                }}>
                                    {installationStatus}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="dialog-footer">
                    <button 
                        className="cancel-button" 
                        onClick={onClose}
                        disabled={isLoading}
                    >
                        Abbrechen
                    </button>
                    <button 
                        className="submit-button" 
                        onClick={handleSubmit}
                        disabled={isLoading || (selectedOption === 'manual' && !manualId)}
                    >
                        {isLoading ? 'Wird verarbeitet...' : 
                         selectedOption === 'install' ? 'Installieren' : 'Speichern'}
                    </button>
                </div>
            </div>
        </div>
    );

    // Render the dialog in a portal to ensure it appears above everything
    return ReactDOM.createPortal(
        dialogContent,
        document.body
    );
}

export default RustDeskSetupDialog;
