import React from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { X } from 'lucide-react';

const UnifiedPanelHeader = ({ title, icon: Icon, onClose }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '56px',
        minHeight: '56px',
        padding: '0 24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        backgroundColor: 'transparent',
        flexShrink: 0,
      }}
    >
      <Typography
        variant="h6"
        sx={{
          fontSize: '18px',
          fontWeight: 600,
          color: 'var(--text-primary, #fff)',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        {Icon && <Icon size={20} />}
        {title}
      </Typography>
      
      <IconButton
        onClick={onClose}
        sx={{
          padding: '8px',
          color: 'rgba(255, 255, 255, 0.7)',
          backgroundColor: 'rgba(118, 118, 128, 0.12)',
          borderRadius: '8px',
          transition: 'all 0.2s',
          '&:hover': {
            backgroundColor: 'rgba(118, 118, 128, 0.24)',
            color: 'rgba(255, 255, 255, 0.9)',
          },
          // Light mode styles
          '.theme-light &': {
            color: 'rgba(0, 0, 0, 0.54)',
            backgroundColor: 'rgba(0, 0, 0, 0.04)',
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.08)',
              color: 'rgba(0, 0, 0, 0.87)',
            },
          },
        }}
      >
        <X size={18} />
      </IconButton>
    </Box>
  );
};

export default UnifiedPanelHeader;
