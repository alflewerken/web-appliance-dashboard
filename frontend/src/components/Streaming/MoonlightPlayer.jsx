import React, { useEffect, useRef, useState } from 'react';
import { Box, Button, Paper, Typography, IconButton, Slider, Menu, MenuItem } from '@mui/material';
import { PlayArrow, Stop, Settings, Fullscreen, VolumeUp } from '@mui/icons-material';
import StreamingControls from './StreamingControls';
import './MoonlightPlayer.css';

const MoonlightPlayer = ({ applianceId, onClose }) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStatus, setStreamStatus] = useState(null);
  const [settings, setSettings] = useState({
    resolution: '1920x1080',
    fps: 60,
    bitrate: 20000,
    codec: 'h264'
  });
  const [anchorEl, setAnchorEl] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const pcRef = useRef(null);

  // Initialize WebRTC connection
  const initializeWebRTC = async () => {
    try {
      // Create RTCPeerConnection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      });

      // Handle incoming stream
      pc.ontrack = (event) => {
        if (videoRef.current) {
          videoRef.current.srcObject = event.streams[0];
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current) {
          wsRef.current.send(JSON.stringify({
            type: 'ice-candidate',
            candidate: event.candidate
          }));
        }
      };

      pcRef.current = pc;

      // Connect to signaling server
      const ws = new WebSocket(`ws://localhost:3001/api/streaming/stream/${applianceId}`);
      
      ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'offer':
            await pc.setRemoteDescription(data.offer);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ws.send(JSON.stringify({ type: 'answer', answer }));
            break;
            
          case 'ice-candidate':
            await pc.addIceCandidate(data.candidate);
            break;
            
          case 'log':
            break;
            
          case 'error':
            console.error('Sunshine Error:', data.data);
            break;
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to initialize WebRTC:', error);
    }
  };

  // Start streaming
  const startStreaming = async () => {
    try {
      const response = await fetch(`/api/streaming/start/${applianceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ config: settings })
      });

      if (response.ok) {
        const data = await response.json();
        setStreamStatus(data);
        setIsStreaming(true);
        await initializeWebRTC();
      }
    } catch (error) {
      console.error('Failed to start streaming:', error);
    }
  };

  // Stop streaming
  const stopStreaming = async () => {
    try {
      await fetch(`/api/streaming/stop/${applianceId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (pcRef.current) {
        pcRef.current.close();
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      
      setIsStreaming(false);
      setStreamStatus(null);
    } catch (error) {
      console.error('Failed to stop streaming:', error);
    }
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
    }
  };

  // Handle input events
  const handleMouseMove = (e) => {
    if (isStreaming && wsRef.current) {
      const rect = videoRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      
      wsRef.current.send(JSON.stringify({
        type: 'mouse-move',
        x, y
      }));
    }
  };

  const handleMouseClick = (e) => {
    if (isStreaming && wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'mouse-click',
        button: e.button
      }));
    }
  };

  const handleKeyDown = (e) => {
    if (isStreaming && wsRef.current) {
      e.preventDefault();
      wsRef.current.send(JSON.stringify({
        type: 'key-down',
        key: e.key,
        code: e.code
      }));
    }
  };

  const handleKeyUp = (e) => {
    if (isStreaming && wsRef.current) {
      e.preventDefault();
      wsRef.current.send(JSON.stringify({
        type: 'key-up',
        key: e.key,
        code: e.code
      }));
    }
  };

  useEffect(() => {
    return () => {
      if (isStreaming) {
        stopStreaming();
      }
    };
  }, []);

  return (
    <Paper 
      elevation={3} 
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        bgcolor: 'background.paper' 
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6">
          Game Streaming - {applianceId}
        </Typography>
      </Box>

      {/* Video Container */}
      <Box 
        sx={{ 
          flex: 1, 
          position: 'relative', 
          bgcolor: 'black',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{ 
            width: '100%', 
            height: '100%',
            objectFit: 'contain'
          }}
          onMouseMove={handleMouseMove}
          onClick={handleMouseClick}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          tabIndex={0}
        />
        
        <canvas
          ref={canvasRef}
          style={{ 
            display: 'none',
            position: 'absolute',
            top: 0,
            left: 0
          }}
        />

        {/* Overlay Controls */}
        {isStreaming && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 20,
              right: 20,
              display: 'flex',
              gap: 1
            }}
          >
            <IconButton 
              onClick={toggleFullscreen}
              sx={{ bgcolor: 'rgba(0,0,0,0.5)', color: 'white' }}
            >
              <Fullscreen />
            </IconButton>
          </Box>
        )}
      </Box>

      {/* Controls */}
      <StreamingControls
        isStreaming={isStreaming}
        settings={settings}
        onSettingsChange={setSettings}
        onStart={startStreaming}
        onStop={stopStreaming}
        streamStatus={streamStatus}
      />
    </Paper>
  );
};

export default MoonlightPlayer;
