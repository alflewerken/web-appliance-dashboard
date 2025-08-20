// Audit Log Filter Component - Responsive Version

import React from 'react';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Button,
  InputAdornment,
  useTheme,
  Card,
  CardContent,
  useMediaQuery,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Search,
  Filter,
  RefreshCw,
  FileDown,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

const AuditLogFilters = ({
  searchTerm,
  onSearchChange,
  selectedAction,
  onActionChange,
  selectedUser,
  onUserChange,
  selectedResourceType,
  onResourceTypeChange,
  dateRange,
  onDateRangeChange,
  customStartDate,
  onCustomStartDateChange,
  customEndDate,
  onCustomEndDateChange,
  showCriticalOnly,
  onShowCriticalOnlyChange,
  onRefresh,
  onExport,
  onDelete,
  uniqueUsers,
  uniqueActions,
  uniqueResourceTypes,
  cardStyles,
}) => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery('(max-width:900px)');
  const isMediumScreen = useMediaQuery('(max-width:1200px)');

  return (
    <Box sx={{ px: 1, py: 0.5 }}>
      {/* Filter Card - Ultra-kompakt */}
      <Card sx={{ ...cardStyles, mb: 0.5 }}>
        <CardContent sx={{ 
          p: 0.75,
          '&:last-child': { pb: 0.75 }
        }}>
          {/* Search and Critical Filter Row */}
          <Stack direction="row" spacing={0.5} sx={{ mb: 0.5 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Suchen..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={16} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiInputBase-input': {
                  py: 0.5,
                  fontSize: '0.875rem',
                },
                '& .MuiOutlinedInput-root': {
                  backgroundColor: theme.palette.mode === 'dark' 
                    ? 'rgba(255, 255, 255, 0.05)'
                    : 'rgba(0, 0, 0, 0.02)',
                },
              }}
            />
            <Tooltip title={showCriticalOnly ? "Alle Einträge anzeigen" : "Nur kritische Einträge"}>
              <IconButton
                onClick={() => onShowCriticalOnlyChange(!showCriticalOnly)}
                size="small"
                sx={{
                  color: showCriticalOnly ? theme.palette.error.main : theme.palette.text.secondary,
                  backgroundColor: showCriticalOnly 
                    ? theme.palette.error.main + '20'
                    : 'transparent',
                  border: `1px solid ${showCriticalOnly ? theme.palette.error.main : theme.palette.divider}`,
                  '&:hover': {
                    backgroundColor: showCriticalOnly
                      ? theme.palette.error.main + '30'
                      : theme.palette.action.hover,
                    borderColor: theme.palette.error.main,
                  },
                  width: 32,
                  height: 32,
                }}
              >
                <AlertTriangle size={16} />
              </IconButton>
            </Tooltip>
          </Stack>

          {/* Filter Dropdowns - Kompakter */}
          <Stack
            direction="row"
            spacing={1}
            sx={{
              flexWrap: 'wrap',
              gap: 1,
              justifyContent: 'center',
              '& .MuiFormControl-root': {
                flex: '1 1 auto',
                minWidth: 120,
                maxWidth: 180,
              },
              '& .MuiInputBase-root': {
                fontSize: '0.875rem',
              },
              '& .MuiInputBase-input': {
                py: 0.5,
              }
            }}
          >
            <FormControl size="small">
              <InputLabel>Aktion</InputLabel>
              <Select
                value={selectedAction}
                onChange={(e) => onActionChange(e.target.value)}
                label="Aktion"
              >
                <MenuItem value="all">Alle Aktionen</MenuItem>
                {uniqueActions.map(action => (
                  <MenuItem key={action} value={action}>{action}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small">
              <InputLabel>Benutzer</InputLabel>
              <Select
                value={selectedUser}
                onChange={(e) => onUserChange(e.target.value)}
                label="Benutzer"
              >
                <MenuItem value="all">Alle Benutzer</MenuItem>
                {uniqueUsers.map(user => (
                  <MenuItem key={user} value={user}>{user}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small">
              <InputLabel>Ressource</InputLabel>
              <Select
                value={selectedResourceType}
                onChange={(e) => onResourceTypeChange(e.target.value)}
                label="Ressource"
              >
                <MenuItem value="all">Alle Ressourcen</MenuItem>
                {uniqueResourceTypes.map(type => (
                  <MenuItem key={type} value={type}>{type}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small">
              <InputLabel>Zeitraum</InputLabel>
              <Select
                value={dateRange}
                onChange={(e) => onDateRangeChange(e.target.value)}
                label="Zeitraum"
              >
                <MenuItem value="all">Alle</MenuItem>
                <MenuItem value="today">Heute</MenuItem>
                <MenuItem value="yesterday">Gestern</MenuItem>
                <MenuItem value="week">Diese Woche</MenuItem>
                <MenuItem value="month">Dieser Monat</MenuItem>
                <MenuItem value="custom">Benutzerdefiniert</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          {/* Custom Date Range */}
          {dateRange === 'custom' && (
            <Stack
              direction="row"
              spacing={1.5}
              sx={{
                mt: 2,
                flexWrap: 'wrap',
                gap: 1.5,
                justifyContent: 'center',
                '& .MuiTextField-root': {
                  flex: '1 1 auto',
                  minWidth: 140,
                  maxWidth: 200,
                }
              }}
            >
              <TextField
                type="date"
                size="small"
                label="Von"
                value={customStartDate}
                onChange={(e) => onCustomStartDateChange(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                type="date"
                size="small"
                label="Bis"
                value={customEndDate}
                onChange={(e) => onCustomEndDateChange(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons Card - Ultra-kompakt */}
      <Card sx={{ ...cardStyles }}>
        <CardContent sx={{ 
          p: 0.75,
          '&:last-child': { pb: 0.75 }
        }}>
          <Stack 
            direction="row" 
            spacing={1}
            sx={{
              justifyContent: 'center',
              '& .MuiButton-root': {
                minWidth: isSmallScreen ? '100%' : 100,
                py: 0.5,
                fontSize: '0.8rem',
              }
            }}
          >
            <Button
              variant="outlined"
              size="small"
              onClick={onRefresh}
              startIcon={<RefreshCw size={16} />}
              fullWidth={isSmallScreen}
            >
              Aktualisieren
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={onExport}
              startIcon={<FileDown size={16} />}
              fullWidth={isSmallScreen}
            >
              Export
            </Button>
            {onDelete && (
              <Button
                variant="outlined"
                size="small"
                onClick={onDelete}
                startIcon={<Trash2 size={16} />}
                fullWidth={isSmallScreen}
                sx={{ 
                  color: theme.palette.error.main,
                  borderColor: theme.palette.error.main,
                  '&:hover': {
                    backgroundColor: theme.palette.error.main + '20',
                    borderColor: theme.palette.error.main,
                  }
                }}
              >
                Löschen
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export default AuditLogFilters;
