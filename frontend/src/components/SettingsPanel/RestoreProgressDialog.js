import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  Typography, 
  LinearProgress, 
  Box,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Fade
} from '@mui/material';
import {
  CheckCircle,
  HourglassEmpty,
  Storage,
  Settings,
  Group,
  Image,
  Terminal,
  CloudSync,
  Analytics,
  Key
} from '@mui/icons-material';

const RestoreProgressDialog = ({ open, totalItems = {}, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [currentMessage, setCurrentMessage] = useState('Initializing restore...');
  
  // Define restore steps with estimated time percentages
  const steps = [
    { 
      id: 'init', 
      label: 'Initializing', 
      icon: <HourglassEmpty />, 
      weight: 5,
      message: 'Preparing database...'
    },
    { 
      id: 'categories', 
      label: 'Categories', 
      icon: <Storage />, 
      weight: 5,
      count: totalItems.categories || 0,
      message: 'Restoring categories...'
    },
    { 
      id: 'appliances', 
      label: 'Services', 
      icon: <Settings />, 
      weight: 10,
      count: totalItems.appliances || 0,
      message: 'Restoring services...'
    },
    { 
      id: 'users', 
      label: 'Users', 
      icon: <Group />, 
      weight: 5,
      count: totalItems.users || 0,
      message: 'Restoring user accounts...'
    },
    { 
      id: 'backgrounds', 
      label: 'Images', 
      icon: <Image />, 
      weight: 10,
      count: totalItems.background_images || 0,
      message: 'Restoring background images...'
    },
    { 
      id: 'hosts', 
      label: 'Hosts', 
      icon: <Terminal />, 
      weight: 10,
      count: totalItems.hosts || 0,
      message: 'Restoring host configurations...'
    },
    { 
      id: 'ssh', 
      label: 'SSH Keys', 
      icon: <Key />, 
      weight: 5,
      count: totalItems.ssh_keys || 0,
      message: 'Restoring SSH keys...'
    },
    { 
      id: 'snmp', 
      label: 'SNMP Metrics', 
      icon: <Analytics />, 
      weight: 40, // SNMP takes the most time
      count: totalItems.snmp_metrics || 0,
      message: 'Restoring monitoring data (this may take a while)...'
    },
    { 
      id: 'finalize', 
      label: 'Finalizing', 
      icon: <CloudSync />, 
      weight: 10,
      message: 'Completing restore process...'
    }
  ];

  // Calculate total weight
  const totalWeight = steps.reduce((sum, step) => sum + step.weight, 0);

  useEffect(() => {
    if (!open) {
      setCurrentStep(0);
      setProgress(0);
      setCurrentMessage('Initializing restore...');
      return;
    }

    // Simulate progress through steps
    let currentProgress = 0;
    let stepIndex = 0;

    const progressInterval = setInterval(() => {
      if (stepIndex >= steps.length) {
        clearInterval(progressInterval);
        setProgress(100);
        setCurrentMessage('Restore complete!');
        setTimeout(() => {
          onClose && onClose();
        }, 2000);
        return;
      }

      const step = steps[stepIndex];
      setCurrentStep(stepIndex);
      setCurrentMessage(step.message);

      // Calculate step duration based on weight and item count
      const itemCount = step.count || 1;
      const stepDuration = (step.weight / totalWeight) * 100;
      
      // For SNMP data, show more granular progress
      if (step.id === 'snmp' && itemCount > 1000) {
        const batchSize = 1000;
        const batches = Math.ceil(itemCount / batchSize);
        let batch = 0;
        
        const batchInterval = setInterval(() => {
          batch++;
          if (batch >= batches) {
            clearInterval(batchInterval);
            currentProgress += stepDuration;
            setProgress(Math.min(currentProgress, 100));
            stepIndex++;
          } else {
            const batchProgress = (batch / batches) * stepDuration;
            setProgress(Math.min(currentProgress + batchProgress, 100));
            setCurrentMessage(`Processing batch ${batch}/${batches} (${batch * batchSize}/${itemCount} metrics)...`);
          }
        }, 500);
        
        return;
      }

      // For other steps, simple progress
      currentProgress += stepDuration;
      setProgress(Math.min(currentProgress, 100));
      stepIndex++;

      // Adjust timing based on item count
      const nextStepDelay = Math.max(500, Math.min(3000, itemCount * 2));
      setTimeout(() => {}, nextStepDelay);
    }, 1000);

    return () => clearInterval(progressInterval);
  }, [open, totalItems]);

  return (
    <Dialog 
      open={open} 
      maxWidth="sm" 
      fullWidth
      disableEscapeKeyDown
      PaperProps={{
        sx: {
          background: 'rgba(30, 30, 30, 0.98)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }
      }}
    >
      <DialogContent sx={{ p: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <CircularProgress 
            size={60} 
            thickness={3}
            sx={{ mb: 2 }}
          />
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
            Restoring Backup
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {currentMessage}
          </Typography>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Progress
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {Math.round(progress)}%
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={progress}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
                background: 'linear-gradient(90deg, #007aff 0%, #0051a8 100%)',
              }
            }}
          />
        </Box>

        <List sx={{ maxHeight: 300, overflow: 'auto' }}>
          {steps.map((step, index) => (
            <Fade in={index <= currentStep} timeout={500} key={step.id}>
              <ListItem>
                <ListItemIcon>
                  {index < currentStep ? (
                    <CheckCircle sx={{ color: 'success.main' }} />
                  ) : index === currentStep ? (
                    <CircularProgress size={20} />
                  ) : (
                    <Box sx={{ opacity: 0.3 }}>{step.icon}</Box>
                  )}
                </ListItemIcon>
                <ListItemText 
                  primary={step.label}
                  secondary={step.count ? `${step.count} items` : null}
                  primaryTypographyProps={{
                    sx: { 
                      fontWeight: index === currentStep ? 600 : 400,
                      color: index < currentStep ? 'success.main' : 
                             index === currentStep ? 'primary.main' : 'text.secondary'
                    }
                  }}
                />
              </ListItem>
            </Fade>
          ))}
        </List>

        {totalItems.snmp_metrics > 10000 && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(255, 193, 7, 0.1)', borderRadius: 1 }}>
            <Typography variant="caption" color="warning.main">
              ⚠️ Large dataset detected ({totalItems.snmp_metrics.toLocaleString()} metrics). 
              This may take several minutes to complete.
            </Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RestoreProgressDialog;
