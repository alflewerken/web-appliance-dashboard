import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  Typography,
  IconButton,
  Button,
  Chip,
} from '@mui/material';
import {
  Server,
  Terminal,
  Zap,
  Edit2,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import axios from '../utils/axiosConfig';
import './SSHHostCard.css';

const SSHHostCard = ({
  host,
  onEdit,
  onDelete,
  onRestore,
  onConnect,
  onTest,
}) => {
  console.log('SSHHostCard rendered with host:', host);
  // Initialisiere testStatus basierend auf dem Host-Status aus der Datenbank
  const [testStatus, setTestStatus] = useState(host.test_status || null);
  const [isTestLoading, setIsTestLoading] = useState(false);

  // Update testStatus wenn sich der Host ändert (z.B. durch SSE Events)
  useEffect(() => {
    setTestStatus(host.test_status || null);
  }, [host.test_status]);

  const handleTest = async () => {
    setIsTestLoading(true);
    setTestStatus('testing');
    
    try {
      await onTest(host);
      setTestStatus('success');
      // Reset status nach 5 Sekunden
      setTimeout(() => setTestStatus(null), 5000);
    } catch (error) {
      setTestStatus('failed');
      // Reset status nach 5 Sekunden
      setTimeout(() => setTestStatus(null), 5000);
    } finally {
      setIsTestLoading(false);
    }
  };

  // Bestimme die Farben basierend auf dem Test-Status
  const getTestButtonColors = () => {
    // Verwende den aktuellen testStatus oder den Host-Status aus der DB
    const currentStatus = testStatus || host.test_status;
    
    if (currentStatus === 'success') {
      return {
        bg: 'rgba(34, 197, 94, 0.3)',
        border: 'rgba(34, 197, 94, 0.5)',
        shadow: '0 0 20px rgba(34, 197, 94, 0.5), inset 0 0 10px rgba(34, 197, 94, 0.3)',
        hoverBg: 'rgba(34, 197, 94, 0.5)',
        hoverBorder: 'rgba(34, 197, 94, 0.7)',
        hoverShadow: '0 0 30px rgba(34, 197, 94, 0.7), inset 0 0 15px rgba(34, 197, 94, 0.4)'
      };
    } else if (currentStatus === 'failed') {
      return {
        bg: 'rgba(239, 68, 68, 0.3)',
        border: 'rgba(239, 68, 68, 0.5)',
        shadow: '0 0 20px rgba(239, 68, 68, 0.5), inset 0 0 10px rgba(239, 68, 68, 0.3)',
        hoverBg: 'rgba(239, 68, 68, 0.5)',
        hoverBorder: 'rgba(239, 68, 68, 0.7)',
        hoverShadow: '0 0 30px rgba(239, 68, 68, 0.7), inset 0 0 15px rgba(239, 68, 68, 0.4)'
      };
    } else {
      // Standard Grau für unbekannten Status
      return {
        bg: 'rgba(156, 163, 175, 0.3)',
        border: 'rgba(156, 163, 175, 0.5)',
        shadow: '0 0 20px rgba(156, 163, 175, 0.5), inset 0 0 10px rgba(156, 163, 175, 0.3)',
        hoverBg: 'rgba(156, 163, 175, 0.5)',
        hoverBorder: 'rgba(156, 163, 175, 0.7)',
        hoverShadow: '0 0 30px rgba(156, 163, 175, 0.7), inset 0 0 15px rgba(156, 163, 175, 0.4)'
      };
    }
  };

  const testColors = getTestButtonColors();

  return (
    <Card
      className={`ssh-host-card ${host.deleted_at ? 'deleted' : ''}`}
      sx={{
        backgroundColor: 'var(--container-bg)',
        border: '1px solid var(--container-border)',
        borderRadius: '12px',
        mb: 2,
        overflow: 'visible',
        position: 'relative',
        transition: 'all 0.2s ease',
        '&:hover': {
          borderColor: 'rgba(255, 255, 255, 0.2)',
          transform: 'translateY(-2px)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        },
      }}
    >
      <Box sx={{ p: 3 }}>
        {/* Header mit Icon und Titel */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Server size={24} style={{ color: '#9ca3af' }} />
          </Box>
          
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography
                variant="h6"
                sx={{
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '18px',
                  lineHeight: '24px',
                }}
              >
                {host.hostname}
              </Typography>
              {host.deleted_at && (
                <Chip
                  label="Gelöscht"
                  size="small"
                  sx={{
                    backgroundColor: '#ef4444',
                    color: 'white',
                    height: '20px',
                    fontSize: '11px',
                    fontWeight: 500,
                  }}
                />
              )}
            </Box>
            
            <Typography
              sx={{
                color: '#9ca3af',
                fontFamily: "'SF Mono', Monaco, 'Cascadia Code', monospace",
                fontSize: '14px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {host.username}@{host.host}:{host.port}
            </Typography>
            
            {host.key_name && (
              <Typography
                sx={{
                  color: '#6b7280',
                  fontSize: '13px',
                  mt: 0.5,
                }}
              >
                Key: {host.key_name}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Action Buttons - Unter dem Info Text */}
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            mt: 3,
          }}
        >
          {!host.deleted_at ? (
            <>
              {/* Terminal Button - Violett */}
              <Button
                variant="contained"
                onClick={() => {
                  if (onConnect) {
                    // Rufe direkt onConnect auf - der API-Call wird in der Parent-Komponente gemacht
                    onConnect(host);
                  }
                }}
                sx={{
                  backgroundColor: 'rgba(147, 51, 234, 0.3) !important',
                  color: 'white',
                  minWidth: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  p: 0,
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(147, 51, 234, 0.5)',
                  boxShadow: '0 0 20px rgba(147, 51, 234, 0.5), inset 0 0 10px rgba(147, 51, 234, 0.3)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    backgroundColor: 'rgba(147, 51, 234, 0.5) !important',
                    borderColor: 'rgba(147, 51, 234, 0.7)',
                    boxShadow: '0 0 30px rgba(147, 51, 234, 0.7), inset 0 0 15px rgba(147, 51, 234, 0.4)',
                  },
                  '&:active': {
                    backgroundColor: 'rgba(147, 51, 234, 0.6) !important',
                    transform: 'scale(0.92)',
                  },
                }}
              >
                <Terminal size={20} />
              </Button>
              
              {/* Test Button - Grün/Rot je nach Status */}
              <Button
                variant="contained"
                onClick={handleTest}
                disabled={isTestLoading}
                sx={{
                  backgroundColor: `${testColors.bg} !important`,
                  color: 'white',
                  minWidth: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  p: 0,
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${testColors.border}`,
                  boxShadow: testColors.shadow,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    backgroundColor: `${testColors.hoverBg} !important`,
                    borderColor: testColors.hoverBorder,
                    boxShadow: testColors.hoverShadow,
                  },
                  '&:active': {
                    backgroundColor: `${testColors.hoverBg} !important`,
                    transform: 'scale(0.92)',
                  },
                  '&.Mui-disabled': {
                    backgroundColor: `${testColors.bg} !important`,
                    color: 'rgba(255, 255, 255, 0.5)',
                  },
                }}
              >
                <Zap size={20} className={isTestLoading ? 'pulse-animation' : ''} />
              </Button>
              
              {/* Edit Button - Blau */}
              <Button
                variant="contained"
                onClick={() => onEdit && onEdit(host)}
                sx={{
                  backgroundColor: 'rgba(59, 130, 246, 0.3) !important',
                  color: 'white',
                  minWidth: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  p: 0,
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(59, 130, 246, 0.5)',
                  boxShadow: '0 0 20px rgba(59, 130, 246, 0.5), inset 0 0 10px rgba(59, 130, 246, 0.3)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    backgroundColor: 'rgba(59, 130, 246, 0.5) !important',
                    borderColor: 'rgba(59, 130, 246, 0.7)',
                    boxShadow: '0 0 30px rgba(59, 130, 246, 0.7), inset 0 0 15px rgba(59, 130, 246, 0.4)',
                  },
                  '&:active': {
                    backgroundColor: 'rgba(59, 130, 246, 0.6) !important',
                    transform: 'scale(0.92)',
                  },
                }}
              >
                <Edit2 size={20} />
              </Button>
              
              {/* Delete Button - Rot */}
              <Button
                variant="contained"
                onClick={() => onDelete && onDelete(host.id)}
                sx={{
                  backgroundColor: 'rgba(239, 68, 68, 0.3) !important',
                  color: 'white',
                  minWidth: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  p: 0,
                  ml: 'auto',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                  boxShadow: '0 0 20px rgba(239, 68, 68, 0.5), inset 0 0 10px rgba(239, 68, 68, 0.3)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    backgroundColor: 'rgba(239, 68, 68, 0.5) !important',
                    borderColor: 'rgba(239, 68, 68, 0.7)',
                    boxShadow: '0 0 30px rgba(239, 68, 68, 0.7), inset 0 0 15px rgba(239, 68, 68, 0.4)',
                  },
                  '&:active': {
                    backgroundColor: 'rgba(239, 68, 68, 0.6) !important',
                    transform: 'scale(0.92)',
                  },
                }}
              >
                <Trash2 size={20} />
              </Button>
            </>
          ) : (
            <Button
              variant="contained"
              onClick={() => onRestore && onRestore(host.id)}
              sx={{
                backgroundColor: '#48bb78',
                color: 'white',
                height: '44px',
                borderRadius: '10px',
                '&:hover': {
                  backgroundColor: '#38a169',
                },
                '&:active': {
                  backgroundColor: '#38a169',
                  transform: 'scale(0.92)',
                },
              }}
              startIcon={<RotateCcw size={20} />}
            >
              Wiederherstellen
            </Button>
          )}
        </Box>
      </Box>
    </Card>
  );
};

export default SSHHostCard;
