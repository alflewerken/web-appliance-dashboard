import React, { useState, useEffect } from 'react';
import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Chip,
  Tooltip,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Speed,
  HighQuality,
  Balance,
  SignalCellularAlt,
  AdminPanelSettings,
  Computer,
  Movie
} from '@mui/icons-material';

/**
 * Guacamole Performance Selector
 * Ermöglicht Nutzern die Auswahl des optimalen Performance-Profils
 */
const GuacamolePerformanceSelector = ({ 
  onModeChange, 
  currentMode = 'admin',
  connectionLatency = null 
}) => {
  const [selectedMode, setSelectedMode] = useState(currentMode);
  const [performanceLevel, setPerformanceLevel] = useState('balanced');
  const [networkQuality, setNetworkQuality] = useState('testing');

  // Netzwerk-Qualität testen
  useEffect(() => {
    testNetworkQuality();
  }, []);

  const testNetworkQuality = async () => {
    try {
      const start = Date.now();
      await fetch('/api/appliances/ping', { method: 'HEAD' });
      const latency = Date.now() - start;

      if (latency < 20) {
        setNetworkQuality('excellent');
        setPerformanceLevel('high-quality');
      } else if (latency < 50) {
        setNetworkQuality('good');
        setPerformanceLevel('balanced');
      } else if (latency < 100) {
        setNetworkQuality('fair');
        setPerformanceLevel('performance');
      } else {
        setNetworkQuality('poor');
        setPerformanceLevel('low-bandwidth');
      }
    } catch (error) {
      setNetworkQuality('unknown');
      setPerformanceLevel('balanced');
    }
  };

  const handleModeChange = (event, newMode) => {
    if (newMode !== null) {
      setSelectedMode(newMode);
      
      // Automatische Performance-Anpassung basierend auf Mode
      const autoPerformance = {
        'admin': networkQuality === 'excellent' ? 'balanced' : 'performance',
        'desktop': 'balanced',
        'media': 'high-quality'
      };
      
      setPerformanceLevel(autoPerformance[newMode] || 'balanced');
      
      // Callback mit beiden Werten
      onModeChange(newMode, autoPerformance[newMode]);
    }
  };

  const getNetworkQualityColor = () => {
    switch (networkQuality) {
      case 'excellent': return 'success';
      case 'good': return 'primary';
      case 'fair': return 'warning';
      case 'poor': return 'error';
      default: return 'default';
    }
  };

  const getNetworkQualityLabel = () => {
    switch (networkQuality) {
      case 'excellent': return 'Exzellent (<20ms)';
      case 'good': return 'Gut (20-50ms)';
      case 'fair': return 'Mittel (50-100ms)';
      case 'poor': return 'Schlecht (>100ms)';
      case 'testing': return 'Teste...';
      default: return 'Unbekannt';
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="subtitle2">Netzwerk-Qualität:</Typography>
        {networkQuality === 'testing' ? (
          <CircularProgress size={20} />
        ) : (
          <Chip
            icon={<SignalCellularAlt />}
            label={getNetworkQualityLabel()}
            color={getNetworkQualityColor()}
            size="small"
          />
        )}
      </Box>

      <Typography variant="subtitle2" gutterBottom>
        Verwendungszweck wählen:
      </Typography>
      
      <ToggleButtonGroup
        value={selectedMode}
        exclusive
        onChange={handleModeChange}
        fullWidth
        size="small"
      >
        <ToggleButton value="admin">
          <Tooltip title="Terminal, Konfiguration, Dateiverwaltung - Optimiert für niedrige Latenz">
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <AdminPanelSettings />
              <Typography variant="caption">Admin</Typography>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.7 }}>
                15 FPS, 16-bit
              </Typography>
            </Box>
          </Tooltip>
        </ToggleButton>
        
        <ToggleButton value="desktop">
          <Tooltip title="Office, Entwicklung, normale Arbeit - Balancierte Einstellungen">
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Computer />
              <Typography variant="caption">Desktop</Typography>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.7 }}>
                30 FPS, 24-bit
              </Typography>
            </Box>
          </Tooltip>
        </ToggleButton>
        
        <ToggleButton value="media">
          <Tooltip title="Videos, Präsentationen, grafikintensive Anwendungen">
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Movie />
              <Typography variant="caption">Media</Typography>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.7 }}>
                60 FPS, 32-bit
              </Typography>
            </Box>
          </Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>

      {/* Performance-Level Anzeige */}
      <Box sx={{ mt: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Automatisch gewählte Qualität: {performanceLevel}
        </Typography>
      </Box>

      {/* Warnung bei schlechter Verbindung */}
      {networkQuality === 'poor' && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          Langsame Verbindung erkannt. Die Qualität wurde automatisch reduziert.
        </Alert>
      )}

      {/* Tipps */}
      <Box sx={{ mt: 2, p: 1, bgcolor: 'background.paper', borderRadius: 1 }}>
        <Typography variant="caption" color="text.secondary">
          💡 Tipp: {selectedMode === 'admin' 
            ? 'Admin-Modus ist perfekt für Konfiguration und Terminal-Arbeit'
            : selectedMode === 'desktop'
            ? 'Desktop-Modus bietet gute Balance zwischen Qualität und Performance'
            : 'Media-Modus nutzt maximale Qualität für beste Darstellung'}
        </Typography>
      </Box>
    </Box>
  );
};

export default GuacamolePerformanceSelector;
