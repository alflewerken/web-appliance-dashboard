import React from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { X } from 'lucide-react';

const UnifiedPanelHeader = ({ title, icon: Icon, onClose, actions }) => {
  // Check if Icon is a component or already a React element
  let iconElement = null;
  if (Icon) {
    if (React.isValidElement(Icon)) {
      // It's already a React element
      iconElement = Icon;
    } else if (typeof Icon === 'function' || (Icon && Icon.$$typeof)) {
      // It's a component (function or forwardRef)
      iconElement = <Icon size={20} />;
    }
  }
  
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
        {iconElement}
        {title}
      </Typography>
      
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {actions}
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
    </Box>
  );
};

export default UnifiedPanelHeader;
