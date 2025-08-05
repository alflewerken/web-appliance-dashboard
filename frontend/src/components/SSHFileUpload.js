import React, { useState, useCallback } from 'react';
import { Upload, AlertCircle, CheckCircle, X, Loader2 } from 'lucide-react';
import './SSHFileUpload.css';

// Helper function to format bytes
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const SSHFileUpload = ({ sshHost, targetPath, requirePassword, onClose, applianceName }) => {
  // Version: 2025-07-27 - SSE Progress Tracking
  
  // Early return if no sshHost provided
  if (!sshHost) {
    console.error('SSHFileUpload: No SSH host provided');
    if (onClose) onClose();
    return null;
  }

  // Extract hostname and display name safely
  const hostname = sshHost.hostname || sshHost.host || 'Unknown Host';
  const displayName = sshHost.name || hostname;
  const username = sshHost.username || 'Unknown User';
  
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [password, setPassword] = useState('');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [currentFile, setCurrentFile] = useState(null);
  const [uploadPhase, setUploadPhase] = useState(''); // 'uploading' or 'transferring'
  const [currentTargetPath, setCurrentTargetPath] = useState(targetPath || '~');

  const uploadFiles = useCallback(async (files) => {
    setUploading(true);
    setUploadStatus(null);
    setUploadProgress({});

    try {
      const results = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setCurrentFile(file.name);
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('hostId', sshHost.id);
        formData.append('targetPath', currentTargetPath);
        
        // Debug: Log the actual targetPath being sent

        if (password) {
          formData.append('password', password);
        }
        
        try {
          const token = localStorage.getItem('token');
          
          // Since the backend uses SSE, we need to handle the response differently
          const response = await fetch('/api/ssh/upload', {
            method: 'POST',
            headers: {
              'Authorization': token ? `Bearer ${token}` : '',
            },
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
          }

          // Read SSE stream
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            
            for (let i = 0; i < lines.length - 1; i++) {
              const line = lines[i].trim();
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.substring(6));

                  if (data.phase && data.progress !== undefined) {
                    setUploadProgress(prev => ({
                      ...prev,
                      [file.name]: {
                        percent: data.progress,
                        phase: data.phase
                      }
                    }));
                    setUploadPhase(data.phase);
                  }
                  
                  if (data.phase === 'complete') {
                    results.push({ file: file.name, success: true, ...data });
                  } else if (data.phase === 'error') {
                    results.push({ file: file.name, success: false, error: data.error || 'Upload failed' });
                    // Show error immediately
                    setUploadStatus({
                      type: 'error',
                      message: data.error || 'Upload fehlgeschlagen'
                    });
                    break; // Stop processing this file
                  }
                } catch (e) {
                  console.error('Failed to parse SSE data:', e);
                }
              }
            }
            
            buffer = lines[lines.length - 1];
          }
        } catch (error) {
          console.error('Upload error:', error);
          results.push({ file: file.name, success: false, error: error.message });
        }
      }

      // Show results
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      if (failCount === 0) {
        setUploadStatus({
          type: 'success',
          message: `${successCount} Datei${successCount !== 1 ? 'en' : ''} erfolgreich hochgeladen!`
        });
      } else if (successCount === 0) {
        setUploadStatus({
          type: 'error',
          message: `Fehler beim Upload von ${failCount} Datei${failCount !== 1 ? 'en' : ''}.`
        });
      } else {
        setUploadStatus({
          type: 'warning',
          message: `${successCount} erfolgreich, ${failCount} fehlgeschlagen.`
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus({
        type: 'error',
        message: error.message || 'Upload fehlgeschlagen'
      });
    } finally {
      setUploading(false);
      setCurrentFile(null);
      setUploadProgress({});
    }
  }, [sshHost, currentTargetPath, password]);
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      if (sshHost.requiresPassword && !password) {
        // Store files and show password prompt
        window.pendingFiles = files;
        setShowPasswordPrompt(true);
      } else {
        uploadFiles(files);
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation(); // Wichtig: Event nicht weitergeben!
    setIsDragging(false);
    
    const items = e.dataTransfer.items;
    const files = [];
    
    // Check if user is trying to drop folders
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
        if (entry && entry.isDirectory) {
          setUploadStatus({
            type: 'error',
            message: 'Ordner-Upload wird nicht unterstützt. Bitte wählen Sie einzelne Dateien aus.'
          });
          return;
        }
        files.push(item.getAsFile());
      }
    }
    
    // If no files were collected through webkitGetAsEntry, fall back to regular files
    if (files.length === 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length > 0) {
        // Filter out any items that might be directories (size 0 and no type)
        const validFiles = droppedFiles.filter(file => file.size > 0 || file.type !== '');
        if (validFiles.length === 0) {
          setUploadStatus({
            type: 'error',
            message: 'Ordner-Upload wird nicht unterstützt. Bitte wählen Sie einzelne Dateien aus.'
          });
          return;
        }
        files.push(...validFiles);
      }
    }
    
    if (files.length > 0) {
      if (sshHost.requiresPassword && !password) {
        window.pendingFiles = files;
        setShowPasswordPrompt(true);
      } else {
        uploadFiles(files);
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation(); // Wichtig: Event nicht weitergeben!
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation(); // Wichtig: Event nicht weitergeben!
    setIsDragging(false);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation(); // Wichtig: Event nicht weitergeben!
    setIsDragging(true);
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    setShowPasswordPrompt(false);
    
    if (window.pendingFiles) {
      uploadFiles(window.pendingFiles);
      window.pendingFiles = null;
    }
  };

  // Listen for SSE progress updates
  React.useEffect(() => {
    const handleProgressUpdate = (event) => {
      const data = event.detail;
      if (data.fileName) {
        setUploadProgress(prev => ({
          ...prev,
          [data.fileName]: {
            percent: data.percent || 0,
            loaded: data.loaded,
            total: data.total,
            phase: data.phase || 'uploading'
          }
        }));
        
        if (data.phase) {
          setUploadPhase(data.phase);
        }
      }
    };

    window.addEventListener('ssh-upload-progress', handleProgressUpdate);
    return () => {
      window.removeEventListener('ssh-upload-progress', handleProgressUpdate);
    };
  }, []);

  // Get phase-specific message
  const getPhaseMessage = () => {
    switch (uploadPhase) {
      case 'uploading':
        return 'Datei wird hochgeladen...';
      case 'transferring':
        return 'Datei wird per SSH übertragen...';
      case 'verifying':
        return 'Übertragung wird verifiziert...';
      case 'complete':
        return 'Übertragung abgeschlossen!';
      default:
        return 'Vorbereitung...';
    }
  };
  // Verhindere, dass Drop-Events auf dem Modal das globale Drag&Drop triggern
  const handleModalDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleModalDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Drop außerhalb der Dropzone ignorieren
  };

  return (
    <div 
      className="ssh-file-upload-overlay" 
      onClick={onClose}
      onDragOver={handleModalDragOver}
      onDrop={handleModalDrop}
    >
      <div 
        className="ssh-file-upload-modal" 
        onClick={(e) => e.stopPropagation()}
        onDragOver={handleModalDragOver}
        onDrop={handleModalDrop}
      >
        <div className="ssh-file-upload-header">
          <h3 className="ssh-file-upload-title">
            Datei-Upload zu {applianceName || displayName}
          </h3>
          <button className="ssh-file-upload-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="ssh-file-upload-content">
          <div className="ssh-file-upload-target-path">
            <label htmlFor="target-path">Zielverzeichnis:</label>
            <input
              id="target-path"
              type="text"
              value={currentTargetPath}
              onChange={(e) => setCurrentTargetPath(e.target.value)}
              placeholder="z.B. ~/Downloads oder /home/user/uploads"
              disabled={uploading}
            />
            <span className="ssh-file-upload-host-info">auf {displayName}</span>
            <div className="path-info">
              <small>Tipp: Verzeichnis wird erstellt, falls es nicht existiert. Achten Sie auf korrekte Schreibweise!</small>
            </div>
          </div>

          {uploadStatus && (
            <div className={`upload-status ${uploadStatus.type}`}>
              {uploadStatus.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
              {uploadStatus.message}
              <button onClick={() => setUploadStatus(null)} className="close-status">
                <X size={16} />
              </button>
            </div>
          )}

          {showPasswordPrompt && (
            <form onSubmit={handlePasswordSubmit} className="password-prompt">
              <label>
                SSH-Passwort für {username}@{hostname}:
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  required
                />
              </label>
              <div className="password-actions">
                <button type="submit">Weiter</button>
                <button type="button" onClick={() => {
                  setShowPasswordPrompt(false);
                  window.pendingFiles = null;
                }}>
                  Abbrechen
                </button>
              </div>
            </form>
          )}

          <div
            className={`ssh-file-upload-dropzone ${isDragging ? 'dragging' : ''} ${uploading ? 'uploading' : ''}`}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {!uploading ? (
              <label className="ssh-file-label">
                <Upload size={48} />
                <span className="upload-text">
                  Dateien hier ablegen oder klicken zum Auswählen
                </span>
                <span className="upload-info">
                  Unterstützt mehrere Dateien gleichzeitig
                </span>
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="ssh-file-input"
                />
              </label>
            ) : (
              <div className="upload-progress">
                <Loader2 size={48} className="upload-spinner" />
                <p>{currentFile || 'Uploading...'}</p>
                <p className="phase-message">{getPhaseMessage()}</p>
                {Object.entries(uploadProgress).map(([fileName, progress]) => (
                  <div key={fileName} className="file-progress">
                    <div className="progress-info">
                      <span className="file-name">{fileName}</span>
                      <span className="progress-percent">{progress.percent}%</span>
                    </div>
                    <div className="progress-bar">
                      <div 
                        className={`progress-fill ${progress.phase}`}
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                    {progress.loaded && progress.total && progress.phase === 'uploading' && (
                      <div className="progress-size">
                        {formatBytes(progress.loaded)} / {formatBytes(progress.total)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SSHFileUpload;