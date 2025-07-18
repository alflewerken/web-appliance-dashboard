import React, { useEffect } from 'react';

const DebugAuditLog = () => {
  useEffect(() => {
    // Test if we can fetch audit logs
    fetch('/api/audit-logs', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    })
      .then(res => {
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          );
        }
      })
      .catch(err => {
        console.error('Error fetching audit logs:', err);
      });
  }, []);

  return <div>Check console for audit log debug info</div>;
};

export default DebugAuditLog;
