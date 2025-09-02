import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Slider,
  Stack,
  Button,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  IconButton,
  Tooltip,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
} from '@mui/material';
import {
  RotateCcw,
  Download,
  Upload,
  ChevronDown,
  Palette,
  Layers,
  Square,
  Type,
  Zap,
  Sparkles,
  Settings,
  Save,
  Copy,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import uiConfig, { useUIConfig } from '../../utils/uiConfigManager';

const UIConfigPanel = () => {
  const { t } = useTranslation();
  const { config, updateConfig, resetToDefaults } = useUIConfig();
  const [localConfig, setLocalConfig] = useState(config);
  const [hasChanges, setHasChanges] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const [importText, setImportText] = useState('');
  const [isSliderDragging, setIsSliderDragging] = useState(false);

  // Update local config when global config changes (but not during slider dragging)
  useEffect(() => {
    if (!isSliderDragging) {
      setLocalConfig(config);
    }
  }, [config, isSliderDragging]);

  // Handle slider changes (apply visually but don't save)
  const handleSliderChange = (key, value) => {
    // Set flag to prevent useEffect from overwriting
    setIsSliderDragging(true);
    
    // Update local state
    const newConfig = { ...localConfig, [key]: value };
    
    // Apply synchronization for sidebar values
    if (key === 'sidebarTransparency') {
      newConfig.headerTransparency = value;
      newConfig.panelTransparency = value;
    } else if (key === 'sidebarBlur') {
      newConfig.headerBlur = value;
      newConfig.panelBlur = value;
    } else if (key === 'sidebarTint') {
      newConfig.headerTint = value;
      newConfig.panelTint = value;
    }
    
    setLocalConfig(newConfig);
    setHasChanges(true);
    
    // Apply styles immediately for visual feedback
    // This updates the CSS variables directly without saving to storage
    const root = document.documentElement;
    if (key.includes('Transparency') || key.includes('Blur') || key.includes('Tint')) {
      // Apply the visual change immediately
      uiConfig.config = { ...uiConfig.config, ...newConfig };
      uiConfig.applyStyles();
    }
  };

  // Handle slider commit (save to global)
  const handleSliderCommit = (key, value) => {
    // Wenn Sidebar-Werte geändert werden, auch auf Header und Panels anwenden
    if (key === 'sidebarTransparency' || key === 'sidebarBlur' || key === 'sidebarTint') {
      const updates = { [key]: value };
      
      // Wende die gleichen Werte auf Header und Panels an
      if (key === 'sidebarTransparency') {
        updates.headerTransparency = value;
        updates.panelTransparency = value;
      } else if (key === 'sidebarBlur') {
        updates.headerBlur = value;
        updates.panelBlur = value;
      } else if (key === 'sidebarTint') {
        updates.headerTint = value;
        updates.panelTint = value;
      }
      
      updateConfig(updates);
      setLocalConfig(prev => ({ ...prev, ...updates }));
    } else {
      updateConfig({ [key]: value });
      setLocalConfig(prev => ({ ...prev, [key]: value }));
    }
    setHasChanges(false);
    
    // Reset flag after a short delay to allow state updates to complete
    setTimeout(() => setIsSliderDragging(false), 100);
  };

  // Save all changes
  const handleSaveAll = () => {
    updateConfig(localConfig);
    setHasChanges(false);
  };

  // Reset section
  const resetSection = (section) => {
    const defaults = uiConfig.getDefaultConfig();
    const sectionKeys = {
      general: ['inputTransparency', 'inputBlur', 'inputTint', 
                'modalTransparency', 'modalBlur', 'modalTint'],  // Modal-Settings hinzugefügt
      sidebar: ['sidebarTransparency', 'sidebarBlur', 'sidebarTint', 'sidebarWidth',
                'headerTransparency', 'headerBlur', 'headerTint',  // auch Header resetten
                'panelTransparency', 'panelBlur', 'panelTint'],    // auch Panels resetten
      cards: ['cardTransparency', 'cardBlur', 'cardTint', 'cardBorderOpacity', 'cardBorderRadius'],
    };

    const updates = {};
    sectionKeys[section].forEach(key => {
      updates[key] = defaults[key];
    });
    
    setLocalConfig(prev => ({ ...prev, ...updates }));
    updateConfig(updates);
  };

  // Export config
  const handleExport = () => {
    const json = uiConfig.exportConfig();
    navigator.clipboard.writeText(json);
    // Show success message
  };

  // Import config
  const handleImport = () => {
    if (uiConfig.importConfig(importText)) {
      setImportText('');
      setShowImportExport(false);
      // Show success message
    } else {
      // Show error message
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header with action buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">
          {t('settings.uiConfiguration')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {hasChanges && (
            <Button
              variant="contained"
              startIcon={<Save size={16} />}
              onClick={handleSaveAll}
              sx={{ 
                backgroundColor: '#4caf50',
                '&:hover': { backgroundColor: '#45a049' }
              }}
            >
              {t('common.saveAll')}
            </Button>
          )}
          <Tooltip title={t('settings.exportConfig')}>
            <IconButton onClick={handleExport} sx={{ color: 'white' }}>
              <Download size={20} />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('settings.importConfig')}>
            <IconButton onClick={() => setShowImportExport(!showImportExport)} sx={{ color: 'white' }}>
              <Upload size={20} />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('settings.resetAll')}>
            <IconButton onClick={() => {
              resetToDefaults();
              // Update local state with defaults
              const defaults = uiConfig.getDefaultConfig();
              setLocalConfig(defaults);
            }} sx={{ color: '#ff9800' }}>
              <RotateCcw size={20} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Import/Export Dialog */}
      {showImportExport && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t('settings.importExport')}
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={t('settings.pasteConfig')}
              sx={{ mb: 2 }}
            />
            <Button variant="contained" onClick={handleImport}>
              {t('common.import')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Allgemein Configuration */}
      <Accordion defaultExpanded sx={{ mb: 2 }}>
        <AccordionSummary expandIcon={<ChevronDown />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Layers size={20} />
            <Typography>{t('settings.general')}</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={3}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              {t('settings.uiElements')}
            </Typography>
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {t('settings.inputTransparency')}: {localConfig.inputTransparency ?? 25}%
              </Typography>
              <Slider
                value={localConfig.inputTransparency ?? 25}
                onChange={(e, v) => handleSliderChange('inputTransparency', v)}
                onChangeCommitted={(e, v) => handleSliderCommit('inputTransparency', v)}
                min={0}
                max={100}
                step={5}
                sx={{ color: '#00bcd4' }}
              />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {t('settings.inputBlur')}: {localConfig.inputBlur ?? 4}px
              </Typography>
              <Slider
                value={localConfig.inputBlur ?? 4}
                onChange={(e, v) => handleSliderChange('inputBlur', v)}
                onChangeCommitted={(e, v) => handleSliderCommit('inputBlur', v)}
                min={0}
                max={20}
                step={2}
                sx={{ color: '#00bcd4' }}
              />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {t('settings.inputTint')}: {(localConfig.inputTint ?? 0) > 0 ? '+' : ''}{localConfig.inputTint ?? 0}
              </Typography>
              <Slider
                value={localConfig.inputTint ?? 0}
                onChange={(e, v) => handleSliderChange('inputTint', v)}
                onChangeCommitted={(e, v) => handleSliderCommit('inputTint', v)}
                min={-30}
                max={30}
                step={5}
                marks={[{value: 0, label: '0'}]}
                sx={{ color: '#00bcd4' }}
              />
            </Box>
            
            <Divider sx={{ my: 2 }} />
            
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              {t('settings.dialogsModals')}
            </Typography>
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {t('settings.modalTransparency')}: {localConfig.modalTransparency ?? 20}%
              </Typography>
              <Slider
                value={localConfig.modalTransparency ?? 20}
                onChange={(e, v) => handleSliderChange('modalTransparency', v)}
                onChangeCommitted={(e, v) => handleSliderCommit('modalTransparency', v)}
                min={0}
                max={100}
                step={5}
                sx={{ color: '#9c27b0' }}
              />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {t('settings.modalBlur')}: {localConfig.modalBlur ?? 35}px
              </Typography>
              <Slider
                value={localConfig.modalBlur ?? 35}
                onChange={(e, v) => handleSliderChange('modalBlur', v)}
                onChangeCommitted={(e, v) => handleSliderCommit('modalBlur', v)}
                min={0}
                max={50}
                step={5}
                sx={{ color: '#9c27b0' }}
              />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {t('settings.modalTint')}: {(localConfig.modalTint ?? 0) > 0 ? '+' : ''}{localConfig.modalTint ?? 0}
              </Typography>
              <Slider
                value={localConfig.modalTint ?? 0}
                onChange={(e, v) => handleSliderChange('modalTint', v)}
                onChangeCommitted={(e, v) => handleSliderCommit('modalTint', v)}
                min={-30}
                max={30}
                step={5}
                marks={[{value: 0, label: '0'}]}
                sx={{ color: '#9c27b0' }}
              />
            </Box>
            
            <Button 
              startIcon={<RotateCcw size={16} />} 
              onClick={() => resetSection('general')}
              size="small"
            >
              {t('settings.resetSection')}
            </Button>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Sidebar Configuration */}
      <Accordion sx={{ mb: 2 }}>
        <AccordionSummary expandIcon={<ChevronDown />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Square size={20} />
            <Typography>{t('settings.sidebar')}</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={3}>
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {t('settings.width')}: {localConfig.sidebarWidth}px
              </Typography>
              <Slider
                value={localConfig.sidebarWidth}
                onChange={(e, v) => handleSliderChange('sidebarWidth', v)}
                onChangeCommitted={(e, v) => handleSliderCommit('sidebarWidth', v)}
                min={200}
                max={400}
                step={10}
                sx={{ color: '#2196f3' }}
              />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {t('settings.transparency')}: {localConfig.sidebarTransparency}%
              </Typography>
              <Slider
                value={localConfig.sidebarTransparency}
                onChange={(e, v) => handleSliderChange('sidebarTransparency', v)}
                onChangeCommitted={(e, v) => handleSliderCommit('sidebarTransparency', v)}
                min={0}
                max={100}
                step={5}
                sx={{ color: '#2196f3' }}
              />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {t('settings.blur')}: {localConfig.sidebarBlur}px
              </Typography>
              <Slider
                value={localConfig.sidebarBlur}
                onChange={(e, v) => handleSliderChange('sidebarBlur', v)}
                onChangeCommitted={(e, v) => handleSliderCommit('sidebarBlur', v)}
                min={0}
                max={50}
                step={5}
                sx={{ color: '#2196f3' }}
              />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {t('settings.tint')}: {(localConfig.sidebarTint ?? 0) > 0 ? '+' : ''}{localConfig.sidebarTint ?? 0}
              </Typography>
              <Slider
                value={localConfig.sidebarTint ?? 0}
                onChange={(e, v) => handleSliderChange('sidebarTint', v)}
                onChangeCommitted={(e, v) => handleSliderCommit('sidebarTint', v)}
                min={-50}
                max={50}
                step={5}
                marks={[{value: 0, label: '0'}]}
                sx={{ color: '#2196f3' }}
              />
            </Box>
            <Button 
              startIcon={<RotateCcw size={16} />} 
              onClick={() => resetSection('sidebar')}
              size="small"
            >
              {t('settings.resetSection')}
            </Button>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Karten Configuration */}
      <Accordion sx={{ mb: 2 }}>
        <AccordionSummary expandIcon={<ChevronDown />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Square size={20} />
            <Typography>{t('settings.cards')}</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={3}>
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {t('settings.cardTransparency')}: {localConfig.cardTransparency}%
              </Typography>
              <Slider
                value={localConfig.cardTransparency}
                onChange={(e, v) => handleSliderChange('cardTransparency', v)}
                onChangeCommitted={(e, v) => handleSliderCommit('cardTransparency', v)}
                min={0}
                max={100}
                step={5}
                sx={{ color: '#ff9800' }}
              />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {t('settings.blur')}: {localConfig.cardBlur ?? 5}px
              </Typography>
              <Slider
                value={localConfig.cardBlur ?? 5}
                onChange={(e, v) => handleSliderChange('cardBlur', v)}
                onChangeCommitted={(e, v) => handleSliderCommit('cardBlur', v)}
                min={0}
                max={30}
                step={2}
                sx={{ color: '#ff9800' }}
              />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {t('settings.cardTint')}: {(localConfig.cardTint ?? 0) > 0 ? '+' : ''}{localConfig.cardTint ?? 0}
              </Typography>
              <Slider
                value={localConfig.cardTint ?? 0}
                onChange={(e, v) => handleSliderChange('cardTint', v)}
                onChangeCommitted={(e, v) => handleSliderCommit('cardTint', v)}
                min={-50}
                max={50}
                step={5}
                marks={[{value: 0, label: '0'}]}
                sx={{ color: '#ff9800' }}
              />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {t('settings.cardRadius')}: {localConfig.cardBorderRadius}px
              </Typography>
              <Slider
                value={localConfig.cardBorderRadius}
                onChange={(e, v) => handleSliderChange('cardBorderRadius', v)}
                onChangeCommitted={(e, v) => handleSliderCommit('cardBorderRadius', v)}
                min={0}
                max={30}
                step={2}
                sx={{ color: '#ff9800' }}
              />
            </Box>
            <Button 
              startIcon={<RotateCcw size={16} />} 
              onClick={() => resetSection('cards')}
              size="small"
            >
              {t('settings.resetSection')}
            </Button>
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

export default UIConfigPanel;