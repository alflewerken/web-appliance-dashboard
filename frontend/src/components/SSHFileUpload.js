import React, { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, X, Lock } from 'lucide-react';
import './SSHFileUpload.css';

const SSHFileUpload = ({ sshHost, targetPath = '/home/{username}/Desktop', requirePassword = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [password, setPassword] = useState('');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Check if password is needed
    if (requirePassword && !password) {
      setShowPasswordPrompt(true);
      // Store files for later upload
      window.pendingFiles = files;
      return;
    }

    await uploadFiles(files);
  }, [sshHost, targetPath, requirePassword, password]);

  const uploadFiles = async (files) => {
    setUploading(true);
    setUploadStatus(null);

    try {
      // Upload each file
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        
        // Check if we have a host ID or need to send direct credentials
        if (sshHost.id && typeof sshHost.id === 'number') {
          formData.append('hostId', sshHost.id);
        } else {
          // Send direct SSH credentials
          formData.append('hostId', 'direct');
          formData.append('hostname', sshHost.hostname);
          formData.append('username', sshHost.username);
          formData.append('port', sshHost.port || 22);
          if (password) {
            formData.append('password', password);
          }
        }
        
        formData.append('targetPath', targetPath.replace('{username}', sshHost.username));

        const token = localStorage.getItem('token');
        const baseUrl = window.location.origin;
        const response = await fetch(`${baseUrl}/api/ssh/upload`, {
          method: 'POST',
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
          },
          body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Upload failed');
        }
      }

      setUploadStatus({
        type: 'success',
        message: `${files.length} Datei(en) erfolgreich hochgeladen!`
      });
    } catch (error) {
      setUploadStatus({
        type: 'error',
        message: `Fehler beim Upload: ${error.message}`
      });
    } finally {
      setUploading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setShowPasswordPrompt(false);
    
    if (window.pendingFiles) {
      await uploadFiles(window.pendingFiles);
      window.pendingFiles = null;
    }
  };

  const handleFileSelect = useCallback(async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Reuse the same upload logic
    const dropEvent = { 
      preventDefault: () => {}, 
      stopPropagation: () => {},
      dataTransfer: { files }
    };
    await handleDrop(dropEvent);
  }, [handleDrop]);

  if (!sshHost) {
    return (
      <div className="ssh-file-upload-disabled">
        <AlertCircle size={20} />
        <span>Kein SSH-Host konfiguriert</span>
      </div>
    );
  }

  return (
    <div className="ssh-file-upload-container">
      {showPasswordPrompt && (
        <div className="password-prompt-overlay">
          <form className="password-prompt" onSubmit={handlePasswordSubmit}>
            <div className="password-prompt-header">
              <Lock size={20} />
              <h3>SSH-Passwort erforderlich</h3>
            </div>
            <p>Bitte geben Sie das SSH-Passwort für {sshHost.username}@{sshHost.hostname} ein:</p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="SSH-Passwort"
              autoFocus
              required
            />
            <div className="password-prompt-buttons">
              <button type="button" onClick={() => {
                setShowPasswordPrompt(false);
                window.pendingFiles = null;
              }}>
                Abbrechen
              </button>
              <button type="submit">
                Upload starten
              </button>
            </div>
          </form>
        </div>
      )}

      <div 
        className={`ssh-file-upload-dropzone ${isDragging ? 'dragging' : ''} ${uploading ? 'uploading' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="ssh-file-input"
          className="ssh-file-input"
          onChange={handleFileSelect}
          multiple
          disabled={uploading}
        />
        
        <label htmlFor="ssh-file-input" className="ssh-file-label">
          {uploading ? (
            <>
              <div className="upload-spinner" />
              <span>Uploading...</span>
            </>
          ) : (
            <>
              <Upload size={32} />
              <span className="upload-text">
                Dateien hier ablegen oder klicken zum Auswählen
              </span>
            </>
          )}
        </label>
      </div>

      {uploadStatus && (
        <div className={`upload-status ${uploadStatus.type}`}>
          {uploadStatus.type === 'success' ? (
            <CheckCircle size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          <span>{uploadStatus.message}</span>
          <button 
            className="status-close"
            onClick={() => setUploadStatus(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default SSHFileUpload;
