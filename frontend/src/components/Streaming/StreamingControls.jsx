import React, { useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  Slider,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Collapse,
  Paper,
  Grid
} from '@mui/material';
import {
  PlayArrow,
  Stop,
  Settings,
  ExpandMore,
  ExpandLess,
  Gamepad2,
  Mouse,
  Keyboard,
  Speed,
  HighQuality,
  Router
} from '@mui/icons-material';

const StreamingControls = ({ 
  isStreaming, 
  settings, 
  onSettingsChange, 
  onStart, 
  onStop,
  streamStatus 
}) => {
  const [showSettings, setShowSettings] = useState(false);

  const resolutions = [
    '1280x720',
    '1920x1080',
    '2560x1440',
    '3840x2160'
  ];

  const frameRates = [30, 60, 90, 120, 144];
  const codecs = ['h264', 'h265', 'av1'];

  const handleSettingChange = (key, value) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <Box sx={{ p: 2 }}>
      {/* Main Controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        {!isStreaming ? (
          <Button
            variant="contained"
            color="primary"
            startIcon={<PlayArrow />}
            onClick={onStart}
            size="large"
          >
            Start Streaming
          </Button>
        ) : (
          <Button
            variant="contained"
            color="error"
            startIcon={<Stop />}
            onClick={onStop}
            size="large"
          >
            Stop Streaming
          </Button>
        )}

        <Box sx={{ flex: 1 }} />

        {/* Settings Toggle */}
        <IconButton onClick={() => setShowSettings(!showSettings)}>
          {showSettings ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
        <Typography variant="body2">Settings</Typography>
      </Box>

      {/* Stream Status */}
      {streamStatus && (
        <Paper variant="outlined" sx={{ p: 1, mb: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={4}>
              <Typography variant="caption">Stream URL</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {streamStatus.streamUrl}
              </Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption">Web UI</Typography>
              <Typography 
                variant="body2" 
                component="a" 
                href={streamStatus.webUI} 
                target="_blank"
                sx={{ color: 'primary.main' }}
              >
                Open Config
              </Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption">Status</Typography>
              <Typography variant="body2" color="success.main">
                Active
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Settings Panel */}
      <Collapse in={showSettings}>
        <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
          <Grid container spacing={3}>
            {/* Resolution */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Resolution</InputLabel>
                <Select
                  value={settings.resolution}
                  label="Resolution"
                  onChange={(e) => handleSettingChange('resolution', e.target.value)}
                  disabled={isStreaming}
                  startAdornment={<HighQuality sx={{ mr: 1 }} />}
                >
                  {resolutions.map(res => (
                    <MenuItem key={res} value={res}>{res}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Frame Rate */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Frame Rate</InputLabel>
                <Select
                  value={settings.fps}
                  label="Frame Rate"
                  onChange={(e) => handleSettingChange('fps', e.target.value)}
                  disabled={isStreaming}
                  startAdornment={<Speed sx={{ mr: 1 }} />}
                >
                  {frameRates.map(fps => (
                    <MenuItem key={fps} value={fps}>{fps} FPS</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Bitrate */}
            <Grid item xs={12}>
              <Typography gutterBottom>
                Bitrate: {settings.bitrate / 1000} Mbps
              </Typography>
              <Slider
                value={settings.bitrate}
                onChange={(e, value) => handleSettingChange('bitrate', value)}
                min={5000}
                max={50000}
                step={1000}
                disabled={isStreaming}
                marks={[
                  { value: 5000, label: '5' },
                  { value: 20000, label: '20' },
                  { value: 35000, label: '35' },
                  { value: 50000, label: '50' }
                ]}
              />
            </Grid>

            {/* Codec */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Video Codec</InputLabel>
                <Select
                  value={settings.codec}
                  label="Video Codec"
                  onChange={(e) => handleSettingChange('codec', e.target.value)}
                  disabled={isStreaming}
                >
                  {codecs.map(codec => (
                    <MenuItem key={codec} value={codec}>
                      {codec.toUpperCase()}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Input Devices Status */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Input Devices
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Keyboard color="primary" />
                  <Typography variant="body2">Keyboard</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Mouse color="primary" />
                  <Typography variant="body2">Mouse</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Gamepad2 color="primary" />
                  <Typography variant="body2">Gamepad</Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      </Collapse>
    </Box>
  );
};

export default StreamingControls;
