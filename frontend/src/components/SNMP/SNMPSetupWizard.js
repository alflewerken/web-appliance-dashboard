import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  LinearProgress,
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Collapse,
  FormControlLabel,
  Switch
} from '@mui/material';
import {
  Settings,
  Download,
  CheckCircle,
  Error as ErrorIcon,
  Info,
  Warning,
  PlayArrow,
  HelpOutline,
  Security,
  NetworkCheck,
  Computer
} from '@mui/icons-material';
import { Wifi, Shield, Server, Activity, AlertTriangle, Check } from 'lucide-react';
import axios from 'axios';

const SNMPSetupWizard = ({ open, onClose, host, onSuccess }) => {
  // Wizard State
  const [activeStep, setActiveStep] = useState(0);
  const [setupStatus, setSetupStatus] = useState('idle'); // idle, checking, installing, configuring, testing, success, error
  const [statusMessage, setStatusMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Form State
  const [config, setConfig] = useState({
    community: 'monitoring-' + Math.random().toString(36).substring(7),
    port: 161,
    location: 'Server Room',
    contact: 'admin@company.com',
    allowedNetwork: '192.168.0.0/16',
    enableDiskMonitoring: true,
    enableProcessMonitoring: true,
    monitoredDisks: ['/', '/var', '/home'],
    monitoredProcesses: ['sshd', 'nginx', 'mysql']
  });

  // OS-spezifische Befehle
  const getInstallCommands = (osType) => {
    const commands = {
      'ubuntu': [
        'apt-get update',
        'apt-get install -y snmpd snmp snmp-mibs-downloader',
        'systemctl stop snmpd'
      ],
      'debian': [
        'apt-get update',
        'apt-get install -y snmpd snmp snmp-mibs-downloader',
        'systemctl stop snmpd'
      ],
      'centos': [
        'yum install -y net-snmp net-snmp-utils',
        'systemctl stop snmpd'
      ],
      'rhel': [
        'yum install -y net-snmp net-snmp-utils',
        'systemctl stop snmpd'
      ],
      'rocky': [
        'dnf install -y net-snmp net-snmp-utils',
        'systemctl stop snmpd'
      ],
      'macos': [
        'which brew || /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
        'brew install net-snmp',
        'sudo launchctl unload -w /Library/LaunchDaemons/org.net-snmp.snmpd.plist 2>/dev/null'
      ]
    };

    return commands[osType.toLowerCase()] || commands['ubuntu'];
  };

  // SNMP-Konfiguration generieren
  const generateSNMPConfig = () => {
    const diskLines = config.enableDiskMonitoring 
      ? config.monitoredDisks.map(disk => `disk ${disk} 10000`).join('\n')
      : '';
    
    const processLines = config.enableProcessMonitoring
      ? config.monitoredProcesses.map(proc => `proc ${proc}`).join('\n')
      : '';

    return `
# Auto-generated SNMP Configuration by Web Appliance Dashboard
# Generated: ${new Date().toISOString()}

# Agent Address
agentAddress udp:${config.port}

# System Information
sysLocation    ${config.location}
sysContact     ${config.contact}
sysServices    72

# Access Control
rocommunity ${config.community} ${config.allowedNetwork}

# View Configuration
view systemonly included .1.3.6.1.2.1.1
view systemonly included .1.3.6.1.2.1.25.1
view systemonly included .1.3.6.1.4.1.2021

# Disk Monitoring
${diskLines}

# Process Monitoring
${processLines}

# Load Monitoring
load 12 10 5

# Include additional configs
includeDir /etc/snmp/snmpd.conf.d
`;
  };

  // Installation durchführen
  const performInstallation = async () => {
    try {
      setSetupStatus('checking');
      setProgress(10);
      addLog('🔍 Checking system requirements...', 'info');

      // Step 1: Check OS and requirements
      const checkResponse = await axios.post(`${window.location.origin}/api/ssh/execute`, {
        hostId: host.id,
        command: 'uname -s && cat /etc/os-release 2>/dev/null || sw_vers 2>/dev/null',
        useSudo: false
      });

      const osInfo = checkResponse.data.output;
      addLog('✅ System detected: ' + osInfo.split('\n')[0], 'success');
      setProgress(20);

      // Step 2: Install SNMP packages
      setSetupStatus('installing');
      addLog('📦 Installing SNMP packages...', 'info');
      
      const installCommands = getInstallCommands(host.osType || 'ubuntu');
      
      for (let i = 0; i < installCommands.length; i++) {
        const cmd = installCommands[i];
        addLog(`Running: ${cmd}`, 'info');
        
        const response = await axios.post(`${window.location.origin}/api/ssh/execute`, {
          hostId: host.id,
          command: `sudo ${cmd}`,
          timeout: 60000
        });
        
        if (response.data.success) {
          addLog(`✅ Command completed`, 'success');
        } else {
          addLog(`⚠️ Warning: ${response.data.error}`, 'warning');
        }
        
        setProgress(20 + (i + 1) * (30 / installCommands.length));
      }

      // Step 3: Configure SNMP
      setSetupStatus('configuring');
      setProgress(50);
      addLog('⚙️ Configuring SNMP...', 'info');

      // Backup existing config
      await axios.post(`${window.location.origin}/api/ssh/execute`, {
        hostId: host.id,
        command: `sudo cp /etc/snmp/snmpd.conf /etc/snmp/snmpd.conf.backup.${Date.now()} 2>/dev/null || true`
      });
      addLog('📋 Backed up existing configuration', 'info');

      // Write new configuration
      const snmpConfig = generateSNMPConfig();
      const writeConfigCmd = `cat > /tmp/snmpd.conf << 'EOF'${snmpConfig}EOF`;
      
      await axios.post(`${window.location.origin}/api/ssh/execute`, {
        hostId: host.id,
        command: writeConfigCmd
      });
      
      await axios.post(`${window.location.origin}/api/ssh/execute`, {
        hostId: host.id,
        command: `sudo mv /tmp/snmpd.conf /etc/snmp/snmpd.conf`
      });
      
      addLog('✅ SNMP configuration written', 'success');
      setProgress(60);

      // Step 4: Configure firewall
      addLog('🔥 Configuring firewall...', 'info');
      
      // Try different firewall commands based on what's available
      const firewallCommands = [
        `ufw allow ${config.port}/udp`,
        `firewall-cmd --permanent --add-port=${config.port}/udp && firewall-cmd --reload`,
        `iptables -A INPUT -p udp --dport ${config.port} -s ${config.allowedNetwork} -j ACCEPT`
      ];
      
      for (const cmd of firewallCommands) {
        try {
          await axios.post(`${window.location.origin}/api/ssh/execute`, {
            hostId: host.id,
            command: `sudo ${cmd}`,
            timeout: 10000
          });
          addLog('✅ Firewall configured', 'success');
          break;
        } catch (e) {
          // Try next firewall command
        }
      }
      setProgress(70);

      // Step 5: Start SNMP service
      addLog('🚀 Starting SNMP service...', 'info');
      
      const startCommands = host.osType === 'macos' 
        ? ['launchctl load -w /Library/LaunchDaemons/org.net-snmp.snmpd.plist']
        : ['systemctl start snmpd', 'systemctl enable snmpd'];
      
      for (const cmd of startCommands) {
        await axios.post(`${window.location.origin}/api/ssh/execute`, {
          hostId: host.id,
          command: `sudo ${cmd}`
        });
      }
      
      addLog('✅ SNMP service started', 'success');
      setProgress(80);

      // Step 6: Test SNMP connection
      setSetupStatus('testing');
      addLog('🧪 Testing SNMP connection...', 'info');
      
      const testResponse = await axios.post(`${window.location.origin}/api/snmp/test`, {
        ip: host.ip,
        port: config.port,
        community: config.community,
        version: 'v2c',
        osType: host.osType
      });
      
      if (testResponse.data.success) {
        addLog('✅ SNMP connection successful!', 'success');
        setProgress(100);
        setSetupStatus('success');
        
        // Save SNMP configuration to database
        await axios.put(`${window.location.origin}/api/hosts/${host.id}/snmp-config`, {
          snmpEnabled: true,
          snmpCommunity: config.community,
          snmpPort: config.port,
          snmpVersion: 'v2c'
        });
        
        setTimeout(() => {
          onSuccess && onSuccess();
        }, 2000);
      } else {
        throw new Error('SNMP test failed: ' + testResponse.data.message);
      }

    } catch (error) {
      console.error('Setup failed:', error);
      setSetupStatus('error');
      addLog(`❌ Setup failed: ${error.message}`, 'error');
      setStatusMessage(error.message);
    }
  };

  // Log-Eintrag hinzufügen
  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, {
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    }]);
  };

  // Wizard-Schritte
  const steps = [
    {
      label: 'Configuration',
      icon: <Settings />,
      description: 'Configure SNMP parameters'
    },
    {
      label: 'Installation',
      icon: <Download />,
      description: 'Install SNMP packages'
    },
    {
      label: 'Testing',
      icon: <NetworkCheck />,
      description: 'Verify SNMP connection'
    }
  ];

  const handleNext = () => {
    if (activeStep === 0) {
      // Start installation after configuration
      setActiveStep(1);
      performInstallation();
    }
  };

  const handleClose = () => {
    if (setupStatus === 'idle' || setupStatus === 'success' || setupStatus === 'error') {
      onClose();
      // Reset state
      setActiveStep(0);
      setSetupStatus('idle');
      setLogs([]);
      setProgress(0);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        style: {
          minHeight: '70vh',
          maxHeight: '90vh'
        }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          <Activity size={28} />
          <Typography variant="h5">
            SNMP Auto-Setup Wizard
          </Typography>
          <Chip 
            label={host?.hostname || host?.ip} 
            icon={<Computer />}
            variant="outlined"
            style={{ marginLeft: 'auto' }}
          />
        </Box>
      </DialogTitle>

      <DialogContent divider>
        <Box sx={{ mb: 3 }}>
          {setupStatus !== 'idle' && (
            <LinearProgress 
              variant="determinate" 
              value={progress} 
              sx={{ mb: 2, height: 8, borderRadius: 4 }}
            />
          )}

          <Stepper activeStep={activeStep} orientation="vertical">
            {steps.map((step, index) => (
              <Step key={step.label}>
                <StepLabel
                  StepIconComponent={() => (
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 
                          activeStep > index ? 'success.main' :
                          activeStep === index ? 'primary.main' : 
                          'grey.300',
                        color: 'white'
                      }}
                    >
                      {activeStep > index ? <CheckCircle /> : step.icon}
                    </Box>
                  )}
                >
                  <Typography variant="h6">{step.label}</Typography>
                  <Typography variant="caption">{step.description}</Typography>
                </StepLabel>
                
                <StepContent>
                  {index === 0 && setupStatus === 'idle' && (
                    <Box sx={{ mt: 2 }}>
                      {/* SSH Key Info */}
                      <Alert severity="info" sx={{ mb: 2 }}>
                        <Typography variant="subtitle2">SSH Authentication</Typography>
                        <Typography variant="caption">
                          This wizard uses the SSH keys already registered on this host for passwordless access.
                          Make sure you have clicked "Register Key" in the General tab before running this setup.
                        </Typography>
                      </Alert>
                      
                      {/* Basic Configuration */}
                      <Card variant="outlined" sx={{ mb: 2 }}>
                        <CardContent>
                          <Typography variant="subtitle1" gutterBottom>
                            <Security sx={{ mr: 1, verticalAlign: 'middle' }} />
                            Security Configuration
                          </Typography>
                          
                          <TextField
                            label="Community String"
                            fullWidth
                            margin="normal"
                            value={config.community}
                            onChange={(e) => setConfig({...config, community: e.target.value})}
                            helperText="Secure passphrase for SNMP access"
                            InputProps={{
                              endAdornment: (
                                <Tooltip title="Generate random">
                                  <IconButton
                                    onClick={() => setConfig({
                                      ...config, 
                                      community: 'monitoring-' + Math.random().toString(36).substring(7)
                                    })}
                                  >
                                    <Shield size={20} />
                                  </IconButton>
                                </Tooltip>
                              )
                            }}
                          />
                          
                          <TextField
                            label="SNMP Port"
                            type="number"
                            margin="normal"
                            value={config.port}
                            onChange={(e) => setConfig({...config, port: e.target.value})}
                            style={{ width: '48%', marginRight: '4%' }}
                          />
                          
                          <TextField
                            label="Allowed Network"
                            margin="normal"
                            value={config.allowedNetwork}
                            onChange={(e) => setConfig({...config, allowedNetwork: e.target.value})}
                            style={{ width: '48%' }}
                            helperText="CIDR notation (e.g., 192.168.0.0/16)"
                          />
                        </CardContent>
                      </Card>

                      {/* System Information */}
                      <Card variant="outlined" sx={{ mb: 2 }}>
                        <CardContent>
                          <Typography variant="subtitle1" gutterBottom>
                            <Info sx={{ mr: 1, verticalAlign: 'middle' }} />
                            System Information
                          </Typography>
                          
                          <TextField
                            label="Location"
                            fullWidth
                            margin="normal"
                            value={config.location}
                            onChange={(e) => setConfig({...config, location: e.target.value})}
                            placeholder="e.g., Server Room, Rack A1"
                          />
                          
                          <TextField
                            label="Contact"
                            fullWidth
                            margin="normal"
                            value={config.contact}
                            onChange={(e) => setConfig({...config, contact: e.target.value})}
                            placeholder="admin@company.com"
                          />
                        </CardContent>
                      </Card>

                      {/* Advanced Options */}
                      <Card variant="outlined">
                        <CardContent>
                          <Box display="flex" alignItems="center" justifyContent="space-between">
                            <Typography variant="subtitle1">
                              Advanced Monitoring Options
                            </Typography>
                            <IconButton onClick={() => setShowAdvanced(!showAdvanced)}>
                              <Settings />
                            </IconButton>
                          </Box>
                          
                          <Collapse in={showAdvanced}>
                            <Box sx={{ mt: 2 }}>
                              <FormControlLabel
                                control={
                                  <Switch
                                    checked={config.enableDiskMonitoring}
                                    onChange={(e) => setConfig({...config, enableDiskMonitoring: e.target.checked})}
                                  />
                                }
                                label="Enable Disk Monitoring"
                              />
                              
                              {config.enableDiskMonitoring && (
                                <TextField
                                  label="Monitored Disks"
                                  fullWidth
                                  margin="normal"
                                  value={config.monitoredDisks.join(', ')}
                                  onChange={(e) => setConfig({
                                    ...config, 
                                    monitoredDisks: e.target.value.split(',').map(d => d.trim())
                                  })}
                                  helperText="Comma-separated mount points"
                                />
                              )}
                              
                              <FormControlLabel
                                control={
                                  <Switch
                                    checked={config.enableProcessMonitoring}
                                    onChange={(e) => setConfig({...config, enableProcessMonitoring: e.target.checked})}
                                  />
                                }
                                label="Enable Process Monitoring"
                                sx={{ mt: 1 }}
                              />
                              
                              {config.enableProcessMonitoring && (
                                <TextField
                                  label="Monitored Processes"
                                  fullWidth
                                  margin="normal"
                                  value={config.monitoredProcesses.join(', ')}
                                  onChange={(e) => setConfig({
                                    ...config, 
                                    monitoredProcesses: e.target.value.split(',').map(p => p.trim())
                                  })}
                                  helperText="Comma-separated process names"
                                />
                              )}
                            </Box>
                          </Collapse>
                        </CardContent>
                      </Card>
                    </Box>
                  )}

                  {(index === 1 && setupStatus !== 'idle') && (
                    <Box sx={{ mt: 2 }}>
                      {/* Installation Logs */}
                      <Card 
                        variant="outlined" 
                        sx={{ 
                          bgcolor: 'grey.900', 
                          color: 'white',
                          maxHeight: 300,
                          overflowY: 'auto'
                        }}
                      >
                        <CardContent>
                          <Typography variant="caption" component="pre" sx={{ fontFamily: 'monospace' }}>
                            {logs.map((log, idx) => (
                              <Box key={idx} sx={{ 
                                color: 
                                  log.type === 'error' ? 'error.light' :
                                  log.type === 'success' ? 'success.light' :
                                  log.type === 'warning' ? 'warning.light' :
                                  'grey.300'
                              }}>
                                [{log.timestamp}] {log.message}
                              </Box>
                            ))}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Box>
                  )}

                  {index === 2 && setupStatus === 'success' && (
                    <Box sx={{ mt: 2 }}>
                      <Alert severity="success" icon={<CheckCircle />}>
                        <Typography variant="h6">Setup Completed Successfully!</Typography>
                        <Typography variant="body2">
                          SNMP has been installed and configured on {host?.hostname || host?.ip}.
                          The host is now ready for monitoring.
                        </Typography>
                      </Alert>
                      
                      <Card variant="outlined" sx={{ mt: 2 }}>
                        <CardContent>
                          <Typography variant="subtitle2" gutterBottom>Configuration Summary:</Typography>
                          <Box sx={{ mt: 1 }}>
                            <Chip label={`Community: ${config.community}`} size="small" sx={{ m: 0.5 }} />
                            <Chip label={`Port: ${config.port}`} size="small" sx={{ m: 0.5 }} />
                            <Chip label={`Network: ${config.allowedNetwork}`} size="small" sx={{ m: 0.5 }} />
                          </Box>
                        </CardContent>
                      </Card>
                    </Box>
                  )}

                  {setupStatus === 'error' && (
                    <Alert severity="error" icon={<ErrorIcon />} sx={{ mt: 2 }}>
                      <Typography variant="subtitle1">Setup Failed</Typography>
                      <Typography variant="body2">{statusMessage}</Typography>
                      <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                        Please check the logs above for details or try manual installation.
                      </Typography>
                    </Alert>
                  )}
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={setupStatus === 'installing'}>
          {setupStatus === 'success' ? 'Close' : 'Cancel'}
        </Button>
        
        {setupStatus === 'idle' && (
          <Button
            variant="contained"
            onClick={handleNext}
            startIcon={<PlayArrow />}
            disabled={!config.community}
          >
            Start Installation
          </Button>
        )}
        
        {setupStatus === 'error' && (
          <Button
            variant="contained"
            onClick={() => {
              setSetupStatus('idle');
              setLogs([]);
              setProgress(0);
            }}
            color="warning"
          >
            Retry
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default SNMPSetupWizard;
