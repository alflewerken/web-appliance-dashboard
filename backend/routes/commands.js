const express = require('express');
const router = express.Router();
const db = require('../utils/database');
const { exec, execSync } = require('child_process');
const { createAuditLog, verifyToken } = require('../utils/auth');
const { getSSHConnection } = require('../utils/ssh');

// Get available SSH hosts
router.get('/ssh-hosts/available', async (req, res) => {
  try {
    const [hosts] = await db.execute(
      `SELECT 
        id, 
        hostname, 
        host, 
        username, 
        port,
        CONCAT(username, '@', host, ':', port) as connection_string
      FROM ssh_hosts 
      WHERE is_active = 1 
      ORDER BY hostname`
    );
    res.json(hosts);
  } catch (error) {
    console.error('Error fetching SSH hosts:', error);
    res.status(500).json({ error: 'Failed to fetch SSH hosts' });
  }
});

// Get all available commands from all services (for copying)
router.get('/available/:excludeApplianceId', async (req, res) => {
  try {
    const { excludeApplianceId } = req.params;
    const [commands] = await db.execute(
      `SELECT 
        ac.id,
        ac.description,
        ac.command,
        ac.ssh_host_id,
        a.name as appliance_name,
        a.id as appliance_id,
        sh.hostname as ssh_hostname,
        CONCAT(sh.username, '@', sh.host, ':', sh.port) as ssh_connection_string
      FROM appliance_commands ac
      INNER JOIN appliances a ON ac.appliance_id = a.id
      LEFT JOIN ssh_hosts sh ON ac.ssh_host_id = sh.id
      WHERE ac.appliance_id != ?
      ORDER BY a.name, ac.description`,
      [excludeApplianceId]
    );
    res.json(commands);
  } catch (error) {
    console.error('Error fetching available commands:', error);
    res.status(500).json({ error: 'Failed to fetch available commands' });
  }
});

// Get all commands for an appliance with SSH host details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [commands] = await db.execute(
      `SELECT 
        ac.*,
        sh.hostname as ssh_hostname,
        sh.host as ssh_host,
        sh.username as ssh_username,
        sh.port as ssh_port,
        CONCAT(sh.username, '@', sh.host, ':', sh.port) as ssh_connection_string
      FROM appliance_commands ac
      LEFT JOIN ssh_hosts sh ON ac.ssh_host_id = sh.id
      WHERE ac.appliance_id = ? 
      ORDER BY ac.created_at DESC`,
      [id]
    );
    res.json(commands);
  } catch (error) {
    console.error('Error fetching commands:', error);
    res.status(500).json({ error: 'Failed to fetch commands' });
  }
});

// Create a new command
router.post('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { description, command, ssh_host_id } = req.body;

    if (!description || !command) {
      return res
        .status(400)
        .json({ error: 'Description and command are required' });
    }

    const [result] = await db.execute(
      'INSERT INTO appliance_commands (appliance_id, description, command, ssh_host_id) VALUES (?, ?, ?, ?)',
      [id, description, command, ssh_host_id || null]
    );

    const [newCommand] = await db.execute(
      `SELECT 
        ac.*,
        sh.hostname as ssh_hostname,
        sh.host as ssh_host,
        sh.username as ssh_username,
        sh.port as ssh_port,
        CONCAT(sh.username, '@', sh.host, ':', sh.port) as ssh_connection_string
      FROM appliance_commands ac
      LEFT JOIN ssh_hosts sh ON ac.ssh_host_id = sh.id
      WHERE ac.id = ?`,
      [result.insertId]
    );

    res.status(201).json(newCommand[0]);
  } catch (error) {
    console.error('Error creating command:', error);
    res.status(500).json({ error: 'Failed to create command' });
  }
});

// Update a command
router.put('/:applianceId/:commandId', async (req, res) => {
  try {
    const { applianceId, commandId } = req.params;
    const { description, command, ssh_host_id } = req.body;

    if (!description || !command) {
      return res
        .status(400)
        .json({ error: 'Description and command are required' });
    }

    await db.execute(
      'UPDATE appliance_commands SET description = ?, command = ?, ssh_host_id = ? WHERE id = ? AND appliance_id = ?',
      [description, command, ssh_host_id || null, commandId, applianceId]
    );

    const [updatedCommand] = await db.execute(
      `SELECT 
        ac.*,
        sh.hostname as ssh_hostname,
        sh.host as ssh_host,
        sh.username as ssh_username,
        sh.port as ssh_port,
        CONCAT(sh.username, '@', sh.host, ':', sh.port) as ssh_connection_string
      FROM appliance_commands ac
      LEFT JOIN ssh_hosts sh ON ac.ssh_host_id = sh.id
      WHERE ac.id = ? AND ac.appliance_id = ?`,
      [commandId, applianceId]
    );

    if (updatedCommand.length === 0) {
      return res.status(404).json({ error: 'Command not found' });
    }

    res.json(updatedCommand[0]);
  } catch (error) {
    console.error('Error updating command:', error);
    res.status(500).json({ error: 'Failed to update command' });
  }
});

