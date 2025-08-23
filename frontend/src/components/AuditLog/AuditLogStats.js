// Audit Log Statistics Component
import React from 'react';
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
}) => {
  const theme = useTheme();
  
  // Kompakt-Ansicht bei Panel-Breite unter 900px
  const isCompactView = panelWidth && panelWidth < 900;

  const statItems = [
    {
      label: 'Gesamt',
      value: stats.totalLogs,
      description: 'Alle Log-Einträge',
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
      label: 'Heute',
      value: stats.todayLogs,
      description: 'Heutige Aktivitäten',
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
      label: 'Benutzer',
      value: stats.uniqueUsers,
      description: 'Aktive Benutzer',
      icon: <Users size={14} />,
      color: theme.palette.success.main,
      action: null,
      isActive: false,
      clickAction: null,
    },
    {
      label: 'Kritisch',
      value: stats.criticalActions,
      description: showCriticalOnly ? 'Filter aktiv' : 'Wichtige Aktionen',
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
                  transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                  border: item.isActive 
                    ? `2px solid ${item.color}` 
                    : cardStyles.border || '1px solid rgba(255, 255, 255, 0.08)',
                  backgroundColor: item.isActive
                    ? `${item.color}15`
                    : cardStyles.backgroundColor,
                  '&:hover': item.clickAction ? {
                    transform: 'translateY(-2px)',
                    boxShadow: theme.shadows[4],
                  } : {},
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
                      {item.value.toLocaleString('de-DE')}
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
