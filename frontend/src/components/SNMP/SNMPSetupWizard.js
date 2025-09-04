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
  const getInstallCommands = (osType, brewPath = '/usr/local') => {
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
        `which brew || echo "Please install Homebrew first at https://brew.sh"`,
        // Ensure we install net-snmp from Homebrew
        `${brewPath}/bin/brew install net-snmp || brew install net-snmp`,
        // Link the binaries if not already linked
        `${brewPath}/bin/brew link net-snmp 2>/dev/null || true`,
        // Stop any running SNMP daemons
        'killall snmpd 2>/dev/null || true',
        // Verify Homebrew's snmpd is installed and show its location
        `ls -la ${brewPath}/sbin/snmpd 2>/dev/null || ls -la ${brewPath}/Cellar/net-snmp/*/sbin/snmpd 2>/dev/null || echo "WARNING: snmpd binary not found"`
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

    // Simplified config for better compatibility
    return `
# Auto-generated SNMP Configuration by Web Appliance Dashboard
# Generated: ${new Date().toISOString()}

# Agent Address - For macOS without sudo, use high port
agentAddress udp:1161,udp6:[::]:1161

# System Information
sysLocation    ${config.location}
sysContact     ${config.contact}
sysServices    72

# Access Control - Allow from specified network
rocommunity ${config.community} ${config.allowedNetwork}
rocommunity ${config.community} localhost
rocommunity ${config.community} 127.0.0.1

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

      // Debug: Log host object

      if (!host) {
        addLog('❌ Error: No host information provided', 'error');
        setSetupStatus('error');
        setStatusMessage('No host information available');
        return;
      }
      
      if (!host.id && host.id !== 0) {
        addLog('❌ Error: Host has not been saved yet', 'error');
        addLog('Please save the host configuration first, then run SNMP setup', 'error');
        setSetupStatus('error');
        setStatusMessage('Host must be saved before SNMP setup');
        return;
      }
      
      if (!host.hostname && !host.ip) {
        addLog('❌ Error: Host has no hostname or IP address', 'error');
        setSetupStatus('error');
        setStatusMessage('Host needs hostname or IP address');
        return;
      }

      // Step 1: Check OS and requirements
      const checkResponse = await axios.post('/api/ssh/execute', {
        hostId: host.id,
        command: 'uname -s && uname -m && cat /etc/os-release 2>/dev/null || sw_vers 2>/dev/null',
        useSudo: false
      });

      const osInfo = checkResponse.data.output;
      const lines = osInfo.split('\n');
      const osType = lines[0].toLowerCase(); // uname -s (Darwin for macOS)
      const arch = lines[1]?.toLowerCase() || ''; // uname -m (arm64 for M-series, x86_64 for Intel)
      
      addLog('✅ System detected: ' + osType + ' (' + arch + ')', 'success');
      setProgress(20);

      // Determine the actual OS type for installation commands
      let detectedOS = 'ubuntu'; // default
      let homebrewPath = '/usr/local'; // default for Intel Macs
      
      if (osType === 'darwin') {
        detectedOS = 'macos';
        // Check if it's Apple Silicon (M1/M2/M3) or Intel
        if (arch === 'arm64') {
          homebrewPath = '/opt/homebrew';
          addLog('📱 Apple Silicon Mac detected (M-series)', 'info');
        } else {
          homebrewPath = '/usr/local';
          addLog('💻 Intel Mac detected', 'info');
        }
      } else if (osInfo.includes('ubuntu')) {
        detectedOS = 'ubuntu';
      } else if (osInfo.includes('debian')) {
        detectedOS = 'debian';
      } else if (osInfo.includes('centos')) {
        detectedOS = 'centos';
      } else if (osInfo.includes('rhel') || osInfo.includes('red hat')) {
        detectedOS = 'rhel';
      } else if (osInfo.includes('rocky')) {
        detectedOS = 'rocky';
      }

      // Step 2: Install SNMP packages
      setSetupStatus('installing');
      addLog('📦 Installing SNMP packages...', 'info');
      
      const installCommands = getInstallCommands(detectedOS, homebrewPath);
      
      for (let i = 0; i < installCommands.length; i++) {
        const cmd = installCommands[i];
        addLog(`Running: ${cmd}`, 'info');
        
        // For macOS/homebrew, don't use sudo for brew commands
        const needsSudo = detectedOS !== 'macos' || !cmd.includes('brew');
        const fullCommand = needsSudo ? `sudo -S ${cmd}` : cmd;
        
        const response = await axios.post('/api/ssh/execute', {
          hostId: host.id,
          command: fullCommand,
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

      // Determine config path based on OS and architecture
      let configPath = '/etc/snmp/snmpd.conf'; // default for Linux
      if (detectedOS === 'macos') {
        configPath = `${homebrewPath}/etc/snmp/snmpd.conf`;
      }

      // Backup existing config - no sudo needed for macOS homebrew dirs
      const backupCmd = detectedOS === 'macos'
        ? `cp ${configPath} ${configPath}.backup.${Date.now()} 2>/dev/null || true`
        : `sudo cp ${configPath} ${configPath}.backup.${Date.now()} 2>/dev/null || true`;
      
      await axios.post('/api/ssh/execute', {
        hostId: host.id,
        command: backupCmd
      });
      addLog('📋 Backed up existing configuration', 'info');

      // Write new configuration
      const snmpConfig = generateSNMPConfig();
      const writeConfigCmd = `cat > /tmp/snmpd.conf << 'EOF'${snmpConfig}EOF`;
      
      await axios.post('/api/ssh/execute', {
        hostId: host.id,
        command: writeConfigCmd
      });
      
      // Create directory if it doesn't exist (for macOS) - no sudo needed for Homebrew directories
      if (detectedOS === 'macos') {
        try {
          // Homebrew directories are user-writable on both Intel and Apple Silicon
          const mkdirCmd = `mkdir -p ${homebrewPath}/etc/snmp`;
          addLog('📁 Creating config directory...', 'info');
          
          await axios.post('/api/ssh/execute', {
            hostId: host.id,
            command: mkdirCmd
          });
          addLog('✅ Config directory created/verified', 'success');
        } catch (e) {
          // Directory might already exist, which is fine
          addLog('ℹ️ Config directory already exists', 'info');
        }
      }
      
      // Move config file - macOS homebrew dirs don't need sudo, Linux does
      const moveCmd = detectedOS === 'macos' 
        ? `mv /tmp/snmpd.conf ${configPath}`
        : `sudo mv /tmp/snmpd.conf ${configPath}`;
      
      await axios.post('/api/ssh/execute', {
        hostId: host.id,
        command: moveCmd
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
          await axios.post('/api/ssh/execute', {
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
      
      let startCommands;
      if (detectedOS === 'macos') {
        // For macOS: Try to run without sudo on high port (1161)
        // First find the actual snmpd binary location
        startCommands = [
          // Find snmpd location
          `find ${homebrewPath} -name snmpd -type f 2>/dev/null | grep sbin | head -1`,
          // Kill any existing snmpd (without sudo)
          'killall snmpd 2>/dev/null || true',
          // Start snmpd without sudo on port 1161 (no root needed for high ports)
          `${homebrewPath}/sbin/snmpd -c ${homebrewPath}/etc/snmp/snmpd.conf 2>/dev/null || ${homebrewPath}/Cellar/net-snmp/*/sbin/snmpd -c ${homebrewPath}/etc/snmp/snmpd.conf`,
        ];
      } else {
        startCommands = ['systemctl start snmpd', 'systemctl enable snmpd'];
      }
      
      for (const cmd of startCommands) {
        try {
          addLog(`Running: ${cmd}`, 'info');
          const response = await axios.post('/api/ssh/execute', {
            hostId: host.id,
            command: detectedOS === 'macos' ? cmd : `sudo ${cmd}`,
            timeout: 10000
          });
          
          if (response.data.output) {
            addLog(`Output: ${response.data.output}`, 'info');
          }
          
          if (response.data.error && !response.data.error.includes('kill: No such process')) {
            addLog(`⚠️ Warning: ${response.data.error}`, 'warning');
          }
        } catch (e) {
          if (!e.message.includes('kill: No such process')) {
            addLog(`⚠️ Command warning: ${e.message}`, 'warning');
          }
        }
      }
      
      // Verify snmpd is running on macOS with multiple checks
      if (detectedOS === 'macos') {
        addLog('Verifying SNMP service...', 'info');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if process is running
        const checkResponse = await axios.post('/api/ssh/execute', {
          hostId: host.id,
          command: 'ps aux | grep -v grep | grep snmpd',
          timeout: 5000
        });
        
        if (checkResponse.data.output && checkResponse.data.output.includes('snmpd')) {
          addLog('✅ SNMP process is running', 'success');
          
          // Check if port 1161 is open (high port, no sudo needed)
          const portCheck = await axios.post('/api/ssh/execute', {
            hostId: host.id,
            command: 'lsof -i UDP:1161 2>/dev/null || netstat -an | grep 1161',
            timeout: 5000
          });
          
          if (portCheck.data.output && (portCheck.data.output.includes('1161') || portCheck.data.output.includes('snmpd'))) {
            addLog('✅ SNMP listening on port 1161', 'success');
          } else {
            addLog('ℹ️ SNMP process running, port check requires sudo', 'info');
          }
        } else {
          addLog('⚠️ SNMP service may not have started - trying alternative method', 'warning');
          
          // Try to find and start snmpd from Cellar directory
          const findResponse = await axios.post('/api/ssh/execute', {
            hostId: host.id,
            command: `find ${homebrewPath}/Cellar -name snmpd -type f 2>/dev/null | grep sbin | head -1`,
            timeout: 5000
          });
          
          if (findResponse.data.output) {
            const snmpdPath = findResponse.data.output.trim();
            addLog(`Found snmpd at: ${snmpdPath}`, 'info');
            
            await axios.post('/api/ssh/execute', {
              hostId: host.id,
              command: `${snmpdPath} -c ${homebrewPath}/etc/snmp/snmpd.conf`,
              timeout: 5000
            });
            
            addLog('Started snmpd with found binary', 'info');
          }
        }
      } else {
        addLog('✅ SNMP service started', 'success');
      }
      setProgress(80);

      // Step 6: Test SNMP connection
      setSetupStatus('testing');
      addLog('🧪 Testing SNMP connection...', 'info');
      
      // Wait a bit for SNMP service to fully start
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const testResponse = await axios.post('/api/snmp/test', {
        ip: host.hostname || host.ip,  // Use hostname which contains the IP
        port: detectedOS === 'macos' ? 1161 : 161,  // Use port 1161 for macOS (no sudo), 161 for Linux
        community: config.community,
        version: '2c',  // v2c not v2c
        osType: detectedOS  // Use detected OS, not host.osType
      });
      
      if (testResponse.data.success) {
        addLog('✅ SNMP connection successful!', 'success');
        setProgress(100);
        setSetupStatus('success');
        
        // Save SNMP configuration to database
        await axios.put(`/api/hosts/${host.id}/snmp-config`, {
          enabled: true,
          version: '2c',
          community: config.community,
          port: detectedOS === 'macos' ? 1161 : 161,  // Save the actual port used
          username: '',
          authProtocol: 'SHA',
          authPassword: '',
          privProtocol: 'AES',
          privPassword: '',
          pollInterval: 60
        });
        
        addLog('💾 Configuration saved to database', 'success');
        
        setTimeout(() => {
          // Pass COMPLETE config data to parent - with correct port!
          onSuccess && onSuccess({
            enabled: true,
            version: '2c',
            community: config.community,
            port: detectedOS === 'macos' ? 1161 : 161,  // IMPORTANT: Use actual port!
            username: '',
            authProtocol: 'SHA',
            authPassword: '',
            privProtocol: 'AES',
            privPassword: '',
            pollInterval: 60
          });
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

  const handleClose = (event, reason) => {
    // Verhindert das Schließen beim Klick auf Backdrop
    if (reason === 'backdropClick') {
      return;
    }
    
    // Verhindert das Schließen während der Installation
    if (setupStatus === 'installing') {
      return;
    }
    
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
      disableEscapeKeyDown={setupStatus === 'installing'}
      maxWidth="md"
      fullWidth
      PaperProps={{
        style: {
          minHeight: '70vh',
          maxHeight: '90vh',
          zIndex: 1301  // Erhöhter z-index für sicheren Vordergrund
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
          <button
            onClick={() => {

              handleNext();
            }}
            disabled={!config.community}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '6px 16px',
              backgroundColor: config.community ? '#1976d2' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: config.community ? 'pointer' : 'not-allowed',
              fontSize: '0.875rem',
              fontWeight: 500,
              textTransform: 'uppercase',
              fontFamily: '"Roboto","Helvetica","Arial",sans-serif',
              boxShadow: '0px 3px 1px -2px rgba(0,0,0,0.2), 0px 2px 2px 0px rgba(0,0,0,0.14), 0px 1px 5px 0px rgba(0,0,0,0.12)',
              transition: 'background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms'
            }}
            onMouseOver={(e) => {
              if (config.community) {
                e.target.style.backgroundColor = '#1565c0';
              }
            }}
            onMouseOut={(e) => {
              if (config.community) {
                e.target.style.backgroundColor = '#1976d2';
              }
            }}
          >
            <PlayArrow style={{ marginRight: '8px', fontSize: '20px' }} />
            Start Installation
          </button>
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
