import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Eye,
  EyeOff,
  Search,
  Filter,
  X,
  ChevronLeft,
} from 'lucide-react';
import axios from '../../utils/axiosConfig';
import { useSSE } from '../../hooks/useSSE';
import MobileSSHHostCard from './MobileSSHHostCard';
import './MobileSSHHostManager.css';

const MobileSSHHostManager = ({ onBack, onTerminalOpen, embedded }) => {
  const [hosts, setHosts] = useState([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingHost, setEditingHost] = useState(null);
  const [selectedHost, setSelectedHost] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [hostHistory, setHostHistory] = useState([]);

  const [formData, setFormData] = useState({
    hostname: '',
    host: '',
    username: '',
    port: 22,
    key_name: 'dashboard',
  });

  const { addEventListener, isConnected } = useSSE();

  // Gefilterte Hosts basierend auf Suchbegriff
  const filteredHosts = hosts.filter(host => 
    host.hostname.toLowerCase().includes(searchQuery.toLowerCase()) ||
    host.host.toLowerCase().includes(searchQuery.toLowerCase()) ||
    host.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fetchHosts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `/api/ssh/hosts/all?includeDeleted=${showDeleted}`
      );
      setHosts(response.data.hosts || []);
    } catch (error) {
      console.error('Error fetching SSH hosts:', error);
    } finally {
      setLoading(false);
    }
  }, [showDeleted]);

  useEffect(() => {
    fetchHosts();

    if (addEventListener) {
      const unsubscribers = [
        addEventListener('ssh_host_created', fetchHosts),
        addEventListener('ssh_host_updated', fetchHosts),
        addEventListener('ssh_host_deleted', fetchHosts),
        addEventListener('ssh_host_restored', fetchHosts),
        addEventListener('ssh_host_reverted', fetchHosts),
      ];

      return () => {
        unsubscribers.forEach(unsubscribe => {
          if (typeof unsubscribe === 'function') unsubscribe();
        });
      };
    }
  }, [addEventListener, fetchHosts]);

  const fetchHostHistory = async (hostId) => {
    try {
      const response = await axios.get(`/api/ssh/hosts/${hostId}/history`);
      setHostHistory(response.data.history || []);
    } catch (error) {
      console.error('Error fetching host history:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingHost) {
        await axios.put(`/api/ssh/hosts/${editingHost.id}`, formData);
      } else {
        await axios.post('/api/ssh/hosts', formData);
      }

      setShowAddForm(false);
      setEditingHost(null);
      resetForm();
      fetchHosts();
    } catch (error) {
      console.error('Error saving SSH host:', error);
      alert('Fehler beim Speichern des SSH-Hosts');
    }
  };

  const handleDelete = async (hostId) => {
    if (!confirm('Möchten Sie diesen SSH-Host wirklich löschen?')) return;

    try {
      await axios.delete(`/api/ssh/hosts/${hostId}`);
      fetchHosts();
    } catch (error) {
      console.error('Error deleting SSH host:', error);
      alert('Fehler beim Löschen des SSH-Hosts');
    }
  };

  const handleRestore = async (hostId) => {
    try {
      await axios.post(`/api/ssh/hosts/${hostId}/restore`);
      fetchHosts();
    } catch (error) {
      console.error('Error restoring SSH host:', error);
      alert('Fehler beim Wiederherstellen des SSH-Hosts');
    }
  };

  const handleEdit = (host) => {
    setEditingHost(host);
    setFormData({
      hostname: host.hostname,
      host: host.host,
      username: host.username,
      port: host.port,
      key_name: host.key_name,
    });
    setShowAddForm(true);
  };

  const handleShowHistory = (host) => {
    setSelectedHost(host);
    fetchHostHistory(host.id);
    setShowHistory(true);
  };

  const handleConnect = (host) => {
    // Verwende die übergebene onTerminalOpen Funktion wenn vorhanden
    if (onTerminalOpen) {
      onTerminalOpen(host);
    } else {

    }
  };

  const handleTest = async (host) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/ssh/test', {
        hostname: host.hostname,
        host: host.host,
        username: host.username,
        port: host.port,
        keyName: host.key_name,
      }, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      if (response.data.success) {
        alert('Verbindungstest erfolgreich!');
      } else {
        alert(`Verbindungstest fehlgeschlagen: ${response.data.error}`);
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      alert('Fehler beim Testen der Verbindung');
    }
  };

  const handleDiagnose = (host) => {
    // TODO: Diagnose-Funktion implementieren

    alert('Diagnose-Funktion wird noch implementiert');
  };

  const resetForm = () => {
    setFormData({
      hostname: '',
      host: '',
      username: '',
      port: 22,
      key_name: 'dashboard',
    });
  };

  return (
    <div className={`mobile-ssh-manager ${embedded ? 'embedded' : ''}`}>
      {/* Header - nur wenn nicht eingebettet */}
      {!embedded && (
        <div className="mobile-ssh-header">
          <div className="mobile-ssh-header-top">
            <button className="mobile-back-btn" onClick={onBack}>
              <ChevronLeft size={24} />
            </button>
            <h2>SSH-Hosts</h2>
            <button
              className="mobile-add-btn"
              onClick={() => {
                setEditingHost(null);
                resetForm();
                setShowAddForm(true);
              }}
            >
              <Plus size={24} />
            </button>
          </div>

          {/* Such- und Filterbereich */}
          <div className="mobile-ssh-controls">
            <div className="mobile-search-bar">
              <Search size={18} />
              <input
                type="text"
                placeholder="SSH-Hosts durchsuchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="mobile-clear-search"
                  onClick={() => setSearchQuery('')}
                >
                  <X size={18} />
                </button>
              )}
            </div>
            
            <button
              className={`mobile-filter-btn ${showDeleted ? 'active' : ''}`}
              onClick={() => setShowDeleted(!showDeleted)}
            >
              {showDeleted ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </div>
        </div>
      )}

      {/* Eingebetteter Header */}
      {embedded && (
        <div className="mobile-ssh-header embedded">
          <div className="mobile-ssh-controls">
            <h3>SSH-Hosts</h3>
            <button
              className="mobile-add-btn"
              onClick={() => {
                setEditingHost(null);
                resetForm();
                setShowAddForm(true);
              }}
            >
              <Plus size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Host Liste */}
      <div className="mobile-ssh-content">
        {loading ? (
          <div className="mobile-loading">
            <div className="mobile-loading-spinner"></div>
            <span>Lade SSH-Hosts...</span>
          </div>
        ) : filteredHosts.length === 0 ? (
          <div className="mobile-empty-state">
            <p>
              {searchQuery 
                ? 'Keine SSH-Hosts gefunden' 
                : 'Noch keine SSH-Hosts vorhanden'
              }
            </p>
            {!searchQuery && (
              <button
                className="mobile-empty-add-btn"
                onClick={() => setShowAddForm(true)}
              >
                <Plus size={20} />
                Ersten Host hinzufügen
              </button>
            )}
          </div>
        ) : (
          <div className="mobile-ssh-list">
            {filteredHosts.map(host => (
              <MobileSSHHostCard
                key={host.id}
                host={host}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onRestore={handleRestore}
                onShowHistory={handleShowHistory}
                onConnect={handleConnect}
                onTest={handleTest}
                onDiagnose={handleDiagnose}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Form Modal */}
      {showAddForm && (
        <div className="mobile-modal-overlay">
          <div className="mobile-modal-content">
            <div className="mobile-modal-header">
              <h3>{editingHost ? 'Host bearbeiten' : 'Neuer SSH-Host'}</h3>
              <button
                className="mobile-modal-close"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingHost(null);
                  resetForm();
                }}
              >
                <X size={24} />
              </button>
            </div>

            <form className="mobile-ssh-form" onSubmit={handleSubmit}>
              <div className="mobile-form-group">
                <label>Anzeigename</label>
                <input
                  type="text"
                  placeholder="z.B. Backup Server"
                  value={formData.hostname}
                  onChange={(e) =>
                    setFormData({ ...formData, hostname: e.target.value })
                  }
                  required
                />
              </div>

              <div className="mobile-form-group">
                <label>Host / IP-Adresse</label>
                <input
                  type="text"
                  placeholder="192.168.1.100"
                  value={formData.host}
                  onChange={(e) =>
                    setFormData({ ...formData, host: e.target.value })
                  }
                  required
                />
              </div>

              <div className="mobile-form-group">
                <label>Benutzername</label>
                <input
                  type="text"
                  placeholder="root"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  required
                />
              </div>

              <div className="mobile-form-group">
                <label>Port</label>
                <input
                  type="number"
                  placeholder="22"
                  value={formData.port}
                  onChange={(e) =>
                    setFormData({ ...formData, port: parseInt(e.target.value) })
                  }
                  required
                />
              </div>

              <div className="mobile-form-actions">
                <button type="submit" className="mobile-submit-btn">
                  {editingHost ? 'Speichern' : 'Hinzufügen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && selectedHost && (
        <div className="mobile-modal-overlay">
          <div className="mobile-modal-content">
            <div className="mobile-modal-header">
              <h3>Verlauf: {selectedHost.hostname}</h3>
              <button
                className="mobile-modal-close"
                onClick={() => setShowHistory(false)}
              >
                <X size={24} />
              </button>
            </div>

            <div className="mobile-history-list">
              {hostHistory.map((entry) => (
                <div key={entry.id} className={`mobile-history-entry ${entry.action}`}>
                  <div className="mobile-history-info">
                    <span className="mobile-history-action">{entry.action}</span>
                    <span className="mobile-history-time">
                      {new Date(entry.changed_at).toLocaleString('de-DE')}
                    </span>
                    <span className="mobile-history-user">
                      von {entry.changed_by_username || 'System'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileSSHHostManager;
