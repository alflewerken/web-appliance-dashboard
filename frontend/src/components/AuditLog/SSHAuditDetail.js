import React, { useState, useEffect } from 'react';
import { GitBranch, RefreshCw, RotateCcw, Eye, Database } from 'lucide-react';
import axios from '../../utils/axiosConfig';
import './SSHAuditDetail.css';

const SSHAuditDetail = ({ logEntry, onClose, onRestore, onRevert }) => {
  const [hostHistory, setHostHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showComparison, setShowComparison] = useState(true);

  // Debug logging
  if (logEntry?.details) {
    const details =
      typeof logEntry.details === 'string'
        ? JSON.parse(logEntry.details)
        : logEntry.details;
    }

  // Field name translations
  const getFieldLabel = field => {
    const labels = {
      hostname: 'Hostname',
      host: 'Host',
      username: 'Benutzername',
      port: 'Port',
      key_name: 'Schlüsselname',
      is_active: 'Aktiv',
      deleted_at: 'Gelöscht am',
      deleted_by: 'Gelöscht von',
    };
    return labels[field] || field;
  };

  useEffect(() => {
    if (logEntry?.resource_type === 'ssh_host' && logEntry?.resource_id) {
      fetchHostHistory();
    }
  }, [logEntry]);

  const fetchHostHistory = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `/api/ssh/hosts/${logEntry.resource_id}/history`
      );
      setHostHistory(response.data.history || []);
    } catch (error) {
      console.error('Error fetching host history:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderComparison = () => {
    if (!logEntry?.details) return null;

    const details =
      typeof logEntry.details === 'string'
        ? JSON.parse(logEntry.details)
        : logEntry.details;

    // Handle update action with old_data and new_data
    if (
      (logEntry.action === 'ssh_host_update' ||
        logEntry.action === 'ssh_host_updated') &&
      details.old_data &&
      details.new_data
    ) {
      const changes = {};

      // Compare old and new data to find changes
      Object.keys(details.old_data).forEach(field => {
        if (details.old_data[field] !== details.new_data[field]) {
          changes[field] = {
            old: details.old_data[field],
            new: details.new_data[field],
          };
        }
      });

      return (
        <div className="ssh-comparison-container">
          <div className="comparison-header">
            <GitBranch size={20} />
            <h3>Änderungsvergleich</h3>
          </div>

          {/* Benutzerinformationen */}
          <div
            className="user-info"
            style={{
              padding: '8px 12px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '6px',
              marginBottom: '12px',
              fontSize: '13px',
              color: 'rgba(255, 255, 255, 0.7)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Eye size={14} />
              <span>
                Aktualisiert von:{' '}
                <strong>{details.updated_by || 'unbekannt'}</strong>
              </span>
            </div>
          </div>

          {/* Weitere Details Section */}
          <div
            style={{
              marginBottom: '16px',
              padding: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <h4
              style={{
                fontSize: '14px',
                fontWeight: '600',
                color: 'rgba(255, 255, 255, 0.8)',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Database size={16} />
              Weitere Details
            </h4>

            {/* Old Data */}
            <div style={{ marginBottom: '12px' }}>
              <h5
                style={{
                  fontSize: '13px',
                  fontWeight: '500',
                  color: 'rgba(255, 255, 255, 0.6)',
                  marginBottom: '8px',
                }}
              >
                Old Data:
              </h5>
              <div
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  padding: '8px',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
              >
                {Object.entries(details.old_data).map(([field, value]) => (
                  <div key={field} style={{ marginBottom: '4px' }}>
                    <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                      {getFieldLabel(field)}:
                    </span>{' '}
                    <span style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* New Data */}
            <div>
              <h5
                style={{
                  fontSize: '13px',
                  fontWeight: '500',
                  color: 'rgba(255, 255, 255, 0.6)',
                  marginBottom: '8px',
                }}
              >
                New Data:
              </h5>
              <div
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  padding: '8px',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
              >
                {Object.entries(details.new_data).map(([field, value]) => (
                  <div key={field} style={{ marginBottom: '4px' }}>
                    <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                      {getFieldLabel(field)}:
                    </span>{' '}
                    <span style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Änderungen als Vergleich */}
          {Object.keys(changes).length > 0 && (
            <>
              <h4
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'rgba(255, 255, 255, 0.8)',
                  marginBottom: '12px',
                }}
              >
                Geänderte Felder:
              </h4>
              <div className="comparison-content">
                {Object.entries(changes).map(([field, change]) => (
                  <div key={field} className="comparison-row">
                    <div className="field-name">{getFieldLabel(field)}:</div>
                    <div className="field-values">
                      <span className="old-value">{change.old}</span>
                      <span className="arrow">→</span>
                      <span className="new-value">{change.new}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      );
    }

    // Handle legacy format with action_type
    if (details.action_type === 'update' && details.changes) {
      return (
        <div className="ssh-comparison-container">
          <div className="comparison-header">
            <GitBranch size={20} />
            <h3>Änderungsvergleich</h3>
          </div>
          <div className="comparison-content">
            {Object.entries(details.changes).map(([field, change]) => (
              <div key={field} className="comparison-row">
                <div className="field-name">{getFieldLabel(field)}:</div>
                <div className="field-values">
                  <span className="old-value">{change.old}</span>
                  <span className="arrow">→</span>
                  <span className="new-value">{change.new}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Handle delete action
    if (
      (logEntry.action === 'ssh_host_delete' && details.deleted_host) ||
      (details.action_type === 'delete' && details.deleted_host)
    ) {
      return (
        <div className="ssh-comparison-container deleted">
          <div className="comparison-header">
            <Database size={20} />
            <h3>Gelöschter Host</h3>
          </div>
          <div className="comparison-content">
            {Object.entries(details.deleted_host).map(([field, value]) => (
              <div key={field} className="comparison-row">
                <div className="field-name">{getFieldLabel(field)}:</div>
                <div className="field-value">{value}</div>
              </div>
            ))}
          </div>
          <div className="restore-button-container">
            <button
              className="restore-button"
              onClick={() => onRestore(logEntry.resource_id)}
            >
              <RotateCcw size={16} />
              Host wiederherstellen
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderHistoryTimeline = () => {
    if (hostHistory.length === 0) return null;

    return (
      <div className="history-timeline">
        <h3>Änderungsverlauf</h3>
        <div className="timeline">
          {hostHistory.map((entry, index) => (
            <div key={entry.id} className={`timeline-entry ${entry.action}`}>
              <div className="timeline-marker"></div>
              <div className="timeline-content">
                <div className="timeline-header">
                  <span className="action-badge">{entry.action}</span>
                  <span className="timestamp">
                    {new Date(entry.changed_at).toLocaleString('de-DE')}
                  </span>
                </div>
                <div className="timeline-details">
                  <div className="changed-by">
                    von {entry.changed_by_username || 'System'}
                  </div>
                  {/* Revert button temporarily disabled - use main audit log restore button
                  {entry.change_details && (
                    <button
                      className="revert-button"
                      onClick={() => onRevert(logEntry.resource_id, entry.id)}
                      title="Auf diesen Stand zurücksetzen"
                    >
                      <RefreshCw size={14} />
                      Zurücksetzen
                    </button>
                  )}
                  */}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="ssh-audit-detail">
      {renderComparison()}
      {renderHistoryTimeline()}
    </div>
  );
};

export default SSHAuditDetail;
