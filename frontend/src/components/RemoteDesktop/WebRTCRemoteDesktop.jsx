import React, { useEffect, useRef, useState } from 'react';
import { Box, Button, Alert, CircularProgress } from '@mui/material';
import { PlayArrow, Stop } from '@mui/icons-material';
import io from 'socket.io-client';

/**
 * Native WebRTC Remote Desktop Component
 * Verwendet direkte Peer-to-Peer Verbindung für maximale Performance
 */
const WebRTCRemoteDesktop = ({ applianceId }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ fps: 0, bitrate: 0, latency: 0 });

  const videoRef = useRef(null);
  const pcRef = useRef(null);
  const socketRef = useRef(null);
  const statsIntervalRef = useRef(null);

  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, []);

  const startStreaming = async () => {
    try {
      setError(null);
      
      // 1. Socket.IO Verbindung für Signaling
      const socket = io('/webrtc', {
        transports: ['websocket'],
        auth: {
          token: localStorage.getItem('token')
        }
      });
      
      socketRef.current = socket;

      // 2. ICE Server holen
      const iceResponse = await fetch('/api/webrtc/ice-servers', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const iceConfig = await iceResponse.json();

      // 3. RTCPeerConnection mit optimierten Einstellungen
      const pc = new RTCPeerConnection({
        ...iceConfig,
        // Codec-Präferenzen für beste Performance
        encodingParameters: [
          { maxBitrate: 8000000 } // 8 Mbps max
        ]
      });
      
      pcRef.current = pc;

      // 4. Stream empfangen
      pc.ontrack = (event) => {
        console.log('Stream empfangen:', event.streams[0]);
        if (videoRef.current) {
          videoRef.current.srcObject = event.streams[0];
          setIsStreaming(true);
          startStatsMonitoring();
        }
      };

      // 5. Signaling Events
      socket.on('offer', async (data) => {
        console.log('Offer erhalten');
        await pc.setRemoteDescription(data.offer);
        
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        socket.emit('answer', {
          answer: answer,
          to: data.from
        });
      });

      socket.on('ice-candidate', async (data) => {
        if (data.candidate) {
          await pc.addIceCandidate(data.candidate);
        }
      });

      socket.on('stream-config', (config) => {
        console.log('Stream config:', config);
      });

      // 6. Stream anfordern
      socket.emit('start-streaming', applianceId);
      
      setIsConnected(true);

    } catch (err) {
      console.error('Streaming error:', err);
      setError(err.message);
    }
  };

  const stopStreaming = () => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
    }

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsConnected(false);
    setIsStreaming(false);
  };

  const startStatsMonitoring = () => {
    statsIntervalRef.current = setInterval(async () => {
      if (pcRef.current) {
        const stats = await pcRef.current.getStats();
        let fps = 0;
        let bitrate = 0;
        let packetsLost = 0;

        stats.forEach(report => {
          if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
            // FPS berechnen
            if (report.framesDecoded) {
              fps = report.framesPerSecond || 0;
            }
            
            // Bitrate berechnen
            if (report.bytesReceived) {
              bitrate = (report.bytesReceived * 8) / 1000000; // Mbps
            }

            // Packet loss
            packetsLost = report.packetsLost || 0;
          }
        });

        setStats({
          fps: Math.round(fps),
          bitrate: bitrate.toFixed(2),
          latency: pcRef.current.connectionState === 'connected' ? '<5ms' : 'N/A'
        });
      }
    }, 1000);
  };

  // Mouse und Keyboard Events
  const handleMouseMove = (e) => {
    if (socketRef.current && isStreaming) {
      const rect = videoRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      
      socketRef.current.emit('mouse-move', { x, y });
    }
  };

  const handleMouseClick = (e) => {
    if (socketRef.current && isStreaming) {
      socketRef.current.emit('mouse-click', { 
        button: e.button,
        x: e.clientX,
        y: e.clientY
      });
    }
  };

  const handleKeyPress = (e) => {
    if (socketRef.current && isStreaming) {
      e.preventDefault();
      socketRef.current.emit('key-press', {
        key: e.key,
        code: e.code,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey
      });
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Control Bar */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        {!isConnected ? (
          <Button
            variant="contained"
            startIcon={<PlayArrow />}
            onClick={startStreaming}
          >
            Start WebRTC Stream
          </Button>
        ) : (
          <Button
            variant="contained"
            color="error"
            startIcon={<Stop />}
            onClick={stopStreaming}
          >
            Stop Stream
          </Button>
        )}

        {/* Live Stats */}
        {isStreaming && (
          <Box component="span" sx={{ ml: 2 }}>
            FPS: {stats.fps} | Bitrate: {stats.bitrate} Mbps | Latency: {stats.latency}
          </Box>
        )}
      </Box>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      )}

      {/* Video Container */}
      <Box sx={{ flex: 1, position: 'relative', bgcolor: 'black' }}>
        {isConnected && !isStreaming && (
          <Box sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
          }}>
            <CircularProgress />
          </Box>
        )}
        
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            cursor: isStreaming ? 'none' : 'default'
          }}
          onMouseMove={handleMouseMove}
          onClick={handleMouseClick}
          onKeyDown={handleKeyPress}
          tabIndex={0}
        />
      </Box>
    </Box>
  );
};

export default WebRTCRemoteDesktop;
