import React, { useState } from 'react';
import {
  Server,
  ChevronRight,
  Edit2,
  Trash2,
  History,
  RotateCcw,
  MoreVertical,
  Terminal,
  Play,
  Activity,
  Zap,
} from 'lucide-react';
import './MobileSSHHostCard.css';

const MobileSSHHostCard = ({
  host,
  onEdit,
  onDelete,
  onRestore,
  onShowHistory,
  onConnect,
  onDiagnose,
  onTest,
}) => {
  const [showActions, setShowActions] = useState(false);

  const handleActionClick = (action) => {
    action();
    setShowActions(false);
  };

  return (
    <div className={`mobile-ssh-card ${host.deleted_at ? 'deleted' : ''}`}>
      <div className="mobile-ssh-card-main">
        <div className="mobile-ssh-card-icon">
          <Server size={24} />
        </div>
        
        <div className="mobile-ssh-card-info">
          <h4 className="mobile-ssh-card-title">
            {host.hostname}
            {host.deleted_at && (
              <span className="mobile-ssh-deleted-badge">Gelöscht</span>
            )}
          </h4>
          <div className="mobile-ssh-card-details">
            <span className="mobile-ssh-connection-string">
              {host.username}@{host.host}:{host.port}
            </span>
          </div>
          
          {/* Action Buttons unter den Infos - nur Icons */}
          {!host.deleted_at && (
            <div className="mobile-ssh-card-actions-row">
              <button 
                className="mobile-ssh-action-btn-icon start"
                onClick={(e) => {
                  e.stopPropagation();
                  onConnect && onConnect(host);
                }}
                title="Terminal starten"
              >
                <Terminal size={20} />
              </button>
              
              <button 
                className="mobile-ssh-action-btn-icon test"
                onClick={(e) => {
                  e.stopPropagation();
                  onTest && onTest(host);
                }}
                title="Verbindung testen"
              >
                <Zap size={20} />
              </button>
              
              <button 
                className="mobile-ssh-action-btn-icon edit"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit && onEdit(host);
                }}
                title="Bearbeiten"
              >
                <Edit2 size={20} />
              </button>
              
              <button 
                className="mobile-ssh-action-btn-icon delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete && onDelete(host.id);
                }}
                title="Löschen"
              >
                <Trash2 size={20} />
              </button>
            </div>
          )}
          
          {/* Wiederherstellen Button für gelöschte Hosts */}
          {host.deleted_at && (
            <div className="mobile-ssh-card-actions-row">
              <button
                className="mobile-ssh-action-btn-icon restore"
                onClick={(e) => {
                  e.stopPropagation();
                  onRestore && onRestore(host.id);
                }}
              >
                <RotateCcw size={20} />
              </button>
            </div>
          )}
        </div>

        {/* Mehr Button für zusätzliche Aktionen */}
        {!host.deleted_at && (
          <button
            className="mobile-ssh-more-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowActions(!showActions);
            }}
          >
            <MoreVertical size={20} />
          </button>
        )}
      </div>

      {/* Erweiterte Aktionen (ausklappbar) */}
      {showActions && !host.deleted_at && (
        <div className="mobile-ssh-actions-menu">
          <button
            className="mobile-ssh-menu-item"
            onClick={() => handleActionClick(() => onShowHistory(host))}
          >
            <History size={18} />
            <span>Verlauf anzeigen</span>
          </button>
          
          <button
            className="mobile-ssh-menu-item"
            onClick={() => handleActionClick(() => onDiagnose && onDiagnose(host))}
          >
            <Activity size={18} />
            <span>Diagnose ausführen</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default MobileSSHHostCard;
