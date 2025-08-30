// ResponsiveChip component that handles long text better
import React, { useState } from 'react';
import { Chip } from '@mui/material';

const ResponsiveChip = ({ label, ...props }) => {
  const [showFull, setShowFull] = useState(false);
  const maxLength = 50;
  const isLong = label && label.length > maxLength;
  
  const displayLabel = isLong && !showFull 
    ? label.substring(0, maxLength) + '...' 
    : label;
  
  return (
    <Chip 
      {...props}
      label={displayLabel}
      onClick={isLong ? () => setShowFull(!showFull) : undefined}
      sx={{
        ...props.sx,
        maxWidth: '100%',
        height: 'auto',
        '& .MuiChip-label': {
          display: 'block',
          whiteSpace: isLong ? 'normal' : 'nowrap',
          overflow: 'hidden',
          textOverflow: isLong && !showFull ? 'ellipsis' : 'unset',
          wordBreak: isLong ? 'break-word' : 'normal',
          padding: '4px 12px',
          cursor: isLong ? 'pointer' : 'default',
        }
      }}
      title={isLong ? (showFull ? 'Klicken zum Verkleinern' : 'Klicken für vollständigen Text') : label}
    />
  );
};

export default ResponsiveChip;
