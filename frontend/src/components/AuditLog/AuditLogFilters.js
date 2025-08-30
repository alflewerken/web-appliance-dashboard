// Audit Log Filter Component - Responsive Version

import React from 'react';
import { useTranslation } from 'react-i18next';
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
import { formatActionName } from './AuditLogActions';

// Helper function to format resource types with i18n
const formatResourceType = (type, t) => {
  const resourceTypeKey = `resourceTypes.${type}`;
  const translated = t(resourceTypeKey, { defaultValue: '' });
  
  // Falls keine Übersetzung gefunden wurde, Fallback auf Mapping
  if (!translated || translated === resourceTypeKey) {
    const resourceTypeMap = {
      'appliance': 'Service',
      'appliances': 'Services',
      'host': 'Host',
      'hosts': 'Hosts',
      'ssh_host': 'SSH Host',
      'ssh_hosts': 'SSH Hosts',
      'category': t('categories.title', 'Category'),
      'categories': t('categories.title', 'Categories'),
      'service': 'Service',
      'services': 'Services',
      'user': t('users.title', 'User'),
      'users': t('users.title', 'Users'),
      'settings': t('settings.title', 'Settings'),
      'backup': t('backup.title', 'Backup'),
      'audit_logs': t('auditLog.title', 'Audit Logs'),
      'ssh_key': t('sshKeys.title', 'SSH Key'),
      'ssh_keys': t('sshKeys.title', 'SSH Keys'),
    };
    return resourceTypeMap[type] || type;
  }
  
  return translated;
};

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
  const { t } = useTranslation();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  const handleClearFilters = () => {
    onSearchChange('');
    onActionChange('all');
    onUserChange('all');
    onResourceTypeChange('all');
    onDateRangeChange('today');
    onCustomStartDateChange('');
    onCustomEndDateChange('');
    onShowCriticalOnlyChange(false);
  };

  const hasActiveFilters = 
    searchTerm ||
    selectedAction !== 'all' ||
    selectedUser !== 'all' ||
    selectedResourceType !== 'all' ||
    dateRange !== 'today' ||
    showCriticalOnly;

  const dateRangeOptions = [
    { value: 'all', label: t('common.all', 'All') },
    { value: 'today', label: t('auditLog.today') },
    { value: 'yesterday', label: t('auditLog.yesterday') },
    { value: 'week', label: t('auditLog.lastWeek') },
    { value: 'month', label: t('auditLog.lastMonth') },
    { value: 'custom', label: t('auditLog.customRange') },
  ];

  return (
    <Box sx={{ px: 2, pb: 2 }}>
      <Card sx={cardStyles}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Stack spacing={2}>
            {/* Search Bar */}
            <TextField
              fullWidth
              size="small"
              placeholder={t('auditLog.filters.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={18} />
                  </InputAdornment>
                ),
              }}
            />

            {/* Filter Dropdowns - responsive grid */}
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: isMobile 
                ? '1fr' 
                : isTablet 
                  ? 'repeat(2, 1fr)' 
                  : 'repeat(4, 1fr)',
              gap: 1,
            }}>
              {/* Action Filter */}
              <FormControl size="small" fullWidth>
                <InputLabel>{t('auditLog.action')}</InputLabel>
                <Select
                  value={selectedAction}
                  onChange={(e) => onActionChange(e.target.value)}
                  label={t('auditLog.action')}
                >
                  <MenuItem value="all">{t('auditLog.allActions')}</MenuItem>
                  {uniqueActions.map(action => (
                    <MenuItem key={action} value={action}>
                      {formatActionName(action, t)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* User Filter */}
              <FormControl size="small" fullWidth>
                <InputLabel>{t('auditLog.user')}</InputLabel>
                <Select
                  value={selectedUser}
                  onChange={(e) => onUserChange(e.target.value)}
                  label={t('auditLog.user')}
                >
                  <MenuItem value="all">{t('auditLog.allUsers')}</MenuItem>
                  {uniqueUsers.map(user => (
                    <MenuItem key={user} value={user}>
                      {user}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Resource Type Filter */}
              <FormControl size="small" fullWidth>
                <InputLabel>{t('auditLog.resourceType')}</InputLabel>
                <Select
                  value={selectedResourceType}
                  onChange={(e) => onResourceTypeChange(e.target.value)}
                  label={t('auditLog.resourceType')}
                >
                  <MenuItem value="all">{t('auditLog.allResourceTypes')}</MenuItem>
                  {uniqueResourceTypes.map(type => (
                    <MenuItem key={type} value={type}>
                      {formatResourceType(type, t)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Date Range Filter */}
              <FormControl size="small" fullWidth>
                <InputLabel>{t('auditLog.filters.dateRange')}</InputLabel>
                <Select
                  value={dateRange}
                  onChange={(e) => onDateRangeChange(e.target.value)}
                  label={t('auditLog.filters.dateRange')}
                >
                  {dateRangeOptions.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Custom Date Range */}
            {dateRange === 'custom' && (
              <Stack direction={isMobile ? "column" : "row"} spacing={1}>
                <TextField
                  fullWidth
                  size="small"
                  label={t('auditLog.from')}
                  type="date"
                  value={customStartDate}
                  onChange={(e) => onCustomStartDateChange(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  fullWidth
                  size="small"
                  label={t('auditLog.to')}
                  type="date"
                  value={customEndDate}
                  onChange={(e) => onCustomEndDateChange(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Stack>
            )}

            {/* Critical Only Toggle & Action Buttons */}
            <Stack 
              direction={isMobile ? "column" : "row"} 
              spacing={1}
              sx={{ justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center' }}
            >
              {/* Critical Actions Toggle */}
              <Button
                variant={showCriticalOnly ? "contained" : "outlined"}
                size="small"
                startIcon={<AlertTriangle size={16} />}
                onClick={() => onShowCriticalOnlyChange(!showCriticalOnly)}
                sx={{
                  borderColor: theme.palette.error.main,
                  color: showCriticalOnly 
                    ? theme.palette.common.white 
                    : theme.palette.error.main,
                  backgroundColor: showCriticalOnly 
                    ? theme.palette.error.main 
                    : 'transparent',
                  '&:hover': {
                    backgroundColor: showCriticalOnly
                      ? theme.palette.error.dark
                      : theme.palette.error.main + '10',
                  },
                }}
              >
                {t('auditLog.showCriticalOnly')}
              </Button>

              {/* Action Buttons */}
              <Stack direction="row" spacing={1} sx={{ justifyContent: isMobile ? 'center' : 'flex-end' }}>
                {hasActiveFilters && (
                  <Tooltip title={t('auditLog.filters.clear')}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleClearFilters}
                      sx={{ minWidth: 'auto', px: 1 }}
                    >
                      {t('auditLog.filters.clear')}
                    </Button>
                  </Tooltip>
                )}
                
                <Tooltip title={t('auditLog.tooltips.refresh')}>
                  <IconButton 
                    size="small" 
                    onClick={onRefresh}
                    sx={{ 
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: 1,
                    }}
                  >
                    <RefreshCw size={16} />
                  </IconButton>
                </Tooltip>

                <Tooltip title={t('auditLog.tooltips.export')}>
                  <IconButton 
                    size="small" 
                    onClick={onExport}
                    sx={{ 
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: 1,
                    }}
                  >
                    <FileDown size={16} />
                  </IconButton>
                </Tooltip>

                <Tooltip title={t('auditLog.tooltips.delete')}>
                  <IconButton 
                    size="small" 
                    onClick={onDelete}
                    sx={{ 
                      border: `1px solid ${theme.palette.error.main}`,
                      borderRadius: 1,
                      color: theme.palette.error.main,
                      '&:hover': {
                        backgroundColor: theme.palette.error.main + '10',
                      },
                    }}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export default AuditLogFilters;