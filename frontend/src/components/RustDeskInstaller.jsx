import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  Typography, 
  CircularProgress,
  Alert,
  Box,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
  TextField
} from '@mui/material';
import { Check, X, Monitor, Download, Settings, Rocket, Edit2 } from 'lucide-react';
import axios from '../utils/axiosConfig';
import { useAuth } from '../contexts/AuthContext';

const RustDeskInstaller = ({ open, onClose, appliance, onSuccess }) => {
  const { token } = useAuth();
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [rustdeskId, setRustdeskId] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualId, setManualId] = useState('');
  const [installationStatus, setInstallationStatus] = useState({
    checking: false,
    downloading: false,
    configuring: false,
    starting: false,
    completed: false
  });

  const steps = [
    {
      label: 'Verbindung prüfen',
      description: 'SSH-Verbindung zum Host wird überprüft',
      icon: Monitor
    },
    {
      label: 'RustDesk herunterladen',
      description: 'RustDesk wird heruntergeladen und installiert',
      icon: Download
    },
    {
      label: 'Konfiguration',
      description: 'RustDesk wird konfiguriert',
      icon: Settings
    },
    {
      label: 'Start & ID-Generierung',
      description: 'RustDesk wird gestartet und ID generiert',
      icon: Rocket
    }
  ];

  useEffect(() => {
    if (appliance?.rustdeskInstalled || appliance?.rustdesk_installed) {
      if (appliance.rustdeskId || appliance.rustdesk_id) {
        setSuccess(true);
        setRustdeskId(appliance.rustdeskId || appliance.rustdesk_id || '');
      } else {
        // Installed but no ID - show manual input
        setShowManualInput(true);
        setActiveStep(4);
        setInstallationStatus({
          checking: true,
          downloading: true,
          configuring: true,
          starting: true,
          completed: true
        });
      }
    }
  }, [appliance]);

  const handleInstall = async () => {
    console.log('=== RustDesk Installation Started ===');
    console.log('Appliance:', appliance);
    
    // Prevent any default browser behavior
    if (window.event) {
      window.event.preventDefault();
      window.event.stopPropagation();
    }
    
    setInstalling(true);
    setError('');
    setSuccess(false);
    setActiveStep(0);

    // Simulate installation steps
    const updateStep = (step) => {
      setActiveStep(step);
      const statusKey = ['checking', 'downloading', 'configuring', 'starting'][step];
      setInstallationStatus(prev => ({
        ...prev,
        [statusKey]: true
      }));
    };

    try {
      // Start installation
      updateStep(0);
      
      console.log('Installing RustDesk on appliance:', appliance.id);
      
      // Debug: Log the exact URL being called
      const installUrl = `/api/rustdeskInstall/${appliance.id}`;
      console.log('Calling URL:', installUrl);
      console.log('Full URL would be:', window.location.origin + installUrl);
      
      const response = await axios.post(
        installUrl,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      console.log('Installation response:', response.data);

      // Simulate progress through steps
      for (let i = 1; i <= 3; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        updateStep(i);
      }

      if (response.data.success) {
        // Check if manual ID is required
        if (response.data.manualIdRequired || response.data.manual_id_required) {
          // Show manual input for ID
          setShowManualInput(true);
          setInstallationStatus(prev => ({ ...prev, completed: true }));
          setActiveStep(4);
          setError(''); // Clear any error
        } else if ((response.data.rustdeskId || response.data.rustdesk_id) === '999999999') {
          // Old placeholder logic
          setShowManualInput(true);
          setInstallationStatus(prev => ({ ...prev, completed: true }));
          setActiveStep(4);
        } else {
          setSuccess(true);
          setRustdeskId(response.data.rustdeskId || response.data.rustdesk_id);
          setInstallationStatus(prev => ({ ...prev, completed: true }));
          setActiveStep(4);
          
          if (onSuccess) {
            onSuccess(response.data.rustdeskId || response.data.rustdesk_id);
          }
        }
      } else if (response.data.already_installed) {
        setSuccess(true);
        setRustdeskId(response.data.rustdesk_id);
        setError('RustDesk ist bereits installiert');
      }
    } catch (err) {
      console.error('Installation error:', err);
      const errorMessage = err.response?.data?.error || 'Installation fehlgeschlagen';
      const errorDetails = err.response?.data?.details || '';
      
      setError(errorMessage + (errorDetails ? '\n' + errorDetails : ''));
      
      // If installation failed due to ID retrieval, show manual input
      if (err.response?.data?.details?.includes('Failed to get RustDesk ID')) {
        setShowManualInput(true);
      }
    } finally {
      setInstalling(false);
    }
  };

  const handleManualIdSave = async () => {
    if (!manualId || manualId.length !== 9 || !/^\d+$/.test(manualId)) {
      setError('Bitte geben Sie eine gültige 9-stellige RustDesk ID ein');
      return;
    }

    try {
      // Update only the RustDesk ID using dedicated endpoint
      const response = await axios.put(
        `/api/rustdeskInstall/${appliance.id}/id`,
        {
          rustdeskId: manualId
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data) {
        setSuccess(true);
        setRustdeskId(manualId);
        setShowManualInput(false);
        
        if (onSuccess) {
          onSuccess(manualId);
        }
      }
    } catch (err) {
      console.error('Error saving manual ID:', err);
      setError('Fehler beim Speichern der ID');
    }
  };

  const getStepIcon = (step, index) => {
    const Icon = step.icon;
    const isActive = activeStep === index;
    const isCompleted = activeStep > index || (success && index <= 3);
    
    return (
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isCompleted ? '#4CAF50' : isActive ? '#2196F3' : '#424242',
          color: 'white'
        }}
      >
        {isCompleted ? <Check size={20} /> : <Icon size={20} />}
      </Box>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          <Monitor />
          RustDesk Installation
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          {!installing && !success && !showManualInput && (
            <Alert severity="info" sx={{ mb: 3 }}>
              {appliance.rustdesk_installed && !appliance.rustdesk_id ? (
                <>
                  RustDesk ist bereits auf dem Host "{appliance.name}" installiert, 
                  aber die ID muss noch eingegeben werden.
                </>
              ) : (
                <>
                  RustDesk wird auf dem Host "{appliance.name}" installiert. 
                  Dies ermöglicht eine direkte Remote-Desktop-Verbindung ohne zusätzliche Konfiguration.
                </>
              )}
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                RustDesk wurde erfolgreich installiert!
              </Typography>
              {rustdeskId && (
                <Paper sx={{ p: 2, mt: 2, bgcolor: 'background.default' }}>
                  <Typography variant="body2" color="text.secondary">
                    RustDesk ID:
                  </Typography>
                  <Typography variant="h6" sx={{ fontFamily: 'monospace' }}>
                    {rustdeskId}
                  </Typography>
                </Paper>
              )}
            </Alert>
          )}

          {showManualInput && !success && (
            <Box sx={{ mt: 2 }}>
              <Alert severity="warning" sx={{ mb: 2 }}>
                RustDesk wurde installiert, aber die ID konnte nicht automatisch abgerufen werden. 
                Bitte starten Sie RustDesk auf dem Host und geben Sie die angezeigte ID manuell ein.
              </Alert>
              <Typography variant="body2" sx={{ mb: 2 }}>
                So finden Sie die RustDesk ID:
              </Typography>
              <Box component="ol" sx={{ pl: 2, mb: 2 }}>
                <Typography component="li" variant="body2">
                  Öffnen Sie RustDesk auf dem Host "{appliance.name}"
                </Typography>
                <Typography component="li" variant="body2">
                  Die 9-stellige ID wird im Hauptfenster angezeigt
                </Typography>
                <Typography component="li" variant="body2">
                  Geben Sie diese ID hier ein
                </Typography>
              </Box>
              <TextField
                fullWidth
                label="RustDesk ID (9 Ziffern)"
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                placeholder="123456789"
                inputProps={{ 
                  maxLength: 9,
                  pattern: '[0-9]*'
                }}
                error={manualId && (manualId.length !== 9 || !/^\d+$/.test(manualId))}
                helperText={manualId && (manualId.length !== 9 || !/^\d+$/.test(manualId)) ? 
                  'Die ID muss genau 9 Ziffern enthalten' : ''
                }
              />
            </Box>
          )}

          {installing && (
            <Box sx={{ mt: 2 }}>
              <Stepper activeStep={activeStep} orientation="vertical">
                {steps.map((step, index) => (
                  <Step key={step.label}>
                    <StepLabel
                      StepIconComponent={() => getStepIcon(step, index)}
                    >
                      {step.label}
                    </StepLabel>
                    <StepContent>
                      <Typography variant="body2" color="text.secondary">
                        {step.description}
                      </Typography>
                      {activeStep === index && (
                        <Box sx={{ mt: 1 }}>
                          <CircularProgress size={20} />
                        </Box>
                      )}
                    </StepContent>
                  </Step>
                ))}
              </Stepper>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        {!installing && !success && !showManualInput && (
          <>
            <Button onClick={onClose}>Abbrechen</Button>
            {!appliance.rustdesk_installed && (
              <Button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleInstall();
                }} 
                variant="contained" 
                startIcon={<Download />}
                type="button"
              >
                Installieren
              </Button>
            )}
          </>
        )}
        
        {showManualInput && !success && (
          <>
            <Button onClick={onClose}>Abbrechen</Button>
            <Button 
              onClick={handleManualIdSave} 
              variant="contained"
              disabled={!manualId || manualId.length !== 9 || !/^\d+$/.test(manualId)}
              startIcon={<Check />}
            >
              ID Speichern
            </Button>
          </>
        )}
        
        {(installing || success) && (
          <Button 
            onClick={onClose} 
            variant="contained"
            disabled={installing}
          >
            {installing ? 'Installation läuft...' : 'Schließen'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default RustDeskInstaller;
