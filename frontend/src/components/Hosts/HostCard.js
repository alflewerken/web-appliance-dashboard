import React from 'react';
import { Settings, Monitor, Terminal, Upload } from 'lucide-react';
import { IconButton, Tooltip } from '@mui/material';
import SimpleIcon from '../SimpleIcon';
import '../Appliances/ApplianceCard.css';
import './HostCard.css';

const HostCard = ({
  host,
  onEdit,
  onTerminal,
  onRemoteDesktop,
  onFileTransfer,
  onShowAuditLog,
  isAdmin,
  cardSize,
}) => {
  const handleEdit = (event) => {
    event.stopPropagation();
    // Direkt das Host-Panel öffnen
    onEdit(host);
  };
  
  const cardColor = host.color || '#007AFF';
  const transparency = host.transparency || 0.15; // Default to 15% transparency = 85% opacity
  const blurAmount = host.blur || 8;
  
  // transparency value in database is actually opacity (0 = transparent, 1 = opaque)
  // So we use it directly as the alpha value
  const opacity = transparency;
  
  // Convert hex to RGB for better transparency support
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : '0, 122, 255';
  };
  
  const cardRgb = hexToRgb(cardColor);

  return (
    <div 
      className="appliance-card-container"
      style={{ '--card-size': `${cardSize || 180}px` }}
    >
      <div className="appliance-card">
        {/* Front Side */}
        <div 
          className="card-side card-front"
          style={{
            '--card-bg-color': cardColor,
            '--card-rgb': cardRgb,
            '--card-transparency': opacity,
            '--card-blur': `${blurAmount}px`,
            backgroundColor: `rgba(${cardRgb}, ${opacity})`,
            backdropFilter: `blur(${blurAmount}px)`,
            WebkitBackdropFilter: `blur(${blurAmount}px)`,
            cursor: 'pointer',
          }}
        >
          {/* Card Cover with Icon */}
          <div className="card-cover">
            {/* Main Icon */}
            <div className="card-icon">
              <SimpleIcon 
                name={host.icon || 'Server'} 
                size="100%" 
              />
            </div>
            
            {/* Left Button Column - Edit Button */}
            <div className="card-buttons-left">
              <Tooltip title="Host bearbeiten">
                <IconButton
                  onClick={handleEdit}
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    },
                    width: 28,
                    height: 28,
                    padding: 0,
                  }}
                >
                  <Settings size={16} />
                </IconButton>
              </Tooltip>
            </div>
            
            {/* Right Button Column - Action Buttons */}
            <div className="card-buttons-right">
              <Tooltip title="Terminal">
                <IconButton
                  onClick={(e) => {
                    e.stopPropagation();
                    onTerminal(host);
                  }}
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    },
                    width: 28,
                    height: 28,
                    padding: 0,
                  }}
                >
                  <Terminal size={16} />
                </IconButton>
              </Tooltip>
              
              {/* Only show Remote Desktop button if enabled */}
              {(host.remoteDesktopEnabled) && (
                <Tooltip title="Remote Desktop">
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoteDesktop(host);
                    }}
                    size="small"
                    sx={{
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: 'white',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                      },
                      width: 28,
                      height: 28,
                      padding: 0,
                    }}
                  >
                    <Monitor size={16} />
                  </IconButton>
                </Tooltip>
              )}
              
              <Tooltip title="Datei übertragen">
                <IconButton
                  onClick={(e) => {
                    e.stopPropagation();
                    onFileTransfer(host);
                  }}
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    },
                    width: 28,
                    height: 28,
                    padding: 0,
                  }}
                >
                  <Upload size={16} />
                </IconButton>
              </Tooltip>
            </div>
          </div>
          
          {/* Title with dark background */}
          <div className="card-info-overlay">
            <h3 className="card-title">{host.name || 'Unnamed Host'}</h3>
            {host.description && (
              <p className="card-description" style={{ 
                fontSize: '0.75em', 
                margin: '4px 0 0 0',
                opacity: 0.8,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical'
              }}>
                {host.description}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HostCard;
