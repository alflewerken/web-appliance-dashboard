import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import { Upload, X, Image, Layers } from 'lucide-react';
import '../styles/PositionGrid.css';

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
  // State für transparente Panels
  const [transparentPanels, setTransparentPanels] = useState(() => {
    const saved = localStorage.getItem('transparentPanels');
    return saved === 'true';
  });

  // Toggle Handler für transparente Panels
  const handleTransparentPanelsToggle = event => {
    const newValue = event.target.checked;
    setTransparentPanels(newValue);
    localStorage.setItem('transparentPanels', newValue);

    // Toggle CSS-Klasse auf Body
    if (newValue) {
      document.body.classList.add('transparent-panels');
    } else {
      document.body.classList.remove('transparent-panels');
    }
  };

  // Initial setup
  useEffect(() => {
    if (transparentPanels) {
      document.body.classList.add('transparent-panels');
    }
  }, []);

  const handleImageUpload = async file => {
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('/api/background/upload', {
        method: 'POST',
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setBackgroundImages([...backgroundImages, data.image]);
        if (onActivateBackground) {
          onActivateBackground(data.image.id);
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
    }
  };

  const positions = [
    { value: 'left top' },
    { value: 'center top' },
    { value: 'right top' },
    { value: 'left center' },
    { value: 'center center' },
    { value: 'right center' },
    { value: 'left bottom' },
    { value: 'center bottom' },
    { value: 'right bottom' },
  ];

  return (
    <Box sx={{ height: '100%', overflow: 'auto' }}>
      {/* Panel Transparency Toggle - GANZ OBEN */}
      <Card
        sx={{
          mb: 3,
          backgroundColor: '#1a1a1a',
          border: 'none',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        <CardContent>
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={transparentPanels}
                  onChange={handleTransparentPanelsToggle}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: '#007AFF',
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: '#007AFF',
                    },
                  }}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Layers size={20} />
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      Transparente Panels
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary', display: 'block' }}
                    >
                      Panels werden transparent mit Glassmorphism-Effekt
                      dargestellt
                    </Typography>
                  </Box>
                </Box>
              }
              sx={{
                margin: 0,
                '& .MuiFormControlLabel-label': {
                  flex: 1,
                },
              }}
            />
          </FormGroup>
        </CardContent>
      </Card>

      <Divider sx={{ mb: 3 }} />
      {/* Current Background Preview */}
      {currentBackground ? (
        <Card
          sx={{
            mb: 3,
            backgroundColor: '#1a1a1a',
            border: 'none',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              position: 'relative',
              width: '100%',
              aspectRatio: '2/1',
              backgroundColor: '#0a0a0a',
            }}
          >
            <img
              src={`/uploads/backgrounds/${currentBackground.filename}`}
              alt="Current background"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: backgroundSettings.opacity,
                filter: `blur(${backgroundSettings.blur}px)`,
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                background:
                  'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)',
                color: 'white !important',
                padding: '24px',
                textAlign: 'left',
                // Force white text in all modes
                '& *': {
                  color: 'white !important',
                },
              }}
            >
              <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 0.5, color: 'white !important' }}>
                Aktives Hintergrundbild {!backgroundSettings.enabled && '(Deaktiviert)'}
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9, mb: 0.5, color: 'white !important' }}>
                {currentBackground.filename}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.8, color: 'white !important' }}>
                {currentBackground.width || 2560}×
                {currentBackground.height || 1342} •{' '}
                {currentBackground.size || '566.7 KB'}
              </Typography>
            </Box>
          </Box>
        </Card>
      ) : (
        <Card
          sx={{
            mb: 3,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            textAlign: 'center',
            p: 4,
          }}
        >
          <Image
            size={48}
            style={{
              opacity: 0.3,
              marginBottom: 16,
              color: 'var(--text-secondary)',
            }}
          />
          <Typography color="text.secondary">
            Kein Hintergrundbild aktiv
          </Typography>
        </Card>
      )}

      {/* Settings Card */}
      <Card
        sx={{
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          mb: 3,
        }}
      >
        <CardContent>
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={backgroundSettings.enabled}
                  onChange={async e => {
                    const newValue = e.target.checked;
                    const newSettings = {
                      ...backgroundSettings,
                      enabled: newValue,
                    };
                    setBackgroundSettings(newSettings);
                    if (backgroundSyncManager) {
                      backgroundSyncManager.handleLocalUpdate(newSettings);
                    }

                    try {
                      // Update the setting in backend
                      await SettingsService.updateSetting(
                        'background_enabled',
                        newValue.toString()
                      );
                      
                      // Also update localStorage immediately for persistence
                      localStorage.setItem('backgroundSettings', JSON.stringify(newSettings));
                      
                      // Force update background styles
                      if (newValue) {
                        document.body.classList.add('has-background-image');
                        document.body.setAttribute('data-opacity', newSettings.opacity);
                        document.body.setAttribute('data-blur', newSettings.blur);
                      } else {
                        document.body.classList.remove('has-background-image');
                        document.body.removeAttribute('data-opacity');
                        document.body.removeAttribute('data-blur');
                      }
                    } catch (error) {
                      console.error(
                        'Error updating background enabled:',
                        error
                      );
                    }
                  }}
                />
              }
              label="Hintergrundbild aktivieren"
              sx={{ mb: 3 }}
            />

            <Box sx={{ mb: 3 }}>
              <Typography gutterBottom sx={{ color: 'var(--text-primary)' }}>
                Transparenz: {Math.round(backgroundSettings.opacity * 100)}%
              </Typography>
              <Slider
                value={backgroundSettings.opacity}
                onChange={async (e, newValue) => {
                  const newSettings = {
                    ...backgroundSettings,
                    opacity: newValue,
                  };
                  setBackgroundSettings(newSettings);
                  if (backgroundSyncManager) {
                    backgroundSyncManager.handleLocalUpdate(newSettings);
                  }

                  try {
                    await SettingsService.updateSetting(
                      'background_opacity',
                      newValue.toString()
                    );
                  } catch (error) {
                    console.error('Error updating opacity:', error);
                  }
                }}
                step={0.05}
                marks
                min={0}
                max={1}
                valueLabelDisplay="auto"
                valueLabelFormat={value => `${Math.round(value * 100)}%`}
              />
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography gutterBottom sx={{ color: 'var(--text-primary)' }}>
                Unschärfe: {backgroundSettings.blur}px
              </Typography>
              <Slider
                value={backgroundSettings.blur}
                onChange={async (e, newValue) => {
                  const newSettings = { ...backgroundSettings, blur: newValue };
                  setBackgroundSettings(newSettings);
                  if (backgroundSyncManager) {
                    backgroundSyncManager.handleLocalUpdate(newSettings);
                  }

                  try {
                    await SettingsService.updateSetting(
                      'background_blur',
                      newValue.toString()
                    );
                  } catch (error) {
                    console.error('Error updating blur:', error);
                  }
                }}
                step={1}
                marks
                min={0}
                max={20}
                valueLabelDisplay="auto"
                valueLabelFormat={value => `${value}px`}
              />
            </Box>
          </FormGroup>
        </CardContent>
      </Card>

      {/* Position Grid */}
      <Card
        sx={{
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          mb: 3,
        }}
      >
        <CardContent>
          <Typography
            variant="h6"
            gutterBottom
            sx={{ color: 'var(--text-primary)', mb: 3 }}
          >
            Bildausrichtung
          </Typography>
          <div className="position-grid-wrapper">
            <div className="position-grid-container">
              <div className="position-grid">
                {positions.map(pos => (
                  <button
                    key={pos.value}
                    className={`position-button ${backgroundSettings.position === pos.value ? 'active' : ''}`}
                    onClick={async () => {
                      const newSettings = {
                        ...backgroundSettings,
                        position: pos.value,
                      };
                      setBackgroundSettings(newSettings);
                      if (backgroundSyncManager) {
                        backgroundSyncManager.handleLocalUpdate(newSettings);
                      }

                      try {
                        await SettingsService.updateSetting(
                          'background_position',
                          pos.value
                        );
                      } catch (error) {
                        console.error('Error updating position:', error);
                      }
                    }}
                    title={pos.value}
                  >
                    <div className="position-indicator"></div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Image Gallery */}
      <Card
        sx={{
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 3,
            }}
          >
            <Typography variant="h6" sx={{ color: 'var(--text-primary)' }}>
              Bildergalerie
            </Typography>
            <Button
              variant="contained"
              startIcon={<Upload size={16} />}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = e => handleImageUpload(e.target.files[0]);
                input.click();
              }}
              sx={{
                backgroundColor: 'var(--primary-color)',
                '&:hover': {
                  backgroundColor: 'var(--primary-hover)',
                },
              }}
            >
              Bild hochladen
            </Button>
          </Box>

          {!backgroundImages || backgroundImages.length === 0 ? (
            <Box
              sx={{
                textAlign: 'center',
                py: 6,
                border: '2px dashed rgba(255, 255, 255, 0.2)',
                borderRadius: 1,
              }}
            >
              <Image
                size={48}
                style={{
                  opacity: 0.3,
                  marginBottom: 16,
                  color: 'var(--text-secondary)',
                }}
              />
              <Typography color="text.secondary" gutterBottom>
                Keine Bilder vorhanden
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Laden Sie Bilder hoch, um sie als Hintergrund zu verwenden
              </Typography>
            </Box>
          ) : (
            <ImageList
              sx={{ width: '100%', height: 'auto' }}
              cols={3}
              rowHeight={180}
            >
              {backgroundImages.map(image => (
                <ImageListItem
                  key={image.id}
                  sx={{
                    cursor: 'pointer',
                    border:
                      currentBackground?.id === image.id
                        ? '3px solid var(--primary-color)'
                        : '3px solid transparent',
                    borderRadius: 1,
                    overflow: 'hidden',
                    transition: 'all 0.2s',
                    '&:hover': {
                      transform: 'scale(1.05)',
                    },
                  }}
                  onClick={() =>
                    onActivateBackground && onActivateBackground(image.id)
                  }
                >
                  <img
                    src={`/uploads/backgrounds/${image.filename}`}
                    alt={image.name}
                    loading="lazy"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                  <ImageListItemBar
                    title={image.name}
                    actionIcon={
                      <IconButton
                        sx={{ color: 'rgba(255, 255, 255, 0.8)' }}
                        onClick={e => {
                          e.stopPropagation();
                          if (onDeleteBackground) {
                            onDeleteBackground(image.id);
                          }
                        }}
                      >
                        <X size={16} />
                      </IconButton>
                    }
                  />
                </ImageListItem>
              ))}
            </ImageList>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default BackgroundSettingsMUI;
