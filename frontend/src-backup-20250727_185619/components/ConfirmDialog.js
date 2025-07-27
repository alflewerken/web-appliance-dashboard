import React from 'react';
import { AlertTriangle, XCircle, Play } from 'lucide-react';
import './ConfirmDialog.css';

const ConfirmDialog = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  action,
  serviceName 
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const isStop = action === 'stop';

  return (
    <div className="confirm-dialog-overlay" onClick={handleCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-dialog-header">
          <AlertTriangle size={24} className={isStop ? 'icon-danger' : 'icon-warning'} />
          <h3>{title}</h3>
        </div>
        
        <div className="confirm-dialog-body">
          <p>{message}</p>
          {serviceName && (
            <div className="service-name-display">
              <strong>{serviceName}</strong>
            </div>
          )}
        </div>
        
        <div className="confirm-dialog-footer">
          <button 
            className="confirm-btn cancel"
            onClick={handleCancel}
          >
            Abbrechen
          </button>
          <button 
            className={`confirm-btn ${isStop ? 'danger' : 'primary'}`}
            onClick={handleConfirm}
          >
            {isStop ? (
              <>
                <XCircle size={16} />
                Service stoppen
              </>
            ) : (
              <>
                <Play size={16} />
                Service starten
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
