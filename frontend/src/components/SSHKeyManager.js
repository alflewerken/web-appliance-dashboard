import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Server,
  Key,
  Lock,
  CheckCircle,
  AlertCircle,
  Edit,
  Trash2,
  Shield,
  Eye,
  EyeOff,
  Activity,
  Wifi,
  WifiOff,
  RefreshCw,
  FileKey,
  Home,
  Settings,
  Terminal,
} from 'lucide-react';
import SSHHostManagerResponsive from './SSHHostManagerResponsive';
import SSHDiagnosticPanel from './SSHDiagnosticPanel';
import './SSHKeyManager.css';

const SSHKeyManager = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('hosts');
  const [setupResult, setSetupResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [diagnosisData, setDiagnosisData] = useState(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Clear any previous messages when opening
      setError(null);
      setSuccess(null);
      setSetupResult(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleQuickSetup = async (setupType) => {
    setSetupResult(null);
    setError(null);

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/ssh/quick-setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ type: setupType }),
      });

      const data = await response.json();

      if (data.success) {
        setSetupResult({
          type: 'success',
          message: data.message,
          details: data.details,
        });
      } else {
        setSetupResult({
          type: 'error',
          message: data.error || 'Setup failed',
          details: data.details,
        });
      }
    } catch (err) {
      setSetupResult({
        type: 'error',
        message: 'Failed to complete setup',
        details: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const runDiagnosis = async () => {
    setIsDiagnosing(true);
    setDiagnosisData(null);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/ssh/diagnosis', {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
      const data = await response.json();

      if (data.success) {
        setDiagnosisData(data.diagnosis);
      } else {
        setError(data.error || 'Diagnosis failed');
      }
    } catch (err) {
      setError('Failed to run SSH diagnosis');
    } finally {
      setIsDiagnosing(false);
    }
  };

  if (!isOpen) return null;

  // Mobile view - full screen
  if (isMobile) {
    return (
      <div className="ssh-manager-mobile-fullscreen">
        {activeTab === 'hosts' && (
          <SSHHostManagerResponsive 
            onBack={() => {
              setActiveTab('hosts');
              onClose();
            }}
          />
        )}
        
        {activeTab === 'setup' && (
          <div className="mobile-setup-screen">
            <div className="mobile-header">
              <button className="mobile-back-btn" onClick={() => setActiveTab('hosts')}>
                <X size={24} />
              </button>
              <h2>SSH Quick Setup</h2>
              <div style={{ width: 40 }} />
            </div>
            
            <div className="mobile-content">
              <div className="setup-options">
                <button
                  className="setup-option"
                  onClick={() => handleQuickSetup('dashboard')}
                  disabled={loading}
                >
                  <Key size={32} />
                  <h3>Setup Dashboard Keys</h3>
                  <p>Generate SSH keys for the dashboard</p>
                </button>

                <button
                  className="setup-option"
                  onClick={() => handleQuickSetup('appliances')}
                  disabled={loading}
                >
                  <Home size={32} />
                  <h3>Setup Appliance Access</h3>
                  <p>Configure SSH access to appliances</p>
                </button>
              </div>

              {setupResult && (
                <div className={`setup-result ${setupResult.type}`}>
                  <h4>{setupResult.message}</h4>
                  {setupResult.details && <p>{setupResult.details}</p>}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'diagnosis' && (
          <div className="mobile-diagnosis-screen">
            <div className="mobile-header">
              <button className="mobile-back-btn" onClick={() => setActiveTab('hosts')}>
                <X size={24} />
              </button>
              <h2>SSH Diagnostics</h2>
              <div style={{ width: 40 }} />
            </div>
            
            <div className="mobile-content">
              <SSHDiagnosticPanel 
                onRunDiagnosis={runDiagnosis}
                diagnosisData={diagnosisData}
                isDiagnosing={isDiagnosing}
                error={error}
              />
            </div>
          </div>
        )}

        {/* Mobile Tab Bar */}
        <div className="mobile-tab-bar">
          <button
            className={`mobile-tab ${activeTab === 'hosts' ? 'active' : ''}`}
            onClick={() => setActiveTab('hosts')}
          >
            <Server size={20} />
            <span>Hosts</span>
          </button>
          <button
            className={`mobile-tab ${activeTab === 'setup' ? 'active' : ''}`}
            onClick={() => setActiveTab('setup')}
          >
            <Shield size={20} />
            <span>Setup</span>
          </button>
          <button
            className={`mobile-tab ${activeTab === 'diagnosis' ? 'active' : ''}`}
            onClick={() => setActiveTab('diagnosis')}
          >
            <Activity size={20} />
            <span>Diagnose</span>
          </button>
        </div>
      </div>
    );
  }

  // Desktop view - modal
  return (
    <div className="ssh-manager-modal">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content">
        <div className="modal-header">
          <h2>SSH Manager</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="tabs">
          <button
            className={`tab ${activeTab === 'hosts' ? 'active' : ''}`}
            onClick={() => setActiveTab('hosts')}
          >
            <Server size={16} />
            SSH Hosts
          </button>
          <button
            className={`tab ${activeTab === 'setup' ? 'active' : ''}`}
            onClick={() => setActiveTab('setup')}
          >
            <Shield size={16} />
            Quick Setup
          </button>
          <button
            className={`tab ${activeTab === 'diagnosis' ? 'active' : ''}`}
            onClick={() => setActiveTab('diagnosis')}
          >
            <Activity size={16} />
            Diagnosis
          </button>
        </div>

        {error && (
          <div className="error-message">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {success && (
          <div className="success-message">
            <CheckCircle size={16} />
            {success}
          </div>
        )}

        <div className="tab-content">
          {activeTab === 'hosts' && (
            <SSHHostManagerResponsive />
          )}

          {activeTab === 'setup' && (
            <div className="setup-tab">
              <div className="setup-options">
                <button
                  className="setup-option"
                  onClick={() => handleQuickSetup('dashboard')}
                  disabled={loading}
                >
                  <Key size={48} />
                  <h3>Setup Dashboard Keys</h3>
                  <p>Generate SSH keys for the dashboard to use when connecting to appliances</p>
                </button>

                <button
                  className="setup-option"
                  onClick={() => handleQuickSetup('appliances')}
                  disabled={loading}
                >
                  <Home size={48} />
                  <h3>Setup Appliance Access</h3>
                  <p>Configure SSH access from the dashboard to all appliances</p>
                </button>
              </div>

              {setupResult && (
                <div className={`setup-result ${setupResult.type}`}>
                  <div className="result-header">
                    {setupResult.type === 'success' ? (
                      <CheckCircle size={24} />
                    ) : (
                      <AlertCircle size={24} />
                    )}
                    <h3>{setupResult.message}</h3>
                  </div>
                  {setupResult.details && (
                    <div className="result-details">
                      <p>{setupResult.details}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'diagnosis' && (
            <div className="diagnosis-tab">
              <SSHDiagnosticPanel 
                onRunDiagnosis={runDiagnosis}
                diagnosisData={diagnosisData}
                isDiagnosing={isDiagnosing}
                error={error}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SSHKeyManager;
