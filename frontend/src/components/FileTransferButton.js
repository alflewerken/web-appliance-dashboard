import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Upload } from 'lucide-react';
import SSHFileUpload from './SSHFileUpload';
import './FileTransferButton.css';

const FileTransferButton = ({ appliance }) => {
  const [showUpload, setShowUpload] = useState(false);
  const [sshHost, setSSHHost] = useState(null);
  const [loading, setLoading] = useState(false);
  const [targetPath, setTargetPath] = useState('');

  useEffect(() => {
    // Load SSH host if appliance has one configured
    const loadSSHHost = async () => {
      // Check if appliance has SSH connection configured (handle both snake_case and camelCase)
      const sshConnection = appliance.sshConnection || appliance.ssh_connection;
      const sshHostId = appliance.sshHostId || appliance.ssh_host_id;
      
      if (sshConnection || sshHostId) {
        setLoading(true);
        try {
          // Parse SSH connection string if available
          if (sshConnection) {
            // Format: "user@host:port"
            const match = sshConnection.match(/^(.+)@(.+):(\d+)$/);
            if (match) {
              const [, username, hostname, port] = match;
              
              // First, try to find a configured SSH host with key
              const token = localStorage.getItem('token');
              const hostsResponse = await fetch('/api/ssh/hosts', {
                headers: {
                  'Authorization': token ? `Bearer ${token}` : '',
                },
              });
              
              if (hostsResponse.ok) {
                const hostsData = await hostsResponse.json();
                if (hostsData.success && hostsData.hosts) {
                  // Find matching host by hostname or IP
                  const configuredHost = hostsData.hosts.find(h => 
                    h.hostname === hostname || 
                    h.host === hostname ||
                    (h.hostname === 'mac' && hostname === '192.168.178.70')
                  );
                  
                  if (configuredHost && configuredHost.key_name) {
                    // Use the configured host with SSH key
                    setSSHHost({
                      id: configuredHost.id,
                      username: configuredHost.username,
                      hostname: configuredHost.host || configuredHost.hostname,
                      port: configuredHost.port || 22,
                      key_name: configuredHost.key_name,
                      hasKey: true
                    });
                    setTargetPath(`/Users/${configuredHost.username}`);
                    return;
                  }
                }
              }
              
              // Fallback to parsed connection without key
              setSSHHost({
                id: appliance.id,
                username,
                hostname,
                port: parseInt(port, 10),
                hasKey: false
              });
              // Set default target path
              setTargetPath(`/home/${username}`);
            }
          } else if (sshHostId) {
            // Fallback to ssh_host_id if available
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/ssh/hosts/${sshHostId}`, {
              headers: {
                'Authorization': token ? `Bearer ${token}` : '',
              },
            });
            
            if (response.ok) {
              const data = await response.json();
              if (data.success && data.host) {
                setSSHHost(data.host);
                // Set default target path
                setTargetPath(`/home/${data.host.username}`);
              }
            }
          }
        } catch (error) {
          console.error('Failed to load SSH host:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    loadSSHHost();
  }, [appliance.sshConnection, appliance.ssh_connection, appliance.sshHostId, appliance.ssh_host_id]);

  const sshConnection = appliance.sshConnection || appliance.ssh_connection;
  const sshHostId = appliance.sshHostId || appliance.ssh_host_id;
  
  if (!sshConnection && !sshHostId || loading) {
    return null;
  }

  return (
    <>
      <button
        className="file-transfer-button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowUpload(!showUpload);
        }}
        title="Datei-Übertragung"
      >
        <Upload size={16} />
      </button>

      {showUpload && sshHost && ReactDOM.createPortal(
        <div className="file-transfer-modal-overlay" onClick={() => setShowUpload(false)}>
          <div className="file-transfer-modal" onClick={(e) => e.stopPropagation()}>
            <div className="file-transfer-content">
              <div className="file-transfer-header">
                <h3>Datei-Übertragung zu {appliance.name}</h3>
                <button 
                  className="close-button"
                  onClick={() => setShowUpload(false)}
                >
                  ×
                </button>
              </div>
              
              <div className="file-transfer-path-input">
                <label htmlFor="targetPath">Zielpfad:</label>
                <input
                  id="targetPath"
                  type="text"
                  value={targetPath}
                  onChange={(e) => setTargetPath(e.target.value)}
                  placeholder={`/home/${sshHost.username}`}
                  className="path-input"
                />
              </div>
              
              <SSHFileUpload 
                sshHost={sshHost}
                targetPath={targetPath || `/home/${sshHost.username}`}
                requirePassword={!sshHost.hasKey}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default FileTransferButton;
