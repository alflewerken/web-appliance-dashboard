import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  Stack,
  Divider,
  useTheme,
  alpha,
  Paper,
  IconButton,
  Collapse,
  Button,
} from '@mui/material';
import {
  GitBranch,
  RefreshCw,
  RotateCcw,
  Eye,
  Database,
  Terminal,
  Server,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import axios from '../../utils/axiosConfig';
import AnsiToHtml from 'ansi-to-html';

const SSHAuditDetailMUI = ({ details }) => {
  const theme = useTheme();
  
  if (!details) return null;

  const {
    command,
    command_description,
    name,  // Added for command description from audit log
    appliance_name,  // Added for service name
    executed_on,
    stdout,
    stderr,
    exit_code,
    output,  // Added for combined output
    output_length,
    error,
  } = details;

  const isError = exit_code !== 0 || !!stderr || !!error;
  const hasOutput = stdout || stderr || error || output;
  
  // Auto-expand if output is reasonably short (less than 1000 characters)
  const outputText = output || stdout || stderr || error || '';
  const shouldAutoExpand = outputText.length < 1000;
  const [expanded, setExpanded] = useState(shouldAutoExpand);

  // Convert ANSI colors to HTML
  const ansiConverter = useMemo(() => new AnsiToHtml({
    fg: theme.palette.mode === 'dark' ? '#e5e7eb' : '#111827',
    bg: 'transparent',
    newline: true,
    escapeXML: true,
    colors: {
      0: theme.palette.mode === 'dark' ? '#6b7280' : '#374151',  // black/gray
      1: '#ef4444',  // red
      2: '#10b981',  // green
      3: '#f59e0b',  // yellow
      4: '#3b82f6',  // blue
      5: '#8b5cf6',  // magenta
      6: '#06b6d4',  // cyan
      7: theme.palette.mode === 'dark' ? '#e5e7eb' : '#111827',  // white/black
      8: theme.palette.mode === 'dark' ? '#9ca3af' : '#4b5563',  // bright black
      9: '#f87171',  // bright red
      10: '#34d399', // bright green
      11: '#fbbf24', // bright yellow
      12: '#60a5fa', // bright blue
      13: '#a78bfa', // bright magenta
      14: '#22d3ee', // bright cyan
      15: theme.palette.mode === 'dark' ? '#f9fafb' : '#030712', // bright white
    }
  }), [theme.palette.mode]);

  const convertAnsiToHtml = (text) => {
    if (!text) return '';
    
    // Convert ANSI to HTML
    let html = ansiConverter.toHtml(text);
    
    // If no ANSI codes were found, wrap the text in a span with the default color
    if (!html.includes('<span')) {
      const defaultColor = theme.palette.mode === 'dark' ? '#e5e7eb' : '#111827';
      html = `<span style="color: ${defaultColor}">${html}</span>`;
    }
    
    return html;
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        backgroundColor: theme.palette.mode === 'dark'
          ? 'rgba(255, 255, 255, 0.05)'
          : 'rgba(0, 0, 0, 0.02)',
        border: 1,
        borderColor: isError ? 'error.main' : 'divider',
        borderRadius: 1,
      }}
    >
      {/* Service Name */}
      {appliance_name && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Service
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              fontWeight: 500,
              color: theme.palette.mode === 'dark' ? '#60a5fa' : '#2563eb'
            }}
          >
            {appliance_name}
          </Typography>
        </Box>
      )}

      {/* Command Description */}
      {(command_description || name) && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Beschreibung
          </Typography>
          <Typography variant="body2">{command_description || name}</Typography>
        </Box>
      )}

      {/* Command */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Befehl
        </Typography>
        <Box
          component="code"
          sx={{
            display: 'block',
            p: 1,
            backgroundColor: theme.palette.mode === 'dark' 
              ? 'rgba(0, 0, 0, 0.4)' 
              : 'rgba(0, 0, 0, 0.05)',
            borderRadius: 1,
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            fontSize: '12px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            color: theme.palette.mode === 'dark' ? '#10b981' : '#059669',
          }}
        >
          {command}
        </Box>
      </Box>

      {/* Execution Info */}
      <Stack 
        direction="row" 
        spacing={2} 
        sx={{ 
          mb: 2,
          flexWrap: 'wrap',
          '& > *': {
            flexShrink: 0,
            minWidth: 0,
          }
        }}
      >
        <Box>
          <Typography variant="caption" color="text.secondary">
            Ausgeführt auf
          </Typography>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Server size={14} />
            <Typography variant="body2">{executed_on}</Typography>
          </Stack>
        </Box>
        {exit_code !== undefined && (
          <Box>
            <Typography variant="caption" color="text.secondary">
              Exit Code
            </Typography>
            <Chip
              size="small"
              icon={exit_code === 0 ? <CheckCircle size={14} /> : <XCircle size={14} />}
              label={exit_code}
              color={exit_code === 0 ? 'success' : 'error'}
              variant="outlined"
            />
          </Box>
        )}
        {output_length > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary">
              Ausgabelänge
            </Typography>
            <Typography variant="body2">
              {output_length.toLocaleString('de-DE')} Zeichen
            </Typography>
          </Box>
        )}
      </Stack>

      {/* Output */}
      {hasOutput && (
        <Box>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 1 }}
          >
            <Typography variant="subtitle2" color="text.secondary">
              Ausgabe
            </Typography>
            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </IconButton>
          </Stack>

          <Collapse in={expanded}>
            {/* Combined output (from command_execute audit logs) */}
            {output && !stdout && !stderr && (
              <Box sx={{ mb: 2 }}>
                <Typography
                  variant="caption"
                  color={isError ? 'error.main' : 'success.main'}
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}
                >
                  <Terminal size={14} />
                  Kommando-Ausgabe
                </Typography>
                <Box
                  sx={{
                    p: 1,
                    backgroundColor: theme.palette.mode === 'dark' 
                      ? 'rgba(0, 0, 0, 0.4)' 
                      : 'rgba(0, 0, 0, 0.05)',
                    borderRadius: 1,
                    fontSize: '12px',
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: '400px',
                    overflow: 'auto',
                    border: 1,
                    borderColor: isError ? 'error.main' : 'success.main',
                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                    color: theme.palette.mode === 'dark' ? '#e5e7eb' : '#111827',
                    '& *': {
                      fontFamily: 'inherit',
                    },
                    '& span': {
                      color: 'inherit',
                    },
                    '& span[style*="color: #000"]': {
                      color: theme.palette.mode === 'dark' ? '#e5e7eb !important' : '#111827 !important',
                    },
                    '& span[style*="color: #000000"]': {
                      color: theme.palette.mode === 'dark' ? '#e5e7eb !important' : '#111827 !important',
                    },
                    '& span[style*="color: black"]': {
                      color: theme.palette.mode === 'dark' ? '#e5e7eb !important' : '#111827 !important',
                    },
                  }}
                  dangerouslySetInnerHTML={{ __html: convertAnsiToHtml(output) }}
                />
              </Box>
            )}

            {stdout && (
              <Box sx={{ mb: 2 }}>
                <Typography
                  variant="caption"
                  color="success.main"
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}
                >
                  <Terminal size={14} />
                  Standard-Ausgabe
                </Typography>
                <Box
                  sx={{
                    p: 1,
                    backgroundColor: theme.palette.mode === 'dark' 
                      ? 'rgba(0, 0, 0, 0.4)' 
                      : 'rgba(0, 0, 0, 0.05)',
                    borderRadius: 1,
                    fontSize: '12px',
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: '300px',
                    overflow: 'auto',
                    border: 1,
                    borderColor: 'success.main',
                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                    color: theme.palette.mode === 'dark' ? '#e5e7eb' : '#111827',
                    '& *': {
                      fontFamily: 'inherit',
                    },
                    '& span': {
                      color: 'inherit',
                    },
                    '& span[style*="color: #000"]': {
                      color: theme.palette.mode === 'dark' ? '#e5e7eb !important' : '#111827 !important',
                    },
                    '& span[style*="color: #000000"]': {
                      color: theme.palette.mode === 'dark' ? '#e5e7eb !important' : '#111827 !important',
                    },
                    '& span[style*="color: black"]': {
                      color: theme.palette.mode === 'dark' ? '#e5e7eb !important' : '#111827 !important',
                    },
                  }}
                  dangerouslySetInnerHTML={{ __html: convertAnsiToHtml(stdout) }}
                />
              </Box>
            )}

            {stderr && (
              <Box sx={{ mb: 2 }}>
                <Typography
                  variant="caption"
                  color="error.main"
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}
                >
                  <AlertTriangle size={14} />
                  Fehler-Ausgabe
                </Typography>
                <Box
                  sx={{
                    p: 1,
                    backgroundColor: theme.palette.mode === 'dark' 
                      ? 'rgba(0, 0, 0, 0.4)' 
                      : 'rgba(0, 0, 0, 0.05)',
                    borderRadius: 1,
                    fontSize: '12px',
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: '300px',
                    overflow: 'auto',
                    border: 1,
                    borderColor: 'error.main',
                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                    color: theme.palette.mode === 'dark' ? '#e5e7eb' : '#111827',
                    '& *': {
                      fontFamily: 'inherit',
                    },
                    '& span': {
                      color: 'inherit',
                    },
                    '& span[style*="color: #000"]': {
                      color: theme.palette.mode === 'dark' ? '#e5e7eb !important' : '#111827 !important',
                    },
                    '& span[style*="color: #000000"]': {
                      color: theme.palette.mode === 'dark' ? '#e5e7eb !important' : '#111827 !important',
                    },
                    '& span[style*="color: black"]': {
                      color: theme.palette.mode === 'dark' ? '#e5e7eb !important' : '#111827 !important',
                    },
                  }}
                  dangerouslySetInnerHTML={{ __html: convertAnsiToHtml(stderr) }}
                />
              </Box>
            )}

            {error && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {error}
              </Alert>
            )}
          </Collapse>
        </Box>
      )}
    </Paper>
  );
};

export default SSHAuditDetailMUI;
