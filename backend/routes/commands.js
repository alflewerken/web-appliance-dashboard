// Commands API routes - Using QueryBuilder
const express = require('express');
const router = express.Router();
const pool = require('../utils/database');
const QueryBuilder = require('../utils/QueryBuilder');
const { exec, execSync } = require('child_process');
const { verifyToken } = require('../utils/auth');
const { createAuditLog } = require('../utils/auditLogger');
const { getSSHConnection } = require('../utils/ssh');
const fs = require('fs').promises;
const path = require('path');
const { decrypt } = require('../utils/encryption');

// Initialize QueryBuilder
const db = new QueryBuilder(pool);

/**
 * Get SSH private key from database and create temporary file
 * @param {string} keyName - Name of the SSH key
 * @param {number} userId - User ID (for user-specific keys)
 * @returns {Promise<{keyPath: string, cleanup: Function}|null>}
 */
async function getSSHKeyFromDatabase(keyName, userId = null) {
  try {
    // Get SSH key from ssh_keys table
    const [sshKeys] = await pool.execute(
      `SELECT id, key_name, private_key 
       FROM ssh_keys 
       WHERE key_name = ? 
       ORDER BY (created_by = ?) DESC, id DESC
       LIMIT 1`,
      [keyName || 'dashboard', userId || 1]
    );
    
    if (!sshKeys || sshKeys.length === 0) {
      console.error(`SSH key '${keyName}' not found in database`);
      return null;
    }
    
    const sshKey = sshKeys[0];

    // Check if key is encrypted or plain text
    let privateKey;
    if (sshKey.private_key.startsWith('-----BEGIN')) {
      // Key is already in plain text
      privateKey = sshKey.private_key;
    } else {
      // Try to decrypt the key
      privateKey = decrypt(sshKey.private_key);
      if (!privateKey) {
        console.error(`Failed to decrypt SSH key '${sshKey.key_name}'`);
        return null;
      }
    }
    
    // Create temporary file for SSH key
    const tempDir = '/tmp/ssh-keys';
    await fs.mkdir(tempDir, { recursive: true, mode: 0o700 });
    
    const tempKeyPath = path.join(tempDir, `cmd_key_${keyName}_${Date.now()}`);
    await fs.writeFile(tempKeyPath, privateKey, { mode: 0o600 });
    
    return {
      keyPath: tempKeyPath,
      cleanup: async () => {
        try {
          await fs.unlink(tempKeyPath);
        } catch (error) {

        }
      }
    };
  } catch (error) {
    console.error('Error getting SSH key from database:', error);
    return null;
  }
}

// Get available hosts for SSH commands
router.get('/ssh-hosts/available', async (req, res) => {
  try {
    const hosts = await db.raw(
      `SELECT 
        id, 
        name,
        hostname, 
        username, 
        port,
        CONCAT(username, '@', hostname, ':', port) as connection_string
      FROM hosts 
      WHERE is_active = 1 
      ORDER BY name`
    );
    res.json(hosts);
  } catch (error) {
    console.error('Error fetching hosts:', error);
    res.status(500).json({ error: 'Failed to fetch hosts' });
  }
});

