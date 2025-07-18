import React, { useState, useEffect } from 'react';
import { Key, Shield, Server, Settings } from 'lucide-react';
import SSHService from '../services/sshService';

const SSHSetupWidget = ({ onOpenManager }) => {
  const [setupStatus, setSetupStatus] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSetupStatus();
  }, []);

  const loadSetupStatus = async () => {
    setIsLoading(true);
    try {
      const status = await SSHService.getSetupStatus();
      setSetupStatus(status);
    } catch (error) {
      // Fallback status wenn API fehlschlägt
      setSetupStatus({
        ssh_configured: false,
        total_hosts: 0,
        total_keys: 0,
        setup_complete: false,
        hosts: [],
        recommendations: [
          {
            type: 'setup',
            message: 'SSH Remote Control einrichten',
            priority: 'high',
          },
        ],
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="ssh-widget loading">
        <div className="loading-content">
          <div className="loading-icon"></div>
          <div className="loading-text">
            <div className="loading-line short"></div>
            <div className="loading-line long"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!setupStatus) {
    return (
      <div className="ssh-widget error">
        <div className="widget-header">
          <div className="header-content">
            <div className="status-icon unconfigured">
              <Key size={20} />
            </div>
            <div className="header-info">
              <h3>SSH Remote Control</h3>
              <p>Fehler beim Laden der SSH-Konfiguration</p>
            </div>
          </div>
        </div>
        <div className="widget-content">
          <p>
            Die SSH-Konfiguration konnte nicht geladen werden. Bitte versuchen
            Sie es später erneut.
          </p>
          <button
            onClick={() => {
              try {
                if (onOpenManager && typeof onOpenManager === 'function') {
                  onOpenManager();
                } else {
                }
              } catch (error) {}
            }}
            className="action-button setup"
          >
            SSH-Manager öffnen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ssh-widget">
      <div className="widget-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="header-content">
          <div
            className={`status-icon ${setupStatus.ssh_configured ? 'configured' : 'unconfigured'}`}
          >
            {setupStatus.ssh_configured ? (
              <Shield size={20} />
            ) : (
              <Key size={20} />
            )}
          </div>
          <div className="header-info">
            <h3>SSH Remote Control</h3>
            <p>
              {setupStatus.ssh_configured
                ? `${setupStatus.total_hosts} Host(s) konfiguriert`
                : 'Noch nicht eingerichtet'}
            </p>
          </div>
        </div>
        <div className="expand-arrow">{isExpanded ? '−' : '+'}</div>
      </div>

      {isExpanded && (
        <div className="widget-content">
          {setupStatus.ssh_configured ? (
            <div className="configured-content">
              <div className="status-grid">
                <div className="status-item">
                  <span className="label">Konfigurierte Hosts:</span>
                  <span className="value">{setupStatus.total_hosts}</span>
                </div>
                <div className="status-item">
                  <span className="label">Status:</span>
                  <span className="value success">✓ Aktiv</span>
                </div>
              </div>

              {setupStatus.hosts.length > 0 && (
                <div className="hosts-preview">
                  <p className="hosts-label">Hosts:</p>
                  <div className="hosts-list">
                    {setupStatus.hosts.slice(0, 3).map((host, index) => (
                      <div key={index} className="host-item">
                        <Server size={12} />
                        <code>{host}</code>
                      </div>
                    ))}
                    {setupStatus.hosts.length > 3 && (
                      <p className="hosts-more">
                        ... und {setupStatus.hosts.length - 3} weitere
                      </p>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  try {
                    if (onOpenManager && typeof onOpenManager === 'function') {
                      onOpenManager();
                    } else {
                    }
                  } catch (error) {}
                }}
                className="action-button primary"
              >
                SSH-Manager öffnen
              </button>
            </div>
          ) : (
            <div className="unconfigured-content">
              <p className="description">
                SSH Remote Control ermöglicht es, Services auf anderen Geräten
                direkt vom Dashboard aus zu steuern.
              </p>

              {setupStatus.recommendations.length > 0 && (
                <div className="recommendation">
                  <p>{setupStatus.recommendations[0].message}</p>
                </div>
              )}

              <button
                onClick={() => {
                  try {
                    if (onOpenManager && typeof onOpenManager === 'function') {
                      onOpenManager();
                    } else {
                    }
                  } catch (error) {}
                }}
                className="action-button setup"
              >
                SSH-Setup starten
              </button>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .ssh-widget {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          overflow: hidden;
          transition: all 0.2s ease;
        }

        .ssh-widget:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .ssh-widget.loading {
          padding: 16px;
        }

        .loading-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .loading-icon {
          width: 40px;
          height: 40px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          animation: pulse 1.5s ease-in-out infinite;
        }

        .loading-text {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .loading-line {
          height: 12px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          animation: pulse 1.5s ease-in-out infinite;
        }

        .loading-line.short {
          width: 120px;
        }

        .loading-line.long {
          width: 180px;
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        .widget-header {
          padding: 16px;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .widget-header:hover {
          background: rgba(255, 255, 255, 0.03);
        }

        .header-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .status-icon {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .status-icon.configured {
          background: rgba(52, 199, 89, 0.1);
          color: #34c759;
        }

        .status-icon.unconfigured {
          background: rgba(255, 193, 7, 0.1);
          color: #ffc107;
        }

        .header-info {
          flex: 1;
        }

        .header-info h3 {
          color: #ffffff;
          margin: 0 0 4px 0;
          font-size: 16px;
          font-weight: 600;
        }

        .header-info p {
          color: rgba(255, 255, 255, 0.7);
          margin: 0;
          font-size: 14px;
        }

        .expand-arrow {
          color: rgba(255, 255, 255, 0.4);
          font-size: 18px;
          font-weight: bold;
          transition: transform 0.2s ease;
        }

        .widget-content {
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          padding: 16px;
        }

        .configured-content {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .status-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .status-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .status-item .label {
          color: rgba(255, 255, 255, 0.7);
          font-size: 12px;
          font-weight: 500;
        }

        .status-item .value {
          color: #ffffff;
          font-size: 14px;
          font-weight: 600;
        }

        .status-item .value.success {
          color: #34c759;
        }

        .hosts-preview {
          margin-top: 8px;
        }

        .hosts-label {
          color: rgba(255, 255, 255, 0.7);
          font-size: 12px;
          font-weight: 500;
          margin: 0 0 8px 0;
        }

        .hosts-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .host-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
        }

        .host-item svg {
          color: rgba(255, 255, 255, 0.4);
        }

        .host-item code {
          background: rgba(0, 0, 0, 0.2);
          padding: 2px 6px;
          border-radius: 4px;
          color: rgba(255, 255, 255, 0.9);
        }

        .hosts-more {
          color: rgba(255, 255, 255, 0.5);
          font-size: 11px;
          margin: 4px 0 0 0;
        }

        .unconfigured-content {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .description {
          color: rgba(255, 255, 255, 0.7);
          font-size: 14px;
          line-height: 1.4;
          margin: 0;
        }

        .recommendation {
          background: rgba(255, 193, 7, 0.1);
          border: 1px solid rgba(255, 193, 7, 0.3);
          border-radius: 8px;
          padding: 12px;
        }

        .recommendation p {
          color: #ffc107;
          font-size: 13px;
          margin: 0;
        }

        .action-button {
          width: 100%;
          padding: 12px 16px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .action-button.primary {
          background: #007aff;
          color: white;
        }

        .action-button.primary:hover {
          background: #0056cc;
        }

        .action-button.setup {
          background: #34c759;
          color: white;
        }

        .action-button.setup:hover {
          background: #248a3d;
        }

        @media (max-width: 768px) {
          .status-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default SSHSetupWidget;
