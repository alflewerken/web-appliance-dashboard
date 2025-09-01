import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  FormGroup,
  FormControlLabel,
  Switch,
  Slider,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  Alert,
  Divider,
  Stack,
} from '@mui/material';
import { Upload, X, Image, Layers } from 'lucide-react';
import '../../styles/PositionGrid.css';

// Memoized Preview Component - IMMER sichtbar
const BackgroundPreview = memo(({ 
  currentBackground, 
  opacity, 
  blur, 
  position 
}) => {
  const { t } = useTranslation();
  
  if (!currentBackground?.filename) {
    return (
      <Box
        sx={{
          width: '100%',
          height: 200,
          borderRadius: 2,
          backgroundColor: 'rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px dashed rgba(255,255,255,0.3)',
        }}
      >
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
          {t('settings.backgroundNoSelected')}
        </Typography>
      </Box>
    );
  }
  
  const imageUrl = `/uploads/backgrounds/${currentBackground.filename}`;
  const positionMap = {
    'top-left': '0% 0%',
    'top-center': '50% 0%',
    'top-right': '100% 0%',
    'center-left': '0% 50%',
    'center': '50% 50%',
    'center-right': '100% 50%',
    'bottom-left': '0% 100%',
    'bottom-center': '50% 100%',
    'bottom-right': '100% 100%'
  };

  return (
    <Box
      sx={{
        width: '100%',
        height: 200,
        borderRadius: 2,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#000',
      }}
    >
      <Box
        sx={{
          width: '100%',
          height: '100%',
          backgroundImage: `url(${imageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: positionMap[position] || '50% 50%',
          opacity: opacity / 100,
          filter: blur > 0 ? `blur(${blur}px)` : 'none',
        }}
      />
    </Box>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.currentBackground?.id === nextProps.currentBackground?.id &&
    prevProps.opacity === nextProps.opacity &&
    prevProps.blur === nextProps.blur &&
    prevProps.position === nextProps.position
  );
});

const BackgroundSettingsMUI = ({
  backgroundSettings,
  setBackgroundSettings,
  backgroundImages,
  setBackgroundImages,
  currentBackground,
  onActivateBackground,
  onDeleteBackground,
  SettingsService,
  backgroundSyncManager,
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  
  // Local state for sliders (prevents SSE flooding during drag)
  const [localOpacity, setLocalOpacity] = useState(backgroundSettings?.opacity || 30);
  const [localBlur, setLocalBlur] = useState(backgroundSettings?.blur || 0);
  
  // UI customization states
  const [cardTransparency, setCardTransparency] = useState(
    backgroundSettings?.uiSettings?.cardTransparency || 85
  );
  const [cardTint, setCardTint] = useState(
    backgroundSettings?.uiSettings?.cardTint || 0
  );
  const [inputTransparency, setInputTransparency] = useState(
    backgroundSettings?.uiSettings?.inputTransparency || 95
  );
  const [inputTint, setInputTint] = useState(
    backgroundSettings?.uiSettings?.inputTint || 0
  );
  
  // Initialize UI settings on mount
  useEffect(() => {
    const loadUISettings = async () => {
      try {
        // Try to load from database first
        const response = await SettingsService.getSetting('ui_settings');
        if (response && response.value) {
          const settings = JSON.parse(response.value);
          setCardTransparency(settings.cardTransparency || 85);
          setCardTint(settings.cardTint || 0);
          setInputTransparency(settings.inputTransparency || 95);
          setInputTint(settings.inputTint || 0);
          
          // Also save to localStorage
          localStorage.setItem('ui_settings', response.value);
          window.dispatchEvent(new Event('uiSettingsChanged'));
        }
      } catch (error) {
        console.log('Using default UI settings');
      }
    };
    
    loadUISettings();
  }, [SettingsService]);

  // Update local state when backgroundSettings change from SSE
  useEffect(() => {
    setLocalOpacity(backgroundSettings?.opacity || 30);
    setLocalBlur(backgroundSettings?.blur || 0);
    setCardTransparency(backgroundSettings?.uiSettings?.cardTransparency || 85);
    setCardTint(backgroundSettings?.uiSettings?.cardTint || 0);
    setInputTransparency(backgroundSettings?.uiSettings?.inputTransparency || 95);
    setInputTint(backgroundSettings?.uiSettings?.inputTint || 0);
  }, [backgroundSettings?.opacity, backgroundSettings?.blur, 
      backgroundSettings?.uiSettings?.cardTransparency, backgroundSettings?.uiSettings?.cardTint,
      backgroundSettings?.uiSettings?.inputTransparency, backgroundSettings?.uiSettings?.inputTint]);

  // Funktion zum Speichern der Settings in der Datenbank
  const saveSettingsToDatabase = useCallback(async (settings) => {
    try {
      // Speichere Opacity
      if (settings.opacity !== undefined) {
        await SettingsService.updateSetting('background_opacity', settings.opacity.toString());
      }
      
      // Speichere Blur
      if (settings.blur !== undefined) {
        await SettingsService.updateSetting('background_blur', settings.blur.toString());
      }
      
      // Speichere Position
      if (settings.position !== undefined) {
        await SettingsService.updateSetting('background_position', settings.position);
      }
      
      // Speichere Transparency Panels
      if (settings.transparency?.panels !== undefined) {
        await SettingsService.updateSetting('transparent_panels', settings.transparency.panels.toString());
      }
    } catch (error) {
      console.error('Error saving settings to database:', error);
    }
  }, [SettingsService]);

  // Handler für Panel Transparency
  const handleTransparencyToggle = useCallback(async (checked) => {
    setTransparentPanels(checked);
    const newSettings = {
      ...backgroundSettings,
      transparency: {
        ...backgroundSettings?.transparency,
        panels: checked
      }
    };
    setBackgroundSettings(newSettings);
    
    // Apply transparency immediately
    if (checked) {
      document.body.classList.add('transparent-panels');
    } else {
      document.body.classList.remove('transparent-panels');
    }
    
    // Save to database
    await saveSettingsToDatabase({ transparency: { panels: checked } });
  }, [setBackgroundSettings, backgroundSettings, saveSettingsToDatabase]);

  // Handler für Position
  const handlePositionChange = useCallback(async (position) => {
    const newSettings = {
      ...backgroundSettings,
      position
    };
    setBackgroundSettings(newSettings);
    
    // Save to database
    await saveSettingsToDatabase({ position });
  }, [setBackgroundSettings, backgroundSettings, saveSettingsToDatabase]);

  // Handler für Opacity mit Datenbank-Speicherung
  const handleOpacityCommit = useCallback(async (value) => {
    const newSettings = {
      ...backgroundSettings,
      opacity: value
    };
    setBackgroundSettings(newSettings);
    
    // Save to database
    await saveSettingsToDatabase({ opacity: value });
  }, [setBackgroundSettings, backgroundSettings, saveSettingsToDatabase]);

  // Handler für Blur mit Datenbank-Speicherung
  const handleBlurCommit = useCallback(async (value) => {
    const newSettings = {
      ...backgroundSettings,
      blur: value
    };
    setBackgroundSettings(newSettings);
    
    // Save to database
    await saveSettingsToDatabase({ blur: value });
  }, [setBackgroundSettings, backgroundSettings, saveSettingsToDatabase]);

  // Handler für UI Settings
  const handleUISettingCommit = useCallback(async (setting, value) => {
    const newUISettings = {
      cardTransparency: setting === 'cardTransparency' ? value : cardTransparency,
      cardTint: setting === 'cardTint' ? value : cardTint,
      inputTransparency: setting === 'inputTransparency' ? value : inputTransparency,
      inputTint: setting === 'inputTint' ? value : inputTint
    };
    
    const newSettings = {
      ...backgroundSettings,
      uiSettings: newUISettings
    };
    
    setBackgroundSettings(newSettings);
    
    // Save to localStorage for immediate effect
    localStorage.setItem('ui_settings', JSON.stringify(newUISettings));
    
    // Fire custom event for same-window listeners
    window.dispatchEvent(new Event('uiSettingsChanged'));
    
    // Save as JSON string to database
    await SettingsService.updateSetting('ui_settings', JSON.stringify(newUISettings));
    
    // Apply CSS variables globally
    const root = document.documentElement;
    if (setting === 'cardTransparency') {
      root.style.setProperty('--card-transparency', value / 100);
    } else if (setting === 'cardTint') {
      root.style.setProperty('--card-tint', value);
    } else if (setting === 'inputTransparency') {
      root.style.setProperty('--input-transparency', value / 100);
    } else if (setting === 'inputTint') {
      root.style.setProperty('--input-tint', value);
    }
  }, [cardTransparency, cardTint, inputTransparency, inputTint, backgroundSettings, setBackgroundSettings, SettingsService]);

  // File Upload Handler
  const handleFileUpload = useCallback(async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('background', file);

    try {
      const response = await fetch('/api/backgrounds/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (response.ok) {
        const newImage = await response.json();
        setBackgroundImages(prev => [...prev, newImage]);
        
        // Auto-activate if first image
        if (backgroundImages.length === 0) {
          onActivateBackground(newImage.id);
        }
      }
    } catch (error) {
      console.error('Upload failed:', error);
    }
    
    event.target.value = '';
  }, [backgroundImages.length, setBackgroundImages, onActivateBackground]);

  return (
    <Box sx={{ p: 3 }}>
      
      {/* Preview - IMMER sichtbar */}
      <Card className="settings-card" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ mb: 2 }}>
            {t('settings.backgroundPreview')}
          </Typography>
          <BackgroundPreview
            currentBackground={currentBackground}
            opacity={localOpacity}
            blur={localBlur}
            position={backgroundSettings?.position || 'center'}
          />
        </CardContent>
      </Card>

      {/* Settings Controls - Background Settings */}
      <Card className="settings-card" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            {t('settings.backgroundSettings', 'Hintergrund-Einstellungen')}
          </Typography>
          
          {/* Opacity und Blur in einer Zeile */}
          <Stack direction="row" spacing={3} sx={{ mb: 3 }}>
            {/* Opacity Slider */}
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {t('settings.backgroundOpacity')}: {localOpacity}%
              </Typography>
              <Slider
                value={localOpacity}
                onChange={(e, value) => setLocalOpacity(value)}
                onChangeCommitted={(e, value) => handleOpacityCommit(value)}
                min={0}
                max={100}
                step={5}
                size="small"
                sx={{
                  color: '#4caf50',
                  '& .MuiSlider-thumb': { 
                    backgroundColor: '#4caf50',
                    width: 16,
                    height: 16,
                  },
                  '& .MuiSlider-track': { backgroundColor: '#4caf50' },
                  '& .MuiSlider-rail': { backgroundColor: 'rgba(255,255,255,0.3)' },
                }}
              />
            </Box>
            
            {/* Blur Slider */}
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {t('settings.backgroundBlur')}: {localBlur}px
              </Typography>
              <Slider
                value={localBlur}
                onChange={(e, value) => setLocalBlur(value)}
                onChangeCommitted={(e, value) => handleBlurCommit(value)}
                min={0}
                max={20}
                step={1}
                size="small"
                sx={{
                  color: '#2196f3',
                  '& .MuiSlider-thumb': { 
                    backgroundColor: '#2196f3',
                    width: 16,
                    height: 16,
                  },
                  '& .MuiSlider-track': { backgroundColor: '#2196f3' },
                  '& .MuiSlider-rail': { backgroundColor: 'rgba(255,255,255,0.3)' },
                }}
              />
            </Box>
          </Stack>
          
          <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.1)' }} />
          
          {/* Position Grid - Zentriert */}
          <Box>
            <Typography variant="body2" sx={{ mb: 2, textAlign: 'center' }}>
              {t('settings.backgroundPosition')}
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Box className="position-grid">
                {['top-left', 'top-center', 'top-right',
                  'center-left', 'center', 'center-right',
                  'bottom-left', 'bottom-center', 'bottom-right'].map((pos) => (
                  <button
                    key={pos}
                    className={`position-button ${backgroundSettings?.position === pos ? 'active' : ''}`}
                    onClick={() => handlePositionChange(pos)}
                    aria-label={`${t('settings.backgroundPosition')} ${pos}`}
                  >
                    <div className="position-indicator" />
                  </button>
                ))}
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Image Gallery mit Upload Button */}
      <Card className="settings-card" sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">
              {t('settings.backgroundGallery')}
            </Typography>
            <Button
              variant="contained"
              size="small"
              startIcon={<Upload size={16} />}
              onClick={() => fileInputRef.current?.click()}
              sx={{
                backgroundColor: '#4caf50',
                '&:hover': { backgroundColor: '#45a049' },
                textTransform: 'none',
              }}
            >
              {t('settings.backgroundUpload')}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept="image/*"
              onChange={handleFileUpload}
            />
          </Box>
          
          {backgroundImages && backgroundImages.length > 0 ? (
            <ImageList cols={3} gap={8}>
              {backgroundImages.map((image) => (
                <ImageListItem 
                  key={image.id}
                  sx={{
                    border: currentBackground?.id === image.id ? '2px solid #4caf50' : '2px solid transparent',
                    borderRadius: 1,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'border 0.2s',
                    '&:hover': {
                      border: '2px solid rgba(76, 175, 80, 0.5)',
                    }
                  }}
                >
                  <img
                    src={`/uploads/backgrounds/${image.filename}`}
                    alt={image.originalName}
                    loading="lazy"
                    style={{ 
                      width: '100%', 
                      height: '100px', 
                      objectFit: 'cover' 
                    }}
                    onClick={() => onActivateBackground(image.id)}
                  />
                  <ImageListItemBar
                    sx={{ 
                      background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)' 
                    }}
                    actionIcon={
                      <IconButton
                        size="small"
                        sx={{ color: 'rgba(255, 255, 255, 0.8)' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteBackground(image.id);
                        }}
                        aria-label={t('common.delete')}
                      >
                        <X size={16} />
                      </IconButton>
                    }
                  />
                </ImageListItem>
              ))}
            </ImageList>
          ) : (
            <Box 
              sx={{ 
                py: 4, 
                textAlign: 'center',
                border: '1px dashed rgba(255,255,255,0.3)',
                borderRadius: 1,
                color: 'rgba(255,255,255,0.6)'
              }}
            >
              <Image size={48} style={{ marginBottom: 8, opacity: 0.5 }} />
              <Typography variant="body2">
                {t('settings.noBackgroundImages')}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default memo(BackgroundSettingsMUI);