// Delete a command
router.delete('/:applianceId/:commandId', async (req, res) => {
  try {
    const { applianceId, commandId } = req.params;

    const [result] = await db.execute(
      'DELETE FROM appliance_commands WHERE id = ? AND appliance_id = ?',
      [commandId, applianceId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Command not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting command:', error);
    res.status(500).json({ error: 'Failed to delete command' });
  }
});

// Execute a command
router.post('/:applianceId/:commandId/execute', async (req, res) => {
  try {
    const { applianceId, commandId } = req.params;

    // Get the command details with SSH host info and appliance name
    const [commandResult] = await db.execute(
      `SELECT 
        c.*, 
        a.ssh_connection as appliance_ssh_connection,
        a.name as appliance_name,
        sh.host as ssh_host,
        sh.username as ssh_username,
        sh.port as ssh_port,
        sh.key_name as ssh_key_name
      FROM appliance_commands c 
      JOIN appliances a ON c.appliance_id = a.id 
      LEFT JOIN ssh_hosts sh ON c.ssh_host_id = sh.id
      WHERE c.id = ? AND c.appliance_id = ?`,
      [commandId, applianceId]
    );

    if (commandResult.length === 0) {
      return res.status(404).json({ error: 'Command not found' });
    }

    const commandData = commandResult[0];
    const {
      command,
      ssh_host_id,
      ssh_host,
      ssh_username,
      ssh_port,
      ssh_key_name,
      appliance_ssh_connection,
    } = commandData;

    let output = '';
    const error = null;

    try {
      // Determine which SSH connection to use
      let sshConnection = null;
      const keyName = 'dashboard'; // default key

      if (ssh_host_id && ssh_host) {
        // Use the command-specific SSH host
        sshConnection = {
          host: ssh_host,
          username: ssh_username,
          port: ssh_port || 22,
          keyName: ssh_key_name || 'dashboard',
        };
      } else if (appliance_ssh_connection) {
        // Fall back to appliance SSH connection
        const [userHost, port = '22'] = appliance_ssh_connection.split(':');
        const [username, host] = userHost.split('@');
        sshConnection = {
          host,
          username,
          port,
          keyName: 'dashboard',
        };
      }

      if (sshConnection) {
        // Build SSH command with proper escaping
        const escapedCommand = command.replace(/"/g, '\\"');
        const sshKeyPath = `~/.ssh/id_rsa_${sshConnection.keyName}`;
        // Use -t flag for pseudo-TTY to preserve colors
        const sshCommand = `ssh -t -i ${sshKeyPath} -o StrictHostKeyChecking=no -o ConnectTimeout=10 -p ${sshConnection.port} ${sshConnection.username}@${sshConnection.host} "${escapedCommand}"`;

        console.log('Executing SSH command:', sshCommand);

        const { execSync: execSyncNode } = require('child_process');
        try {
          output = execSyncNode(sshCommand, {
            encoding: 'utf8',
            timeout: 30000,
            maxBuffer: 1024 * 1024 * 10, // 10MB buffer
            env: {
              ...process.env,
              TERM: 'xterm-256color',
              FORCE_COLOR: '1',
              COLORTERM: 'truecolor',
              CLICOLOR: '1',
              CLICOLOR_FORCE: '1',
            },
          });
        } catch (execError) {
          // Even if command fails, we might have output
          output = execError.stdout || execError.message;
          if (execError.code !== 0 && execError.code !== null) {
            // Create audit log for failed command
            const ipAddress = req.clientIp;
            await createAuditLog(
              req.user?.id || null,
              'command_execute_failed',
              'appliance_command',
              commandId,
              {
                name: commandData.description,
                appliance_id: applianceId,
                appliance_name: commandData.appliance_name,
                command,
                error: execError.message,
                output,
                executed_on: `${sshConnection.username}@${sshConnection.host}:${sshConnection.port}`,
                exit_code: execError.code,
              },
              ipAddress
            );

            res.json({
              success: false,
              error: execError.message,
              output,
              executedAt: new Date().toISOString(),
              executedOn: `${sshConnection.username}@${sshConnection.host}:${sshConnection.port}`,
            });
            return;
          }
        }

        // Create audit log for successful command
        const ipAddress = req.clientIp;
        await createAuditLog(
          req.user?.id || null,
          'command_execute',
          'appliance_command',
          commandId,
          {
            name: commandData.description,
            appliance_id: applianceId,
            appliance_name: commandData.appliance_name,
            command,
            output,
            executed_on: `${sshConnection.username}@${sshConnection.host}:${sshConnection.port}`,
            output_length: output.length,
          },
          ipAddress
        );

        res.json({
          success: true,
          output,
          executedAt: new Date().toISOString(),
          executedOn: `${sshConnection.username}@${sshConnection.host}:${sshConnection.port}`,
        });
      } else {
        // Execute locally
        output = execSync(command, {
          encoding: 'utf8',
          timeout: 30000,
          env: {
            ...process.env,
            TERM: 'xterm-256color',
            FORCE_COLOR: '1',
            COLORTERM: 'truecolor',
          },
        });

        // Create audit log for successful local command
        const ipAddress = req.clientIp;
        await createAuditLog(
          req.user?.id || null,
          'command_execute',
          'appliance_command',
          commandId,
          {
            name: commandData.description,
            appliance_id: applianceId,
            appliance_name: commandData.appliance_name,
            command,
            output,
            executed_on: 'local',
            output_length: output.length,
          },
          ipAddress
        );

        res.json({
          success: true,
          output,
          executedAt: new Date().toISOString(),
          executedOn: 'local',
        });
      }
    } catch (execError) {
      console.error('Command execution error:', execError);

      // Create audit log for failed command
      const ipAddress = req.clientIp;
      await createAuditLog(
        req.user?.id || null,
        'command_execute_failed',
        'appliance_command',
        commandId,
        {
          name: commandData.description,
          appliance_id: applianceId,
          appliance_name: commandData.appliance_name,
          command,
          error: execError.message || 'Command execution failed',
          output: execError.stdout || execError.message || '',
          executed_on: sshConnection
            ? `${sshConnection.username}@${sshConnection.host}:${sshConnection.port}`
            : 'local',
        },
        ipAddress
      );

      res.json({
        success: false,
        error: execError.message || 'Command execution failed',
        output: execError.stdout || '',
        executedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Error executing command:', error);
    res.status(500).json({ error: 'Failed to execute command' });
  }
});

// Execute command directly (for terminal)
router.post('/execute-direct', verifyToken, async (req, res) => {
  try {
    const { command, applianceId } = req.body;

    if (!command || !applianceId) {
      return res
        .status(400)
        .json({ error: 'Command and applianceId are required' });
    }

    // Get appliance details
    const [appliances] = await db.execute(
      'SELECT * FROM appliances WHERE id = ?',
      [applianceId]
    );
    const appliance = appliances[0];
    if (!appliance) {
      return res.status(404).json({ error: 'Appliance not found' });
    }

    // Create audit log
    const ipAddress = req.clientIp;
    await createAuditLog(
      req.user?.id || null,
      'terminal_command_execute',
      'appliance',
      applianceId,
      {
        name: appliance.name,
        appliance_name: appliance.name,
        command,
        executed_on: appliance.ssh_connection ? 'remote' : 'local',
      },
      ipAddress
    );

    // Execute command with color support
    const env = {
      ...process.env,
      TERM: 'xterm-256color',
      FORCE_COLOR: '1',
      COLORTERM: 'truecolor',
    };

    if (appliance.ssh_connection) {
      // Execute via SSH
      const [sshHosts] = await db.execute(
        'SELECT * FROM ssh_hosts WHERE connection_string = ?',
        [appliance.ssh_connection]
      );
      const sshHost = sshHosts[0];

      if (!sshHost) {
        return res.json({
          success: false,
          error: 'SSH host not found for appliance',
        });
      }

      const sshConnection = await getSSHConnection(sshHost.id);
      const result = await sshConnection.exec(command, { env });

      res.json({
        success: true,
        output: result.stdout || result.stderr || '',
        executedAt: new Date().toISOString(),
      });
    } else {
      // Local execution
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      try {
        const { stdout, stderr } = await execAsync(command, { env });
        res.json({
          success: true,
          output: stdout || stderr || '',
          executedAt: new Date().toISOString(),
        });
      } catch (error) {
        res.json({
          success: false,
          error: error.message,
          output: error.stdout || error.stderr || '',
          executedAt: new Date().toISOString(),
        });
      }
    }
  } catch (error) {
    console.error('Error executing direct command:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute command',
    });
  }
});

module.exports = router;
