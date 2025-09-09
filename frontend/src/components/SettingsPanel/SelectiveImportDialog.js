import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Box,
  Alert,
  CircularProgress,
  Divider,
  Chip,
} from '@mui/material';
import {
  FolderOpen,
  Users,
  Server,
  Key,
  BarChart,
  Settings,
  Image,
  Shield,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const SelectiveImportDialog = ({ open, onClose, backupData }) => {
  const { t } = useTranslation();
  const [selectedItems, setSelectedItems] = useState({});
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  // Initialize selection state when backup data changes
  useEffect(() => {
    if (backupData) {
      const availableItems = {};
      
      // Check what data is available in the backup
      if (backupData.data?.categories?.length > 0) {
        availableItems.categories = false;
      }
      if (backupData.data?.users?.length > 0) {
        availableItems.users = false;
      }
      if (backupData.data?.hosts?.length > 0) {
        availableItems.hosts = false;
      }
      if (backupData.data?.ssh_keys?.length > 0) {
        availableItems.sshKeys = false;
      }
      if (backupData.data?.appliances?.length > 0) {
        availableItems.appliances = false;
      }
      if (backupData.data?.background_images?.length > 0) {
        availableItems.backgroundImages = false;
      }
      if (backupData.data?.snmp_metrics?.length > 0) {
        availableItems.snmpMetrics = false;
      }
      if (backupData.data?.user_settings?.length > 0 || backupData.data?.settings?.length > 0) {
        availableItems.userSettings = false;
      }
      
      setSelectedItems(availableItems);
    }
  }, [backupData]);

  const handleToggle = (key) => {
    setSelectedItems(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleImport = async () => {
    setImporting(true);
    setError('');

    try {
      // Prepare filtered backup data
      const filteredData = {
        ...backupData,
        data: {}
      };

      // Add only selected items
      if (selectedItems.categories) {
        filteredData.data.categories = backupData.data.categories;
      }
      if (selectedItems.users) {
        filteredData.data.users = backupData.data.users;
      }
      if (selectedItems.hosts) {
        filteredData.data.hosts = backupData.data.hosts;
      }
      if (selectedItems.sshKeys) {
        filteredData.data.ssh_keys = backupData.data.ssh_keys;
      }
      if (selectedItems.appliances) {
        filteredData.data.appliances = backupData.data.appliances;
      }
      if (selectedItems.backgroundImages) {
        filteredData.data.background_images = backupData.data.background_images;
      }
      if (selectedItems.snmpMetrics) {
        filteredData.data.snmp_metrics = backupData.data.snmp_metrics;
        filteredData.data.host_monitoring_data = backupData.data.host_monitoring_data;
      }
      if (selectedItems.userSettings) {
        filteredData.data.user_settings = backupData.data.user_settings || backupData.data.settings;
      }

      // TODO: Call the selective import API endpoint
      // const response = await BackupService.selectiveImport(filteredData);
      
      // For now, just show a message
      console.log('Selective import data:', filteredData);
      
      // Simulate success
      setTimeout(() => {
        setImporting(false);
        onClose();
        // Show success message
        window.location.reload(); // Temporary - should update UI without reload
      }, 2000);

    } catch (err) {
      setError(err.message || t('settings.errors.importFailed'));
      setImporting(false);
    }
  };

  const importOptions = [
    {
      key: 'categories',
      label: t('categories.categories'),
      icon: <FolderOpen size={20} />,
      count: backupData?.data?.categories?.length || 0,
      color: '#4CAF50'
    },
    {
      key: 'users',
      label: t('users.title'),
      icon: <Users size={20} />,
      count: backupData?.data?.users?.length || 0,
      color: '#2196F3'
    },
    {
      key: 'hosts',
      label: t('hosts.title'),
      icon: <Server size={20} />,
      count: backupData?.data?.hosts?.length || 0,
      color: '#FF9800'
    },
    {
      key: 'sshKeys',
      label: t('sshKeys.title'),
      icon: <Key size={20} />,
      count: backupData?.data?.ssh_keys?.length || 0,
      color: '#9C27B0'
    },
    {
      key: 'appliances',
      label: t('services.services'),
      icon: <Settings size={20} />,
      count: backupData?.data?.appliances?.length || 0,
      color: '#F44336'
    },
    {
      key: 'backgroundImages',
      label: t('settings.backgroundImages'),
      icon: <Image size={20} />,
      count: backupData?.data?.background_images?.length || 0,
      color: '#00BCD4'
    },
    {
      key: 'snmpMetrics',
      label: t('monitoring.metrics'),
      icon: <BarChart size={20} />,
      count: backupData?.data?.snmp_metrics?.length || 0,
      color: '#FF5722',
      warning: t('settings.largeDataWarning')
    },
    {
      key: 'userSettings',
      label: t('settings.userSettings'),
      icon: <Shield size={20} />,
      count: backupData?.data?.user_settings?.length || backupData?.data?.settings?.length || 0,
      color: '#795548'
    }
  ];

  const selectedCount = Object.values(selectedItems).filter(v => v).length;

  return (
    <Dialog
      open={open}
      onClose={!importing ? onClose : undefined}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#1E1E1E',
          backgroundImage: 'none',
        },
      }}
    >
      <DialogTitle sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <Typography variant="h6">
          {t('settings.selectiveImport')}
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            {t('settings.selectiveImportInfo')}
          </Typography>
        </Alert>

        <FormGroup>
          {importOptions.map(option => {
            const isAvailable = option.key in selectedItems;
            const isSelected = selectedItems[option.key];
            
            if (!isAvailable) return null;
            
            return (
              <Box key={option.key} sx={{ mb: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={isSelected}
                      onChange={() => handleToggle(option.key)}
                      disabled={importing}
                      sx={{
                        color: option.color,
                        '&.Mui-checked': {
                          color: option.color,
                        },
                      }}
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {option.icon}
                        <Typography variant="body1">{option.label}</Typography>
                      </Box>
                      <Chip
                        label={option.count}
                        size="small"
                        sx={{
                          backgroundColor: 'rgba(255, 255, 255, 0.1)',
                          color: 'rgba(255, 255, 255, 0.7)',
                        }}
                      />
                    </Box>
                  }
                />
                {option.warning && isSelected && (
                  <Alert severity="warning" sx={{ ml: 4, mt: 1 }}>
                    <Typography variant="caption">{option.warning}</Typography>
                  </Alert>
                )}
              </Box>
            );
          })}
        </FormGroup>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            {t('settings.selectedItems')}: {selectedCount}
          </Typography>
          {backupData && (
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
              {t('backup.backupCreatedAt')}: {new Date(backupData.created_at).toLocaleString()}
            </Typography>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <Button
          onClick={onClose}
          disabled={importing}
          sx={{
            color: 'rgba(255, 255, 255, 0.7)',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            },
          }}
        >
          {t('common.cancel')}
        </Button>
        <Button
          onClick={handleImport}
          variant="contained"
          disabled={importing || selectedCount === 0}
          startIcon={importing ? <CircularProgress size={20} /> : null}
          sx={{
            backgroundColor: '#0066CC',
            '&:hover': {
              backgroundColor: '#0051A2',
            },
          }}
        >
          {importing ? t('settings.importing') : t('settings.importSelected')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SelectiveImportDialog;
