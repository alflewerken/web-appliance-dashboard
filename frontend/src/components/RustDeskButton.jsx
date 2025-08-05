import React, { useState } from 'react';
import { IconButton, Tooltip, Dialog, DialogContent } from '@mui/material';
import { DesktopWindows } from '@mui/icons-material';
import SeamlessRemoteDesktop from './SeamlessRemoteDesktop';

const RustDeskButton = ({ applianceId, applianceName, disabled = false }) => {
  const [open, setOpen] = useState(false);

  const handleClick = (e) => {
    e.stopPropagation();
    if (!disabled) {
      setOpen(true);
    }
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <>
      <Tooltip title={disabled ? "RustDesk nicht verfügbar" : "RustDesk Remote Desktop"}>
        <span>
          <IconButton
            onClick={handleClick}
            disabled={disabled}
            size="small"
            sx={{
              color: disabled ? 'action.disabled' : 'primary.main',
              '&:hover': {
                backgroundColor: disabled ? 'transparent' : 'action.hover',
              }
            }}
          >
            <DesktopWindows />
          </IconButton>
        </span>
      </Tooltip>

      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: {
            height: '90vh',
            m: 2
          }
        }}
      >
        <DialogContent sx={{ p: 0, height: '100%' }}>
          <SeamlessRemoteDesktop
            applianceId={applianceId}
            applianceName={applianceName}
            onClose={handleClose}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RustDeskButton;
