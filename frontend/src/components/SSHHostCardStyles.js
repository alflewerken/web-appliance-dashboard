// SSH Host Card Styles
export const sshHostCardStyles = {
  card: (isEditing, isHovered) => ({
    background: isEditing
      ? 'linear-gradient(135deg, rgba(0, 122, 255, 0.15), rgba(0, 122, 255, 0.05))'
      : 'linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02))',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    border: isEditing
      ? '1px solid rgba(0, 122, 255, 0.4)'
      : '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '20px',
    padding: '24px',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: isEditing
      ? '0 10px 40px rgba(0, 122, 255, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
      : isHovered
        ? '0 20px 60px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
        : '0 8px 32px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
    transform: isEditing
      ? 'scale(1.02) translateY(-4px)'
      : isHovered
        ? 'translateY(-8px)'
        : 'translateY(0)',
    position: 'relative',
    overflow: 'hidden',
    cursor: isEditing ? 'default' : 'pointer',
  }),

  cardOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background:
      'radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.1) 0%, transparent 50%)',
    pointerEvents: 'none',
  },

  headerSection: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '20px',
    position: 'relative',
    zIndex: 1,
  },

  hostInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flex: 1,
    minWidth: 0,
  },

  iconContainer: isConnected => ({
    width: '56px',
    height: '56px',
    background: isConnected
      ? 'linear-gradient(135deg, rgba(52, 199, 89, 0.2), rgba(52, 199, 89, 0.1))'
      : 'linear-gradient(135deg, rgba(0, 122, 255, 0.2), rgba(0, 122, 255, 0.1))',
    border: isConnected
      ? '2px solid rgba(52, 199, 89, 0.3)'
      : '2px solid rgba(0, 122, 255, 0.3)',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
    boxShadow: isConnected
      ? '0 4px 20px rgba(52, 199, 89, 0.25)'
      : '0 4px 20px rgba(0, 122, 255, 0.25)',
  }),

  iconPulse: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: '100%',
    height: '100%',
    borderRadius: '16px',
    border: '2px solid',
    borderColor: 'inherit',
    transform: 'translate(-50%, -50%)',
    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
    opacity: 0.5,
  },

  hostDetails: {
    flex: 1,
    minWidth: 0,
  },

  hostTitle: {
    color: '#ffffff',
    fontWeight: '700',
    margin: '0 0 6px 0',
    fontSize: '18px',
    letterSpacing: '-0.02em',
    display: '-webkit-box',
    WebkitLineClamp: 1,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  hostSubtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    margin: '0 0 4px 0',
    fontSize: '14px',
    fontFamily: 'Monaco, Consolas, monospace',
    display: '-webkit-box',
    WebkitLineClamp: 1,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  statusBadge: isConnected => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
    background: isConnected
      ? 'rgba(52, 199, 89, 0.15)'
      : 'rgba(255, 255, 255, 0.1)',
    color: isConnected ? '#34C759' : 'rgba(255, 255, 255, 0.6)',
    border: isConnected
      ? '1px solid rgba(52, 199, 89, 0.3)'
      : '1px solid rgba(255, 255, 255, 0.15)',
  }),

  statusDot: isConnected => ({
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: isConnected ? '#34C759' : 'rgba(255, 255, 255, 0.4)',
    boxShadow: isConnected ? '0 0 8px rgba(52, 199, 89, 0.6)' : 'none',
  }),

  actionButtons: {
    display: 'flex',
    gap: '8px',
    flexShrink: 0,
    alignItems: 'center',
  },

  actionButton: (color, hoverColor) => ({
    width: '36px',
    height: '36px',
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '10px',
    color: color || 'rgba(255, 255, 255, 0.8)',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    position: 'relative',
    overflow: 'hidden',
  }),

  actionButtonHover: color => ({
    background: color ? `${color}20` : 'rgba(255, 255, 255, 0.15)',
    borderColor: color || 'rgba(255, 255, 255, 0.3)',
    color: color || '#ffffff',
    transform: 'scale(1.1)',
    boxShadow: `0 4px 12px ${color ? color + '40' : 'rgba(255, 255, 255, 0.2)'}`,
  }),

  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
    marginTop: '20px',
    paddingTop: '20px',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
  },

  detailItem: {
    background: 'rgba(255, 255, 255, 0.04)',
    borderRadius: '12px',
    padding: '14px',
    border: '1px solid rgba(255, 255, 255, 0.06)',
  },

  detailLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },

  detailValue: {
    background: 'rgba(0, 0, 0, 0.3)',
    padding: '8px 12px',
    borderRadius: '8px',
    fontSize: '13px',
    color: '#ffffff',
    fontFamily: 'Monaco, Consolas, monospace',
    fontWeight: '500',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    wordBreak: 'break-all',
  },

  connectionStatus: {
    marginTop: '16px',
    padding: '14px',
    borderRadius: '12px',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    transition: 'all 0.3s ease',
  },

  pulseKeyframes: `
    @keyframes pulse {
      0%, 100% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(1);
      }
      50% {
        opacity: 0.5;
        transform: translate(-50%, -50%) scale(1.1);
      }
    }
  `,
};
