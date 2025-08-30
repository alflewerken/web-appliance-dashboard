// Audit Log Statistics Component
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Tooltip,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Activity,
  Users,
  AlertTriangle,
  Calendar,
} from 'lucide-react';

const AuditLogStats = ({ 
  stats, 
  cardStyles, 
  panelWidth,
  onStatClick,  // Neue Prop für Click-Handler
  showCriticalOnly = false,  // Prop für aktiven Status
  dateRange = 'today',  // Prop für aktiven Zeitraum
  activeUserFilter = false,  // NEU: Prop für Benutzer-Filter
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  
  // Kompakt-Ansicht bei Panel-Breite unter 900px
  const isCompactView = panelWidth && panelWidth < 900;
  
  // Locale für Zahlenformatierung
  const currentLang = localStorage.getItem('i18nextLng') || 'en';
  const locale = currentLang === 'de' ? 'de-DE' : 'en-US';

  const statItems = [
    {
      label: t('auditLog.stats.totalLogs'),
      value: stats.totalLogs,
      description: t('auditLog.stats.totalLogs'),
      icon: <Activity size={14} />,
      color: theme.palette.primary.main,
      action: 'all',
      isActive: dateRange === 'all',
      clickAction: () => {
        if (onStatClick) {
          onStatClick('all', 'dateRange');
        }
      },
    },
    {
      label: t('auditLog.today'),
      value: stats.todayLogs,
      description: t('auditLog.stats.todayLogs'),
      icon: <Calendar size={14} />,
      color: theme.palette.info.main,
      action: 'today',
      isActive: dateRange === 'today',
      clickAction: () => {
        if (onStatClick) {
          onStatClick('today', 'dateRange');
        }
      },
    },
    {
      label: t('auditLog.user'),
      value: stats.uniqueUsers,
      description: activeUserFilter ? t('auditLog.filters.apply') : t('auditLog.stats.uniqueUsers'),
      icon: <Users size={14} />,
      color: theme.palette.success.main,
      action: 'userActivity',
      isActive: activeUserFilter,
      clickAction: () => {
        if (onStatClick) {
          onStatClick('toggle', 'userFilter');
        }
      },
    },
    {
      label: t('auditLog.stats.criticalActions'),
      value: stats.criticalActions,
      description: showCriticalOnly ? t('auditLog.filters.apply') : t('auditLog.stats.criticalActions'),
      icon: <AlertTriangle size={14} />,
      color: theme.palette.error.main,
      action: 'critical',
      isActive: showCriticalOnly,
      clickAction: () => {
        if (onStatClick) {
          onStatClick('toggle', 'criticalOnly');
        }
      },
    },
  ];

  return (
    <Box sx={{ px: 1, py: 0.5 }}>
      <Stack 
        direction="row" 
        spacing={1}
        sx={{
          justifyContent: 'center',
        }}
      >
        {statItems.map((item, index) => {
          const CardWrapper = isCompactView && item.description ? Tooltip : React.Fragment;
          const wrapperProps = isCompactView && item.description 
            ? { title: item.description, placement: 'top', arrow: true }
            : {};

          return (
            <CardWrapper key={index} {...wrapperProps}>
              <Card 
                sx={{
                  ...cardStyles,
                  flex: '0 0 auto',
                  cursor: item.clickAction ? 'pointer' : 'default',
                  transition: 'all 0.3s ease',
                  border: item.isActive 
                    ? `2px solid ${item.color}` 
                    : cardStyles.border || '1px solid rgba(255, 255, 255, 0.08)',
                  backgroundColor: item.isActive
                    ? `${item.color}20`  // Verstärkt von 15 auf 20
                    : cardStyles.backgroundColor,
                  // VERSTÄRKTER Glow-Effekt für aktive Karten
                  boxShadow: item.isActive
                    ? `0 0 30px ${item.color}90, 0 0 60px ${item.color}50, 0 0 90px ${item.color}30, inset 0 0 30px ${item.color}20`
                    : cardStyles.boxShadow || 'none',
                  position: 'relative',
                  overflow: 'visible',
                  transform: item.isActive ? 'scale(1.02)' : 'scale(1)',
                  '&::before': item.isActive ? {
                    content: '""',
                    position: 'absolute',
                    top: -4,
                    left: -4,
                    right: -4,
                    bottom: -4,
                    borderRadius: 'inherit',
                    background: `linear-gradient(45deg, ${item.color}60, transparent, ${item.color}60)`,
                    opacity: 0.8,
                    animation: 'pulse-glow 1.5s ease-in-out infinite',
                    pointerEvents: 'none',
                    zIndex: -1,
                  } : {},
                  '&:hover': item.clickAction ? {
                    transform: item.isActive ? 'translateY(-2px) scale(1.03)' : 'translateY(-2px)',
                    boxShadow: item.isActive 
                      ? `0 0 40px ${item.color}, 0 0 80px ${item.color}70, 0 0 120px ${item.color}40, inset 0 0 40px ${item.color}30`
                      : theme.shadows[4],
                  } : {},
                  '@keyframes pulse-glow': {
                    '0%, 100%': {
                      opacity: 0.8,
                      transform: 'scale(1)',
                    },
                    '50%': {
                      opacity: 0.4,
                      transform: 'scale(1.08)',
                    },
                  },
                }}
                onClick={item.clickAction}
              >
                <CardContent sx={{ 
                  p: 0.75,
                  '&:last-child': { pb: 0.75 },
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  minWidth: isCompactView ? 'auto' : '140px',
                  userSelect: 'none', // Verhindert Text-Selektion
                }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 24,
                      height: 24,
                      borderRadius: 0.5,
                      backgroundColor: `${item.color}20`,
                      color: item.color,
                      flexShrink: 0,
                    }}
                  >
                    {item.icon}
                  </Box>
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: isCompactView ? 'row' : 'column',
                    alignItems: isCompactView ? 'center' : 'flex-start',
                    gap: isCompactView ? 0.5 : 0.25,
                  }}>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontWeight: 600,
                        fontSize: isCompactView ? '0.9rem' : '1rem',
                        lineHeight: 1,
                        userSelect: 'none',
                      }}
                    >
                      {item.value.toLocaleString(locale)}
                    </Typography>
                    {!isCompactView && (
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          color: theme.palette.text.secondary,
                          fontSize: '0.7rem',
                          lineHeight: 1.2,
                          opacity: 0.8,
                          userSelect: 'none',
                        }}
                      >
                        {item.description}
                      </Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </CardWrapper>
          );
        })}
      </Stack>
    </Box>
  );
};

export default AuditLogStats;
