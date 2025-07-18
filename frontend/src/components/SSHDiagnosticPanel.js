import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Wrench,
  Database,
  HardDrive,
  Shield,
  Settings,
  Activity,
  Server,
  Key,
  FileText,
  Clock,
  TrendingUp,
  Info,
  ChevronRight,
  Terminal,
  Zap,
} from 'lucide-react';
import './SSHDiagnosticPanel.css';

const SSHDiagnosticPanel = ({ 
  onRunDiagnosis, 
  diagnosisData, 
  isDiagnosing, 
  error,
  isStandalone = true 
}) => {
  const [diagnostic, setDiagnostic] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});
  const [animateStatus, setAnimateStatus] = useState(false);

  // Toggle expanded sections
  const toggleSection = section => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Run diagnostic check
  const runDiagnostic = async () => {
    // If external handler is provided, use it
    if (onRunDiagnosis) {
      return onRunDiagnosis();
    }

    // Otherwise use internal implementation
    setLoading(true);
    setAnimateStatus(false);
    try {
      // Get auth token
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
      };

      // Test basic connectivity first
      const healthResponse = await fetch('/api/health', { headers });
      if (!healthResponse.ok) {
        throw new Error(
          `Backend nicht erreichbar (Status: ${healthResponse.status})`
        );
      }

      const response = await fetch('/api/ssh-diagnostic/status', { headers });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `SSH Diagnose fehlgeschlagen (Status: ${response.status}): ${errorText}`
        );
      }

      const data = await response.json();
      // Debug log

      if (data.success) {
        // Build the diagnostic object with all necessary fields
        const diagnosticData = {
          database:
            data.status?.database || data.diagnostic_report?.database || {},
          filesystem:
            data.status?.filesystem || data.diagnostic_report?.filesystem || {},
          issues: data.status?.issues || data.diagnostic_report?.issues || [],
          recommendations:
            data.status?.recommendations ||
            data.diagnostic_report?.recommendations ||
            [],
          ssh_status: data.diagnostic_report?.ssh_status || {},
          summary: data.summary || {
            overall_status: 'unknown',
            healthy: false,
            issueCount: 0,
            criticalIssues: 0,
            ssh_functional: false,
            health_score: 0,
          },
        };

        setDiagnostic(diagnosticData);
        setLastUpdate(new Date());
        setTimeout(() => setAnimateStatus(true), 100);
      } else {
        throw new Error(data.error || 'Diagnose fehlgeschlagen');
      }
    } catch (error) {
      console.error('Diagnostic error:', error);
      // Set a minimal diagnostic object to prevent UI errors
      setDiagnostic({
        database: { keys: 0, hosts: 0, activeHosts: 0 },
        filesystem: { sshDirExists: false, keyFiles: 0, configExists: false },
        issues: [],
        recommendations: [],
        summary: {
          overall_status: 'error',
          healthy: false,
          issueCount: 1,
          criticalIssues: 1,
          ssh_functional: false,
          health_score: 0,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-fix SSH issues
  const autoFix = async () => {
    setFixing(true);
    try {
      // Get auth token
      const token = localStorage.getItem('token');

      const response = await fetch('/api/ssh-diagnostic/fix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        // Re-run diagnostic after fixing
        await runDiagnostic();
      } else {
        throw new Error(data.error || 'Auto-Fix fehlgeschlagen');
      }
    } catch (error) {
      console.error('Auto-fix error:', error);
    } finally {
      setFixing(false);
    }
  };

  // Get status icon based on overall status
  const getStatusIcon = status => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="status-icon status-icon-healthy" />;
      case 'warning':
        return <AlertTriangle className="status-icon status-icon-warning" />;
      case 'critical':
      case 'error':
        return <XCircle className="status-icon status-icon-critical" />;
      default:
        return <AlertTriangle className="status-icon status-icon-default" />;
    }
  };

  // Get status color class
  const getStatusClass = status => {
    switch (status) {
      case 'healthy':
        return 'status-healthy';
      case 'warning':
        return 'status-warning';
      case 'critical':
      case 'error':
        return 'status-critical';
      default:
        return 'status-default';
    }
  };

  // Run diagnostic on mount only if standalone
  useEffect(() => {
    if (isStandalone) {
      runDiagnostic();
    }
  }, [isStandalone]);

  // Update state when external data changes
  useEffect(() => {
    if (diagnosisData) {
      setDiagnostic(diagnosisData);
      setLastUpdate(new Date());
      setAnimateStatus(true);
    }
  }, [diagnosisData]);

  useEffect(() => {
    setLoading(isDiagnosing || false);
  }, [isDiagnosing]);

  return (
    <div className="ssh-diagnostic-panel">
      {/* Header Section */}
      <div className="diagnostic-header-wrapper">
        <div className="diagnostic-header">
          <div className="header-content">
            <div className="header-icon-wrapper">
              <Activity className="header-icon" />
            </div>
            <div className="header-text">
              <h2 className="header-title">SSH Diagnose</h2>
              <p className="header-subtitle">
                Überwache und optimiere deine SSH-Backup-Infrastruktur
              </p>
            </div>
          </div>
          <div className="header-actions">
            <button
              onClick={runDiagnostic}
              disabled={loading}
              className="action-button action-button-primary"
            >
              <RefreshCw className={`button-icon ${loading ? 'spin' : ''}`} />
              {loading ? 'Analysiere...' : 'Diagnose starten'}
            </button>

            {diagnostic &&
              diagnostic.summary &&
              diagnostic.summary.overall_status !== 'healthy' && (
                <button
                  onClick={autoFix}
                  disabled={fixing}
                  className="action-button action-button-success"
                >
                  <Wrench className={`button-icon ${fixing ? 'pulse' : ''}`} />
                  {fixing ? 'Repariere...' : 'Auto-Reparatur'}
                </button>
              )}
          </div>
        </div>
      </div>

      {/* Overall Health Status */}
      {diagnostic && diagnostic.summary && (
        <div
          className={`overall-status ${getStatusClass(diagnostic.summary.overall_status || 'unknown')} ${animateStatus ? 'animate' : ''}`}
        >
          <div className="status-content">
            <div className="status-main">
              <div className="status-icon-wrapper">
                {getStatusIcon(diagnostic.summary.overall_status || 'unknown')}
              </div>
              <div className="status-text">
                <h3 className="status-title">
                  System Status:{' '}
                  {diagnostic.summary.overall_status
                    ? diagnostic.summary.overall_status
                        .charAt(0)
                        .toUpperCase() +
                      diagnostic.summary.overall_status.slice(1)
                    : 'Unbekannt'}
                </h3>
                <p className="status-description">
                  {diagnostic.summary.ssh_functional
                    ? 'SSH-System ist voll funktionsfähig und bereit für Backups'
                    : 'SSH-System hat Probleme, die die Backup-Funktionalität beeinträchtigen könnten'}
                </p>
              </div>
            </div>

            {/* Health Score Circle */}
            <div className="health-score">
              <svg className="health-circle" viewBox="0 0 100 100">
                <circle className="health-circle-bg" cx="50" cy="50" r="45" />
                <circle
                  className="health-circle-progress"
                  cx="50"
                  cy="50"
                  r="45"
                  strokeDasharray={`${diagnostic.summary.health_score * 2.83} 283`}
                />
              </svg>
              <div className="health-score-text">
                <span className="health-score-value">
                  {diagnostic.summary.health_score || 0}
                </span>
                <span className="health-score-label">Health</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      {diagnostic && (
        <div className="quick-stats">
          <div className="stat-item">
            <Database className="stat-icon" />
            <div className="stat-content">
              <span className="stat-value">
                {diagnostic.database?.keys || 0}
              </span>
              <span className="stat-label">SSH Keys</span>
            </div>
          </div>
          <div className="stat-item">
            <Server className="stat-icon" />
            <div className="stat-content">
              <span className="stat-value">
                {diagnostic.database?.hosts || 0}
              </span>
              <span className="stat-label">SSH Hosts</span>
            </div>
          </div>
          <div className="stat-item">
            <AlertTriangle className="stat-icon" />
            <div className="stat-content">
              <span className="stat-value">
                {diagnostic.issues?.length || 0}
              </span>
              <span className="stat-label">Probleme</span>
            </div>
          </div>
          <div className="stat-item">
            <Shield className="stat-icon" />
            <div className="stat-content">
              <span className="stat-value">
                {diagnostic.filesystem?.configExists ? '✓' : '✗'}
              </span>
              <span className="stat-label">Config OK</span>
            </div>
          </div>
        </div>
      )}

      {/* Issues and Recommendations */}
      {diagnostic && diagnostic.issues && diagnostic.issues.length > 0 && (
        <div className="issues-section">
          <h3 className="section-title">
            <AlertTriangle className="section-icon" />
            Gefundene Probleme ({diagnostic.issues.length})
          </h3>
          <div className="issues-list">
            {diagnostic.issues.map((issue, index) => (
              <div key={index} className={`issue-item issue-${issue.severity}`}>
                <div className="issue-icon">
                  {issue.severity === 'high' ? <XCircle /> : <AlertTriangle />}
                </div>
                <div className="issue-content">
                  <p className="issue-message">{issue.message}</p>
                  {issue.recommendation && (
                    <p className="issue-recommendation">
                      {issue.recommendation}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last Update */}
      {lastUpdate && (
        <div className="last-update">
          <Clock className="update-icon" />
          <span>Letzte Aktualisierung: {lastUpdate.toLocaleTimeString()}</span>
        </div>
      )}
    </div>
  );
};

export default SSHDiagnosticPanel;
