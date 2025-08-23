// Audit Log Statistics Component
import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Grid,
  useTheme,
  useMediaQuery,
  Tooltip,
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
}) => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery('(max-width:800px)');
  const isVerySmallScreen = useMediaQuery('(max-width:600px)');
  
  // Kompakt-Ansicht bei Panel-Breite unter 900px
  const isCompactView = panelWidth && panelWidth < 900;

  const statItems = [
    {
      label: 'Gesamt',
      value: stats.totalLogs,
      description: 'Alle Log-Einträge',
      icon: <Activity size={14} />,
      color: theme.palette.primary.main,
      action: 'all', // Für Zeitraum-Filter
      clickAction: () => onStatClick && onStatClick('all', 'dateRange'),
    },
    {
      label: 'Heute',
      value: stats.todayLogs,
      description: 'Heutige Aktivitäten',
      icon: <Calendar size={14} />,
      color: theme.palette.info.main,
      action: 'today',
      clickAction: () => onStatClick && onStatClick('today', 'dateRange'),
    },
    {
      label: 'Benutzer',
      value: stats.uniqueUsers,
      description: 'Aktive Benutzer',
      icon: <Users size={14} />,
      color: theme.palette.success.main,
      action: null, // Keine spezielle Aktion für Benutzer
      clickAction: null,
    },
    {
      label: 'Kritisch',
      value: stats.criticalActions,
      description: 'Wichtige Aktionen',
      icon: <AlertTriangle size={14} />,
      color: theme.palette.error.main,
      action: 'critical',
      clickAction: () => onStatClick && onStatClick(true, 'criticalOnly'),
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
          const cardContent = (
            <Card 
              key={index}
              sx={{
                ...cardStyles,
                flex: '0 0 auto',
                cursor: item.clickAction ? 'pointer' : 'default',
                transition: 'all 0.2s',
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
                      }}
                    >
                      {item.description}
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          );

          // Tooltip nur im Kompakt-Modus anzeigen
          if (isCompactView) {
            return (
              <Tooltip 
                key={index}
                title={item.description} 
                placement="top"
                arrow
              >
                {cardContent}
              </Tooltip>
            );
          }

          return cardContent;
        })}
      </Stack>
    </Box>
  );
};

export default AuditLogStats;

export default AuditLogStats;
