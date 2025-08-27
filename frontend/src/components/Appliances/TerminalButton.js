import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { Terminal } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Terminal Button Component
 * Opens a terminal for the appliance using the global terminal handler
 */
const TerminalButton = ({ appliance, onClick }) => {
  const { t } = useTranslation();
  
  const handleClick = (e) => {
    // Prevent event bubbling
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    // Use the provided onClick handler or the global one
    if (onClick) {
      onClick(appliance);
    } else if (window.handleTerminalOpen) {
      window.handleTerminalOpen(appliance);
    } else {
      console.error('No terminal handler available');
    }
  };
  
  return (
    <Tooltip title={t('services.openTerminal')}>
      <IconButton
        onClick={handleClick}
        size="small"
        sx={{
          backgroundColor: 'rgba(156, 39, 176, 0.3)',
          border: '1px solid rgba(156, 39, 176, 0.5)',
          color: 'white',
          '&:hover': {
            backgroundColor: 'rgba(156, 39, 176, 0.5)',
          },
          width: 28,
          height: 28,
          padding: 0,
        }}
      >
        <Terminal size={16} />
      </IconButton>
    </Tooltip>
  );
};

export default TerminalButton;