// Get all available commands from all services (for copying)
router.get('/available/:excludeApplianceId', async (req, res) => {
  try {
    const { excludeApplianceId } = req.params;
    const commands = await db.raw(
      `SELECT 
        ac.id,
        ac.description,
        ac.command,
        ac.host_id,
        a.name as appliance_name,
        a.id as appliance_id,
        h.name as ssh_hostname,
        CONCAT(h.username, '@', h.hostname, ':', h.port) as ssh_connection_string
      FROM appliance_commands ac
      INNER JOIN appliances a ON ac.appliance_id = a.id
      LEFT JOIN hosts h ON ac.host_id = h.id
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

// Get all commands for an appliance with host details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const commands = await db.raw(
      `SELECT 
        ac.*,
        h.name as ssh_hostname,
        h.hostname as ssh_host,
        h.username as ssh_username,
        h.port as ssh_port,
        CONCAT(h.username, '@', h.hostname, ':', h.port) as ssh_connection_string
      FROM appliance_commands ac
      LEFT JOIN hosts h ON ac.host_id = h.id
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
    const { description, command, host_id, ssh_host_id } = req.body;

    if (!description || !command) {
      return res
        .status(400)
        .json({ error: 'Description and command are required' });
    }

    // Support both host_id and ssh_host_id for backwards compatibility
    const hostId = host_id || ssh_host_id || null;

    const result = await db.insert('appliance_commands', {
      applianceId: id,
      description,
      command,
      hostId,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const newCommand = await db.raw(
      `SELECT 
        ac.*,
        h.name as ssh_hostname,
        h.hostname as ssh_host,
        h.username as ssh_username,
        h.port as ssh_port,
        CONCAT(h.username, '@', h.hostname, ':', h.port) as ssh_connection_string
      FROM appliance_commands ac
      LEFT JOIN hosts h ON ac.host_id = h.id
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
    const { description, command, host_id, ssh_host_id } = req.body;

    if (!description || !command) {
      return res
        .status(400)
        .json({ error: 'Description and command are required' });
    }

    // Support both host_id and ssh_host_id for backwards compatibility
    const hostId = host_id || ssh_host_id || null;

    await db.update(
      'appliance_commands',
      { 
        description, 
        command, 
        hostId,
        updatedAt: new Date()
      },
      { 
        id: commandId, 
        applianceId: applianceId 
      }
    );

    const updatedCommand = await db.raw(
      `SELECT 
        ac.*,
        h.name as ssh_hostname,
        h.hostname as ssh_host,
        h.username as ssh_username,
        h.port as ssh_port,
        CONCAT(h.username, '@', h.hostname, ':', h.port) as ssh_connection_string
      FROM appliance_commands ac
      LEFT JOIN hosts h ON ac.host_id = h.id
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

    const result = await db.delete('appliance_commands', {
      id: commandId,
      applianceId: applianceId
    });

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Command not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting command:', error);
    res.status(500).json({ error: 'Failed to delete command' });
  }
});

// Execute a command (keeping original logic as it's complex)
router.post('/:applianceId/:commandId/execute', async (req, res) => {

  try {
    const { applianceId, commandId } = req.params;

    // Get the command details with host info and appliance name
    const commandResult = await db.raw(
      `SELECT 
        c.*, 
        a.ssh_connection as appliance_ssh_connection,
        a.name as appliance_name,
        h.hostname as ssh_host,
        h.username as ssh_username,
        h.port as ssh_port,
        h.ssh_key_name as sshKeyName
      FROM appliance_commands c 
      JOIN appliances a ON c.appliance_id = a.id 
      LEFT JOIN hosts h ON c.host_id = h.id
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
      sshKeyName,
      appliance_ssh_connection,
    } = commandData;

    let output = '';
    const error = null;
    let sshKeyInfo = null;

    try {
      // Determine which SSH connection to use
      let sshConnection = null;
      const keyName = sshKeyName || 'dashboard'; // Use provided key name or default

      if (ssh_host_id && ssh_host) {
        // Use the command-specific SSH host
        sshConnection = {
          host: ssh_host,
          username: ssh_username,
          port: ssh_port || 22,
          keyName: keyName,
        };
      } else if (appliance_ssh_connection) {
        // Fall back to appliance SSH connection
        const [userHost, port = '22'] = appliance_ssh_connection.split(':');
        const [username, host] = userHost.split('@');
        sshConnection = {
          host,
          username,
          port,
          keyName: keyName,
        };
      }

      if (sshConnection) {
        // Get SSH key from database
        sshKeyInfo = await getSSHKeyFromDatabase(sshConnection.keyName, req.user?.id);
        
        if (!sshKeyInfo) {
          console.error(`SSH key '${sshConnection.keyName}' not found or could not be decrypted`);
          return res.status(500).json({ 
            error: 'SSH authentication failed',
            details: 'SSH key not available'
          });
        }

        // Build SSH command with proper escaping
        const escapedCommand = command.replace(/"/g, '\\"');
        // Use the temporary key file from database
        const sshCommand = `ssh -t -i ${sshKeyInfo.keyPath} -o StrictHostKeyChecking=no -o ConnectTimeout=10 -p ${sshConnection.port} ${sshConnection.username}@${sshConnection.host} "${escapedCommand}"`;

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
              ipAddress,
              commandData.description || command  // Add command name as resource name
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
          ipAddress,
          commandData.description || command  // Add command name as resource name
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
          ipAddress,
          commandData.description || command  // Add command name as resource name
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
        ipAddress,
        commandData.description || command  // Add command name as resource name
      );

      res.json({
        success: false,
        error: execError.message || 'Command execution failed',
        output: execError.stdout || '',
        executedAt: new Date().toISOString(),
      });
    } finally {
      // Cleanup temporary SSH key file
      if (sshKeyInfo && sshKeyInfo.cleanup) {
        await sshKeyInfo.cleanup();
      }
    }
  } catch (error) {
    console.error('Error executing command:', error);
    res.status(500).json({ error: 'Failed to execute command' });
  }
});

// Execute command directly (for terminal)
router.post('/execute-direct', async (req, res) => {
  try {
    const { command, applianceId } = req.body;

    if (!command || !applianceId) {
      return res
        .status(400)
        .json({ error: 'Command and applianceId are required' });
    }

    // Get appliance details
    const appliance = await db.findOne('appliances', { id: applianceId });
    if (!appliance) {
      return res.status(404).json({ error: 'Appliance not found' });
    }

    // Create audit log
    const ipAddress = req.clientIp;
    await createAuditLog(
      req.user?.id || null,
      'terminal_command_execute',
      'appliances',
      applianceId,
      {
        name: appliance.name,
        appliance_name: appliance.name,
        command,
        executed_on: appliance.sshConnection ? 'remote' : 'local',
      },
      ipAddress,
      command  // Add command as resource name
    );

    // Execute command with color support
    const env = {
      ...process.env,
      TERM: 'xterm-256color',
      FORCE_COLOR: '1',
      COLORTERM: 'truecolor',
    };

    if (appliance.sshConnection) {
      // Execute via SSH - need to find matching host
      // Parse ssh_connection format: username@hostname:port
      const connectionMatch = appliance.sshConnection.match(/^(.+)@(.+):(\d+)$/);
      if (!connectionMatch) {
        return res.json({
          success: false,
          error: 'Invalid SSH connection format',
        });
      }

      const [, username, hostname, port] = connectionMatch;
      const hosts = await db.raw(
        'SELECT * FROM hosts WHERE hostname = ? AND username = ? AND port = ?',
        [hostname, username, parseInt(port)]
      );
      const host = hosts[0];

      if (!host) {
        return res.json({
          success: false,
          error: 'Host not found for appliance',
        });
      }

      const sshConnection = await getSSHConnection(host.id);
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
