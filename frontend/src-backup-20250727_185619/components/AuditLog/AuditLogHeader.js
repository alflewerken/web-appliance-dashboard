import React from 'react';
import { X } from 'lucide-react';
import './AuditLog.css';

const AuditLogHeader = ({ title, icon: Icon, onClose }) => {
  return (
    <div className="audit-log-header-unified">
      <h2 className="audit-log-title">
        {Icon && <Icon size={20} className="header-icon" />}
        {title}
      </h2>
      
      <button className="panel-close-btn-unified" onClick={onClose}>
        <X size={18} />
      </button>
    </div>
  );
};

export default AuditLogHeader;
