import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { 
  IconButton, 
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  LinearProgress,
  Alert
} from '@mui/material';
import { Upload, X, Folder, Server, CheckCircle, Info, FolderOpen } from 'lucide-react';
import SSHFileUpload from './SSHFileUpload';

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
      
      if (sshConnection) {
        setLoading(true);
        try {
          // Parse SSH connection string if available
          // Format: "user@host:port"
          const match = sshConnection.match(/^(.+)@(.+):(\d+)$/);
          if (match) {
            const [, username, hostname, port] = match;
            
            // First, try to find a configured SSH host with key
            const token = localStorage.getItem('token');
            
            try {
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
                    h.hostname === hostname || h.ip === hostname || h.host === hostname
                  );
                  
                  if (configuredHost) {
                    // Use the configured host with SSH key
                    setSSHHost({
                      ...configuredHost,
                      username: username || configuredHost.username,
                      port: parseInt(port) || configuredHost.port || 22
                    });
                  } else {
                    // Create a temporary host object for password-based connection
                    setSSHHost({
                      hostname,
                      username,
                      port: parseInt(port) || 22,
                      requiresPassword: true // This will prompt for password
                    });
                  }
                }
              } else {
                // If API call fails, still create a temporary host
                setSSHHost({
                  hostname,
                  username,
                  port: parseInt(port) || 22,
                  requiresPassword: true
                });
              }
            } catch (fetchError) {
              console.error('[FileTransferButton] Error fetching SSH hosts:', fetchError);
              // Create temporary host on error
              setSSHHost({
                hostname,
                username,
                port: parseInt(port) || 22,
                requiresPassword: true
              });
            }
          }
          
          // Load target path if configured
          const path = appliance.fileTransferPath || appliance.file_transfer_path || '~';
          setTargetPath(path);
          
        } catch (error) {
          console.error('[FileTransferButton] Error in loadSSHHost:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    loadSSHHost();
  }, [appliance]);
  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowUpload(true);
  };

  const handleClose = () => {
    setShowUpload(false);
  };

  // Don't show button if no SSH connection is configured
  const hasSshConnection = !!(appliance.sshConnection || appliance.ssh_connection || appliance.sshHostId || appliance.ssh_host_id);
  
  if (!hasSshConnection) {
    return null;
  }

  return (
    <>
      <Tooltip title="Datei-Upload">
        <IconButton
          onClick={handleClick}
          disabled={loading}
          size="small"
          className="file-transfer-button"
          sx={{
            backgroundColor: 'rgba(76, 175, 80, 0.3)',
            border: '1px solid rgba(76, 175, 80, 0.5)',
            color: 'white',
            '&:hover': {
              backgroundColor: 'rgba(76, 175, 80, 0.5)',
            },
            '&:disabled': {
              opacity: 0.5,
            },
            width: 28,
            height: 28,
            padding: 0,
          }}
        >
          <Upload size={16} />
        </IconButton>
      </Tooltip>

      {showUpload && sshHost && ReactDOM.createPortal(
        <SSHFileUpload
          sshHost={sshHost}
          targetPath={targetPath}
          applianceName={appliance.name}
          onClose={handleClose}
        />,
        document.body
      )}
    </>
  );
};

export default FileTransferButton;