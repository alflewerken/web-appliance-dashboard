import React, { useState } from 'react';
import { X, Wifi, Key, CheckCircle, AlertCircle, Loader } from 'lucide-react';

const SSHSetupModal = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    hostname: '',
    username: '',
    password: '',
    port: '22',
    keyName: 'dashboard',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [setupResult, setSetupResult] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async e => {
    e.preventDefault();

    if (!formData.hostname || !formData.username || !formData.password) {
      return;
    }

    setIsLoading(true);
    setSetupResult(null);
    setCurrentStep(0);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/ssh/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSetupResult(result);
        setCurrentStep(result.steps.length);

        // Erfolgsmeldung nach kurzer Verzögerung
        setTimeout(() => {
          if (onSuccess) {
            onSuccess(result);
          }
        }, 2000);
      } else {
        setSetupResult({
          success: false,
          error: result.error || 'Unbekannter Fehler',
          details: result.details,
          steps: result.steps || [],
        });
      }
    } catch (error) {
      setSetupResult({
        success: false,
        error: 'Netzwerkfehler',
        details: error.message,
        steps: [],
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h2>🔑 SSH-Verbindung einrichten</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          {!setupResult ? (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="hostname">
                  Remote-Host (IP/Hostname) <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="hostname"
                  name="hostname"
                  value={formData.hostname}
                  onChange={handleInputChange}
                  placeholder="z.B. 192.168.1.100 oder pi.local"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="username">
                  Benutzername <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="z.B. pi, ubuntu, admin"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">
                  Passwort <span className="required">*</span>
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="SSH-Passwort"
                  required
                />
                <small className="form-help">
                  Das Passwort wird nur für die einmalige Einrichtung verwendet
                  und nicht gespeichert.
                </small>
              </div>

              <div className="form-group">
                <label htmlFor="port">SSH-Port</label>
                <input
                  type="number"
                  id="port"
                  name="port"
                  value={formData.port}
                  onChange={handleInputChange}
                  placeholder="22"
                  min="1"
                  max="65535"
                />
              </div>

              <div className="form-group">
                <label htmlFor="keyName">Key-Name</label>
                <input
                  type="text"
                  id="keyName"
                  name="keyName"
                  value={formData.keyName}
                  onChange={handleInputChange}
                  placeholder="dashboard"
                />
                <small className="form-help">
                  Name für den SSH-Key (für mehrere Hosts)
                </small>
              </div>

              <div
                style={{
                  background: 'rgba(0, 122, 255, 0.1)',
                  border: '1px solid rgba(0, 122, 255, 0.3)',
                  borderRadius: '8px',
                  padding: '16px',
                  marginTop: '20px',
                }}
              >
                <h4
                  style={{
                    color: '#007AFF',
                    margin: '0 0 8px 0',
                    fontSize: '14px',
                  }}
                >
                  ℹ️ Was passiert:
                </h4>
                <ul
                  style={{
                    fontSize: '12px',
                    color: '#ffffff',
                    margin: 0,
                    paddingLeft: '16px',
                    lineHeight: '1.4',
                  }}
                >
                  <li>SSH-Key-Paar wird generiert</li>
                  <li>Public Key wird auf Remote-Host installiert</li>
                  <li>Passwortlose Anmeldung wird eingerichtet</li>
                  <li>Verbindung wird getestet</li>
                </ul>
              </div>
            </form>
          ) : (
            <div className="setup-result">
              {setupResult.success ? (
                <div className="success-result">
                  <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <CheckCircle size={48} style={{ color: '#34C759' }} />
                    <h3 style={{ color: '#34C759', margin: '12px 0 8px 0' }}>
                      SSH-Setup erfolgreich!
                    </h3>
                    <p style={{ color: '#ffffff', margin: 0 }}>
                      Verbindung zu {setupResult.hostname} wurde eingerichtet
                    </p>
                  </div>

                  <div className="setup-steps">
                    {setupResult.steps.map((step, index) => (
                      <div key={index} className="step-item">
                        <CheckCircle size={16} style={{ color: '#34C759' }} />
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>

                  <div
                    style={{
                      background: 'rgba(52, 199, 89, 0.1)',
                      border: '1px solid rgba(52, 199, 89, 0.3)',
                      borderRadius: '8px',
                      padding: '16px',
                      marginTop: '20px',
                    }}
                  >
                    <h4
                      style={{
                        color: '#34C759',
                        margin: '0 0 8px 0',
                        fontSize: '14px',
                      }}
                    >
                      🎯 Verwendung im Dashboard:
                    </h4>
                    <code
                      style={{
                        display: 'block',
                        background: 'rgba(0, 0, 0, 0.2)',
                        padding: '8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: '#ffffff',
                        wordBreak: 'break-all',
                      }}
                    >
                      {setupResult.sshFormat}
                    </code>
                  </div>
                </div>
              ) : (
                <div className="error-result">
                  <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <AlertCircle size={48} style={{ color: '#FF3B30' }} />
                    <h3 style={{ color: '#FF3B30', margin: '12px 0 8px 0' }}>
                      Setup fehlgeschlagen
                    </h3>
                    <p style={{ color: '#ffffff', margin: 0 }}>
                      {setupResult.error}
                    </p>
                  </div>

                  {setupResult.details && (
                    <div
                      style={{
                        background: 'rgba(255, 59, 48, 0.1)',
                        border: '1px solid rgba(255, 59, 48, 0.3)',
                        borderRadius: '8px',
                        padding: '16px',
                        marginBottom: '16px',
                      }}
                    >
                      <strong style={{ color: '#FF3B30' }}>Details:</strong>
                      <br />
                      <code style={{ fontSize: '12px', color: '#ffffff' }}>
                        {setupResult.details}
                      </code>
                    </div>
                  )}

                  {setupResult.steps && setupResult.steps.length > 0 && (
                    <div className="setup-steps">
                      <h4>Abgeschlossene Schritte:</h4>
                      {setupResult.steps.map((step, index) => (
                        <div key={index} className="step-item">
                          <CheckCircle size={16} style={{ color: '#34C759' }} />
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {isLoading && (
            <div className="loading-overlay">
              <div className="loading-content">
                <Loader size={32} className="spin" />
                <p>SSH-Verbindung wird eingerichtet...</p>
                <small>Dies kann einen Moment dauern</small>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {!setupResult && !isLoading && (
            <>
              <button type="button" className="btn-secondary" onClick={onClose}>
                Abbrechen
              </button>
              <button
                type="submit"
                className="btn-primary"
                onClick={handleSubmit}
                disabled={
                  !formData.hostname || !formData.username || !formData.password
                }
              >
                <Key size={20} />
                SSH einrichten
              </button>
            </>
          )}

          {setupResult && (
            <button type="button" className="btn-primary" onClick={onClose}>
              {setupResult.success ? 'Fertig' : 'Schließen'}
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        .setup-steps {
          margin: 16px 0;
        }

        .step-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 0;
          font-size: 14px;
          color: #ffffff;
        }

        .loading-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .loading-content {
          text-align: center;
          color: #ffffff;
        }

        .loading-content p {
          margin: 16px 0 8px 0;
          font-size: 16px;
          font-weight: 600;
        }

        .loading-content small {
          font-size: 14px;
          opacity: 0.8;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};

export default SSHSetupModal;
