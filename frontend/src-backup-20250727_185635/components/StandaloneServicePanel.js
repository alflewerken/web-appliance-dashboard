import React, { useState, useEffect } from 'react';
import ServicePanel from './ServicePanel';
import { ApplianceService } from '../services/applianceService';
import { AuthProvider } from '../contexts/AuthContext';
import { SSEProvider } from '../contexts/SSEContext';
import '../theme.css';
import '../glassmorphism.css';

const StandaloneServicePanel = () => {
  const [appliance, setAppliance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Get config from window object
  const config = window.servicePanelConfig || {};
  const { serviceId, activeTab } = config;

  useEffect(() => {
    const loadService = async () => {
      if (!serviceId) {
        setError('Keine Service ID angegeben');
        setLoading(false);
        return;
      }

      try {
        const services = await ApplianceService.getAppliances();
        const service = services.find(s => s.id === parseInt(serviceId));
        
        if (!service) {
          setError('Service nicht gefunden');
        } else {
          setAppliance(service);
        }
      } catch (err) {
        console.error('Error loading service:', err);
        setError('Fehler beim Laden des Services');
      } finally {
        setLoading(false);
      }
    };

    loadService();
  }, [serviceId]);

  const handleSave = async (updatedData) => {
    try {
      const updated = await ApplianceService.updateAppliance(appliance.id, updatedData);
      setAppliance(updated);
      
      // Optional: Fenster nach dem Speichern schließen
      // window.close();
    } catch (error) {
      console.error('Error saving service:', error);
      throw error;
    }
  };

  const handleDelete = async () => {
    try {
      await ApplianceService.deleteAppliance(appliance.id);
      window.close();
    } catch (error) {
      console.error('Error deleting service:', error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        color: 'rgba(255, 255, 255, 0.7)'
      }}>
        Service wird geladen...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        color: '#ff4444',
        textAlign: 'center',
        padding: '20px'
      }}>
        {error}
      </div>
    );
  }

  if (!appliance) {
    return null;
  }

  return (
    <AuthProvider>
      <SSEProvider>
        <div style={{
          height: '100vh',
          width: '100vw',
          background: 'var(--bg-primary)',
          overflow: 'hidden'
        }}>
          <ServicePanel
            isOpen={true}
            onClose={() => window.close()}
            appliance={appliance}
            onSave={handleSave}
            onDelete={handleDelete}
            categories={[]}
            allServices={[appliance]}
            initialTab={activeTab}
            adminMode={true}
            isStandalone={true}
          />
        </div>
      </SSEProvider>
    </AuthProvider>
  );
};

export default StandaloneServicePanel;
