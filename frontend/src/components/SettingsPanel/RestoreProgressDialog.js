import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Dialog, 
  DialogContent,
  DialogActions,
  DialogTitle,
  Typography, 
  LinearProgress, 
  Box,
  CircularProgress,
  Button,
  Alert,
  Chip,
  Grid,
  Paper,
  Fade,
  Grow,
  Stack
} from '@mui/material';
import {
  CheckCircle,
  Error as ErrorIcon,
  HourglassEmpty,
  CloudSync,
  Storage,
  Category,
  Computer,
  VpnKey,
  Settings,
  Analytics,
  SettingsEthernet,
  Circle,
  Person,
  Image
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

const RestoreProgressDialog = ({ open, sessionId, totalItems = {}, onClose, restoreComplete = false, restoreError = null }) => {
  console.log('🎭 RestoreProgressDialog rendered - open:', open, 'sessionId:', sessionId);
  
  const { t } = useTranslation();
  const { logout } = useAuth();
  const [progress, setProgress] = useState(0);
  const [currentMessage, setCurrentMessage] = useState(t('restore.processing'));
  const [currentStep, setCurrentStep] = useState('initializing');
  const [processedItems, setProcessedItems] = useState({});
  const [stepStatus, setStepStatus] = useState({});
  const eventSourceRef = useRef(null);
  
  // Icon mapping for different data types
  const getDataIcon = (key) => {
    const iconMap = {
      categories: <Category sx={{ fontSize: 18 }} />,
      users: <Person sx={{ fontSize: 18 }} />,
      ssh_keys: <VpnKey sx={{ fontSize: 18 }} />,
      hosts: <Computer sx={{ fontSize: 18 }} />,
      appliances: <Storage sx={{ fontSize: 18 }} />,
      background_images: <Image sx={{ fontSize: 18 }} />,
      snmp_metrics: <Analytics sx={{ fontSize: 18 }} />,
      host_snmp_configs: <SettingsEthernet sx={{ fontSize: 18 }} />,
      host_metrics_logging: <Settings sx={{ fontSize: 18 }} />,
      host_monitoring_data: <Analytics sx={{ fontSize: 18 }} />,
      user_settings: <Settings sx={{ fontSize: 18 }} />
    };
    return iconMap[key] || <Storage sx={{ fontSize: 18 }} />;
  };
  
  const handleComplete = () => {
    console.log('🔄 handleComplete called, currentStep:', currentStep);
    
    // Close SSE connection if open
    if (eventSourceRef.current) {
      console.log('🔌 Closing SSE connection');
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    // If restore was successful, logout to restart with new data
    if (currentStep === 'complete') {
      console.log('✅ Restore was successful, initiating logout...');
      // Small delay to ensure dialog closes smoothly
      setTimeout(() => {
        console.log('📤 Executing logout after successful restore...');
        logout(); // Use the logout function from useAuth
        // Force a page reload as fallback
        setTimeout(() => {
          console.log('🔄 Forcing page reload as fallback...');
          window.location.reload();
        }, 500);
      }, 300);
    } else {
      console.log('⚠️ Restore not complete, currentStep:', currentStep);
    }
    
    // Close dialog after handling logout
    if (onClose) {
      console.log('🚪 Closing dialog');
      onClose();
    }
  };

  // Setup SSE connection when sessionId is available
  useEffect(() => {
    if (!open || !sessionId) {
      console.log('RestoreProgressDialog: Not connecting SSE - open:', open, 'sessionId:', sessionId);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    console.log('RestoreProgressDialog: Connecting to SSE for restore progress, sessionId:', sessionId);
    
    // Create EventSource connection
    const eventSource = new EventSource(`/api/restore/progress/${sessionId}`);
    eventSourceRef.current = eventSource;
    
    eventSource.onopen = () => {
      console.log('SSE connection opened');
    };
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('SSE update received:', data);
        
        switch (data.type) {
          case 'connected':
            console.log('Connected to restore progress stream');
            break;
            
          case 'state':
            // Initial state from server
            if (data.progress !== undefined) setProgress(data.progress);
            if (data.currentStep) setCurrentStep(data.currentStep);
            if (data.processedItems) setProcessedItems(data.processedItems);
            if (data.message) setCurrentMessage(data.message);
            break;
            
          case 'init':
            setCurrentMessage(data.message || t('restore.initializing'));
            break;
            
          case 'step':
            setCurrentStep(data.currentStep);
            setCurrentMessage(data.message);
            // Mark previous steps as complete, current as processing
            setStepStatus(prev => {
              const newStatus = { ...prev };
              // Mark all previous steps as complete
              Object.keys(prev).forEach(key => {
                if (prev[key] === 'processing') {
                  newStatus[key] = 'complete';
                }
              });
              // Mark current step as processing
              newStatus[data.currentStep] = 'processing';
              return newStatus;
            });
            break;
            
          case 'progress':
            setProgress(data.progress || 0);
            if (data.processedItems) {
              setProcessedItems(prev => ({
                ...prev,
                ...data.processedItems
              }));
            }
            if (data.message) {
              setCurrentMessage(data.message);
            }
            break;
            
          case 'step_complete':
            // Mark step as complete
            setStepStatus(prev => ({
              ...prev,
              [data.currentStep]: 'complete'
            }));
            break;
            
          case 'complete':
            console.log('🎯 SSE: Restore complete event received');
            setProgress(100);
            setCurrentMessage(t('restore.success') + ' ' + t('restore.restartRequired'));
            setCurrentStep('complete');
            console.log('📝 Setting currentStep to "complete"');
            // Mark all steps as complete
            const allComplete = {};
            Object.keys(totalItems).forEach(key => {
              if (totalItems[key] > 0) {
                allComplete[key] = 'complete';
              }
            });
            setStepStatus(allComplete);
            break;
            
          case 'error':
            setCurrentMessage(t('restore.errorPrefix', { message: data.message }));
            setCurrentStep('error');
            // Mark current step as error
            setStepStatus(prev => ({
              ...prev,
              [currentStep]: 'error'
            }));
            break;
            
          default:
            console.log('Unknown SSE event type:', data.type);
        }
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      // Don't close on error - let it reconnect
    };
    
    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [open, sessionId, totalItems]);

  useEffect(() => {
    if (!open) {
      setProgress(0);
      setCurrentMessage('Processing restore...');
      setCurrentStep('initializing');
      setProcessedItems({});
      setStepStatus({});
      return;
    }

    if (restoreComplete) {
      setProgress(100);
      setCurrentMessage('Restore completed successfully!');
      setCurrentStep('complete');
    } else if (restoreError) {
      setCurrentMessage(t('restore.errorPrefix', { message: restoreError }));
      setCurrentStep('error');
    }
  }, [open, restoreComplete, restoreError]);
  
  // Helper to format numbers
  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };
  
  // Helper to get step status icon - FIXED to avoid multiple spinners
  const getStepStatusIcon = (stepKey) => {
    const status = stepStatus[stepKey];
    
    // Completed step
    if (status === 'complete') {
      return (
        <Fade in={true} timeout={500}>
          <CheckCircle sx={{ fontSize: 20, color: '#4caf50' }} />
        </Fade>
      );
    }
    
    // Currently processing step (only one at a time)
    if (status === 'processing') {
      return (
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <CircularProgress 
            size={20} 
            thickness={5}
            sx={{ color: '#2196f3' }}
          />
          <Box sx={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
          }}>
            <Circle sx={{ fontSize: 8, color: '#2196f3', animation: 'pulse 1.5s infinite' }} />
          </Box>
        </Box>
      );
    }
    
    // Error state
    if (status === 'error') {
      return <ErrorIcon sx={{ fontSize: 20, color: '#f44336' }} />;
    }
    
    // Waiting state
    return <Circle sx={{ fontSize: 8, color: 'text.disabled', opacity: 0.3 }} />;
  };
  
  // Helper to get step styling
  const getStepStyling = (stepKey) => {
    const status = stepStatus[stepKey];
    
    if (status === 'complete') {
      return {
        bgcolor: 'rgba(76, 175, 80, 0.08)',
        borderColor: 'rgba(76, 175, 80, 0.3)',
        color: 'success.main'
      };
    }
    
    if (status === 'processing') {
      return {
        bgcolor: 'rgba(33, 150, 243, 0.08)',
        borderColor: 'rgba(33, 150, 243, 0.5)',
        color: 'primary.main',
        animation: 'pulseGlow 2s infinite'
      };
    }
    
    if (status === 'error') {
      return {
        bgcolor: 'rgba(244, 67, 54, 0.08)',
        borderColor: 'rgba(244, 67, 54, 0.3)',
        color: 'error.main'
      };
    }
    
    return {
      bgcolor: 'transparent',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      color: 'text.disabled'
    };
  };

  return (
    <Dialog 
      open={open} 
      maxWidth="md" 
      fullWidth
      disableEscapeKeyDown={true}
      onClose={(event, reason) => {
        // Dialog kann NUR über den OK-Button geschlossen werden
        return;
      }}
      PaperProps={{
        sx: {
          background: 'linear-gradient(145deg, rgba(25, 28, 31, 0.98) 0%, rgba(35, 39, 42, 0.98) 100%)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {currentStep === 'complete' ? (
            <Grow in={true} timeout={500}>
              <CheckCircle sx={{ fontSize: 32, color: '#4caf50' }} />
            </Grow>
          ) : currentStep === 'error' ? (
            <ErrorIcon sx={{ fontSize: 32, color: '#f44336' }} />
          ) : (
            <CloudSync sx={{ 
              fontSize: 32, 
              color: '#2196f3',
              animation: 'spin 2s linear infinite' 
            }} />
          )}
          <Typography variant="h5" sx={{ fontWeight: 500 }}>
            {currentStep === 'complete' ? t('restore.complete') : 
             currentStep === 'error' ? t('restore.failed') : 
             t('restore.title')}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {/* Success Alert */}
        {currentStep === 'complete' && (
          <Grow in={true} timeout={500}>
            <Alert 
              severity="success" 
              sx={{ 
                mb: 3,
                bgcolor: 'rgba(76, 175, 80, 0.08)',
                '& .MuiAlert-icon': {
                  color: '#4caf50'
                }
              }}
              icon={<CheckCircle />}
            >
              <Typography variant="body1">
                <strong>{t('restore.success')}</strong>
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>
                {t('restore.restartRequired')}
              </Typography>
            </Alert>
          </Grow>
        )}

        {/* Error Alert */}
        {currentStep === 'error' && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 3,
              bgcolor: 'rgba(244, 67, 54, 0.08)',
              '& .MuiAlert-icon': {
                color: '#f44336'
              }
            }}
            icon={<ErrorIcon />}
          >
            <Typography variant="body1">
              <strong>{t('restore.failed')}</strong>
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>
              {currentMessage}
            </Typography>
          </Alert>
        )}

        {/* Progress */}
        {currentStep !== 'complete' && currentStep !== 'error' && (
          <>
            {/* Current Status */}
            <Box sx={{ mb: 3 }}>
              <Stack spacing={1} sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ 
                  color: 'primary.main',
                  fontWeight: 500 
                }}>
                  {currentMessage}
                </Typography>
                {sessionId && (
                  <Typography variant="caption" sx={{ 
                    color: 'text.secondary',
                    opacity: 0.6,
                    fontFamily: 'monospace',
                    fontSize: '0.7rem'
                  }}>
                    {t('restore.session')}: {sessionId.substring(0, 8)}...
                  </Typography>
                )}
              </Stack>
              
              <Box sx={{ position: 'relative' }}>
                <LinearProgress 
                  variant={progress > 0 ? "determinate" : "indeterminate"}
                  value={progress}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 3,
                      background: 'linear-gradient(90deg, #2196f3 0%, #21cbf3 100%)',
                      boxShadow: '0 2px 8px rgba(33, 150, 243, 0.3)'
                    }
                  }}
                />
                <Typography variant="caption" sx={{ 
                  mt: 1, 
                  display: 'block', 
                  textAlign: 'center',
                  color: 'text.secondary',
                  fontWeight: 500
                }}>
                  {progress > 0 ? `${Math.round(progress)}%` : t('restore.initializing')}
                </Typography>
              </Box>
            </Box>

            {/* Items Grid - Improved Design */}
            <Paper sx={{ 
              p: 2.5, 
              background: 'linear-gradient(145deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.15) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: 2,
              boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.3)'
            }}>
              <Typography variant="caption" sx={{ 
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 1,
                color: 'text.secondary',
                mb: 2, 
                display: 'block' 
              }}>
                {t('restore.restoreItems')}
              </Typography>
              
              <Grid container spacing={1.5}>
                {Object.entries(totalItems)
                  .filter(([key, value]) => value > 0)
                  .map(([key, total]) => {
                    const processed = processedItems[key] || 0;
                    const displayKey = t(`restore.items.${key}`, key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
                    const progressPercent = total > 0 ? (processed / total) * 100 : 0;
                    const styling = getStepStyling(key);
                    
                    return (
                      <Grid item xs={12} sm={6} key={key}>
                        <Paper
                          elevation={0}
                          sx={{
                            p: 1.5,
                            border: '1px solid',
                            borderRadius: 1.5,
                            transition: 'all 0.3s ease',
                            position: 'relative',
                            overflow: 'hidden',
                            ...styling,
                            '&:hover': {
                              transform: 'translateY(-1px)',
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                            }
                          }}
                        >
                          {/* Progress background */}
                          <Box
                            sx={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              height: '100%',
                              width: `${progressPercent}%`,
                              bgcolor: styling.color === 'success.main' 
                                ? 'rgba(76, 175, 80, 0.1)' 
                                : 'rgba(33, 150, 243, 0.05)',
                              transition: 'width 0.5s ease',
                              borderRadius: 'inherit'
                            }}
                          />
                          
                          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ position: 'relative', zIndex: 1 }}>
                            {/* Icon */}
                            <Box sx={{ color: styling.color, opacity: 0.9 }}>
                              {getDataIcon(key)}
                            </Box>
                            
                            {/* Content */}
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="caption" sx={{ 
                                fontWeight: 600,
                                display: 'block',
                                color: styling.color,
                                fontSize: '0.75rem'
                              }}>
                                {displayKey}
                              </Typography>
                              <Typography variant="caption" sx={{ 
                                opacity: 0.8,
                                fontSize: '0.7rem'
                              }}>
                                {processed > 0 
                                  ? `${formatNumber(processed)} / ${formatNumber(total)}`
                                  : t('restore.itemsCount', { count: formatNumber(total) })
                                }
                              </Typography>
                            </Box>
                            
                            {/* Status Icon */}
                            <Box>
                              {getStepStatusIcon(key)}
                            </Box>
                          </Stack>
                        </Paper>
                      </Grid>
                    );
                  })}
              </Grid>
            </Paper>

            {/* Warning for large datasets */}
            {totalItems.snmp_metrics > 10000 && (
              <Fade in={true} timeout={1000}>
                <Alert 
                  severity="info" 
                  sx={{ 
                    mt: 2,
                    bgcolor: 'rgba(33, 150, 243, 0.08)',
                    border: '1px solid rgba(33, 150, 243, 0.2)'
                  }}
                >
                  <Typography variant="caption">
                    {t('restore.largeDatasetDetected', { count: formatNumber(totalItems.snmp_metrics) })}
                  </Typography>
                </Alert>
              </Fade>
            )}
          </>
        )}
      </DialogContent>
      
      {/* OK Button - only shown when complete or error */}
      {(currentStep === 'complete' || currentStep === 'error') && (
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button 
            variant="contained" 
            color={currentStep === 'complete' ? "success" : "primary"}
            size="large"
            fullWidth
            onClick={handleComplete}
            sx={{ 
              py: 1.5,
              fontSize: '1rem',
              fontWeight: 600,
              borderRadius: 2,
              textTransform: 'none',
              background: currentStep === 'complete' 
                ? 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)'
                : 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)',
              boxShadow: currentStep === 'complete'
                ? '0 4px 15px rgba(76, 175, 80, 0.3)'
                : '0 4px 15px rgba(33, 150, 243, 0.3)',
              '&:hover': {
                background: currentStep === 'complete'
                  ? 'linear-gradient(135deg, #45a049 0%, #388e3c 100%)'
                  : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                transform: 'translateY(-1px)',
                boxShadow: currentStep === 'complete'
                  ? '0 6px 20px rgba(76, 175, 80, 0.4)'
                  : '0 6px 20px rgba(33, 150, 243, 0.4)',
              }
            }}
          >
            {currentStep === 'complete' ? t('restore.restartNow') : t('restore.close')}
          </Button>
        </DialogActions>
      )}
      
      {/* Animations */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        
        @keyframes pulseGlow {
          0%, 100% { 
            box-shadow: 0 0 5px rgba(33, 150, 243, 0.2);
          }
          50% { 
            box-shadow: 0 0 15px rgba(33, 150, 243, 0.4);
          }
        }
      `}</style>
    </Dialog>
  );
};

export default RestoreProgressDialog;