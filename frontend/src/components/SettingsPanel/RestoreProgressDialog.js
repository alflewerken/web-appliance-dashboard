import React, { useState, useEffect } from 'react';
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
  Alert
} from '@mui/material';
import {
  CheckCircle,
  Error as ErrorIcon
} from '@mui/icons-material';

const RestoreProgressDialog = ({ open, totalItems = {}, onClose, restoreComplete = false, restoreError = null }) => {
  const [progress, setProgress] = useState(0);
  const [currentMessage, setCurrentMessage] = useState('Processing restore...');
  
  const handleComplete = () => {
    // Close dialog and logout
    if (onClose) {
      onClose();
    }
    setTimeout(() => {
      window.location.href = '/logout';
    }, 100);
  };

  useEffect(() => {
    if (!open) {
      setProgress(0);
      setCurrentMessage('Processing restore...');
      return;
    }

    if (restoreComplete) {
      setProgress(100);
      setCurrentMessage('Restore completed successfully!');
    } else if (restoreError) {
      setCurrentMessage(`Error: ${restoreError}`);
    } else {
      // Show indeterminate progress while waiting for backend
      setCurrentMessage('Processing restore... Please wait, this may take several minutes for large backups.');
      
      // Calculate estimated items
      const totalDataItems = Object.values(totalItems).reduce((sum, count) => sum + (count || 0), 0);
      if (totalDataItems > 10000) {
        setCurrentMessage(`Processing ${totalDataItems.toLocaleString()} items... This will take a few minutes.`);
      }
    }
  }, [open, restoreComplete, restoreError, totalItems]);

  return (
    <Dialog 
      open={open} 
      maxWidth="sm" 
      fullWidth
      disableEscapeKeyDown={true}
      onClose={(event, reason) => {
        // Dialog kann NUR über den OK-Button geschlossen werden
        return;
      }}
      PaperProps={{
        sx: {
          background: 'linear-gradient(135deg, rgba(30, 30, 30, 0.98) 0%, rgba(45, 45, 45, 0.98) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {restoreComplete ? (
            <CheckCircle sx={{ fontSize: 30, color: 'success.main' }} />
          ) : restoreError ? (
            <ErrorIcon sx={{ fontSize: 30, color: 'error.main' }} />
          ) : (
            <CircularProgress size={30} thickness={4} />
          )}
          <Typography variant="h5">
            {restoreComplete ? 'Restore Complete' : restoreError ? 'Restore Failed' : 'Restoring Backup'}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {/* Success Alert */}
        {restoreComplete && (
          <Alert 
            severity="success" 
            sx={{ mb: 3 }}
            icon={<CheckCircle />}
          >
            <Typography variant="body1">
              <strong>All data has been successfully restored!</strong>
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Click OK below to logout and apply the changes.
            </Typography>
          </Alert>
        )}

        {/* Error Alert */}
        {restoreError && (
          <Alert 
            severity="error" 
            sx={{ mb: 3 }}
            icon={<ErrorIcon />}
          >
            <Typography variant="body1">
              <strong>Restore failed!</strong>
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              {restoreError}
            </Typography>
          </Alert>
        )}

        {/* Progress */}
        {!restoreComplete && !restoreError && (
          <>
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {currentMessage}
              </Typography>
              <LinearProgress 
                variant="indeterminate"
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

            {/* Item counts */}
            <Box sx={{ 
              p: 2, 
              bgcolor: 'rgba(0, 0, 0, 0.2)', 
              borderRadius: 1,
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                Items to restore:
              </Typography>
              {Object.entries(totalItems).filter(([key, value]) => value > 0).map(([key, value]) => (
                <Typography key={key} variant="caption" sx={{ display: 'block', fontFamily: 'monospace', opacity: 0.7 }}>
                  • {key.replace(/_/g, ' ')}: {value.toLocaleString()}
                </Typography>
              ))}
            </Box>

            {/* Warning for large datasets */}
            {totalItems.snmp_metrics > 10000 && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                <Typography variant="caption">
                  Large dataset detected ({totalItems.snmp_metrics.toLocaleString()} metrics). 
                  This will take several minutes. Please be patient.
                </Typography>
              </Alert>
            )}
          </>
        )}
      </DialogContent>
      
      {/* OK Button - only shown when complete or error */}
      {(restoreComplete || restoreError) && (
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button 
            variant="contained" 
            color={restoreComplete ? "success" : "primary"}
            size="large"
            fullWidth
            onClick={handleComplete}
            sx={{ 
              py: 1.5,
              fontSize: '1rem',
              fontWeight: 600,
              background: restoreComplete 
                ? 'linear-gradient(90deg, #4caf50 0%, #45a049 100%)'
                : 'linear-gradient(90deg, #007aff 0%, #0051a8 100%)',
              '&:hover': {
                background: restoreComplete
                  ? 'linear-gradient(90deg, #45a049 0%, #388e3c 100%)'
                  : 'linear-gradient(90deg, #0051a8 0%, #003d7a 100%)',
              }
            }}
          >
            {restoreComplete ? 'OK - Logout and Restart' : 'OK - Close'}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default RestoreProgressDialog;
