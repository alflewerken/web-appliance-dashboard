const express = require('express');
const router = express.Router();
const pool = require('../utils/database');
const {
  getSelectColumns,
  mapDbToJs,
  mapJsToDb,
} = require('../utils/dbFieldMapping');
const { verifyToken, createAuditLog } = require('../utils/auth');
const { broadcast } = require('./sse');
const { getClientIp } = require('../utils/getClientIp');
const { saveBackgroundImageToAuditLog } = require('../utils/backgroundImageHelper');
const { encrypt, decrypt } = require('../utils/crypto');
const { syncGuacamoleConnection, deleteGuacamoleConnection } = require('../utils/guacamoleHelper');

/**
 * @swagger
 * tags:
 *   name: Appliances
 *   description: Appliance management endpoints
 */

/**
 * @swagger
 * /api/appliances:
 *   get:
 *     summary: Get all appliances
 *     tags: [Appliances]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all appliances
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Appliance'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Get all appliances
router.get('/', async (req, res) => {
  try {
    const [appliances] = await pool.execute(`
      SELECT ${getSelectColumns()}
      FROM appliances 
      ORDER BY name
    `);

    // Map all appliances to consistent JS format
    const mappedAppliances = appliances.map(mapDbToJs);

    res.json(mappedAppliances);
  } catch (error) {
    console.error('Error fetching appliances:', error);
    res.status(500).json({
      error: 'Failed to fetch appliances',
      details:
        process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * @swagger
 * /api/appliances/{id}:
 *   get:
 *     summary: Get a single appliance by ID
 *     tags: [Appliances]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The appliance ID
 *     responses:
 *       200:
 *         description: The appliance details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Appliance'
 *       404:
 *         description: Appliance not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Appliance not found
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Get single appliance
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT ${getSelectColumns()}
       FROM appliances 
       WHERE id = ?`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Appliance not found' });
    }

    const mappedAppliance = mapDbToJs(rows[0]);
    res.json(mappedAppliance);
  } catch (error) {
    console.error('Error fetching appliance:', error);
    res.status(500).json({
      error: 'Failed to fetch appliance',
      details:
        process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * @swagger
 * /api/appliances:
 *   post:
 *     summary: Create a new appliance
 *     tags: [Appliances]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - url
 *             properties:
 *               name:
 *                 type: string
 *                 description: The appliance name
 *                 example: My Server
 *               url:
 *                 type: string
 *                 description: The appliance URL
 *                 example: http://192.168.1.100:8080
 *               description:
 *                 type: string
 *                 description: The appliance description
 *               icon:
 *                 type: string
 *                 description: Icon name
 *                 example: Server
 *               color:
 *                 type: string
 *                 description: Color code
 *                 example: '#007AFF'
 *               category:
 *                 type: string
 *                 description: Category
 *                 example: productivity
 *               isFavorite:
 *                 type: boolean
 *                 description: Favorite status
 *               startCommand:
 *                 type: string
 *                 description: Start command
 *               stopCommand:
 *                 type: string
 *                 description: Stop command
 *               statusCommand:
 *                 type: string
 *                 description: Status command
 *               autoStart:
 *                 type: boolean
 *                 description: Auto-start enabled
 *               sshConnection:
 *                 type: string
 *                 description: SSH connection string
 *               transparency:
 *                 type: number
 *                 description: UI transparency
 *               blurAmount:
 *                 type: integer
 *                 description: UI blur amount
 *               remoteDesktopEnabled:
 *                 type: boolean
 *                 description: Remote desktop enabled
 *               remoteProtocol:
 *                 type: string
 *                 description: Remote protocol
 *               remoteHost:
 *                 type: string
 *                 description: Remote host
 *               remotePort:
 *                 type: integer
 *                 description: Remote port
 *               remoteUsername:
 *                 type: string
 *                 description: Remote username
 *               remotePassword:
 *                 type: string
 *                 description: Remote password
 *     responses:
 *       201:
 *         description: Appliance created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Appliance'
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Name and URL are required
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Create appliance
router.post('/', verifyToken, async (req, res) => {
  const dbData = mapJsToDb(req.body);

  // Ensure required fields
  if (!dbData.name || !dbData.url) {
    return res.status(400).json({ error: 'Name and URL are required' });
  }

  // Encrypt remote password if provided
  let encryptedPassword = null;
  if (req.body.remotePassword) {
    encryptedPassword = encrypt(req.body.remotePassword);
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO appliances (
        name, url, description, icon, color, category, isFavorite,
        start_command, stop_command, status_command, auto_start, ssh_connection,
        transparency, blur_amount, open_mode_mini, open_mode_mobile, open_mode_desktop,
        remote_desktop_enabled, remote_protocol, remote_host, remote_port, remote_username, remote_password_encrypted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dbData.name,
        dbData.url,
        dbData.description || '',
        dbData.icon || 'Server',
        dbData.color || '#007AFF',
        dbData.category || 'productivity',
        dbData.isFavorite || 0,
        dbData.start_command || null,
        dbData.stop_command || null,
        dbData.status_command || null,
        dbData.auto_start || 0,
        dbData.ssh_connection || null,
        dbData.transparency !== undefined ? dbData.transparency : 0.85,
        dbData.blur_amount !== undefined ? dbData.blur_amount : 8,
        dbData.open_mode_mini || 'browser_tab',
        dbData.open_mode_mobile || 'browser_tab',
        dbData.open_mode_desktop || 'browser_tab',
        req.body.remoteDesktopEnabled ? 1 : 0,
        req.body.remoteProtocol || 'vnc',
        req.body.remoteHost || null,
        req.body.remotePort || null,
        req.body.remoteUsername || null,
        encryptedPassword,
      ]
    );

    // Fetch the created appliance with all fields
    const [newRows] = await pool.execute(
      `SELECT ${getSelectColumns()}
       FROM appliances 
       WHERE id = ?`,
      [result.insertId]
    );

    const mappedAppliance = mapDbToJs(newRows[0]);

    // Create audit log
    if (req.user) {
      await createAuditLog(
        req.user.id,
        'appliance_create',
        'appliances',
        result.insertId,
        {
          service: mappedAppliance,
          created_by: req.user.username,
        },
        req.clientIp || req.ip
      );
    }

    // Sync Guacamole connection if remote desktop is enabled
    if (req.body.remoteDesktopEnabled) {
      // Convert JS format back to DB format for Guacamole sync
      const dbAppliance = {
        id: result.insertId,
        remote_desktop_enabled: 1,
        remote_protocol: req.body.remoteProtocol,
        remote_host: req.body.remoteHost,
        remote_port: req.body.remotePort,
        remote_username: req.body.remoteUsername,
        remote_password_encrypted: encryptedPassword
      };
      syncGuacamoleConnection(dbAppliance).catch(err => 
        console.error('Failed to sync Guacamole connection:', err)
      );
    }

    // Broadcast SSE events
    broadcast('appliance_created', mappedAppliance);
    broadcast('audit_log_created', {
      action: 'appliance_create',
      resource_type: 'appliances',
      resource_id: result.insertId,
      user: req.user?.username || 'System',
    });

    res.status(201).json(mappedAppliance);
  } catch (error) {
    console.error('Error creating appliance:', error);
    res.status(500).json({
      error: 'Failed to create appliance',
      details:
        process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Update appliance
router.put('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const dbData = mapJsToDb(req.body);

  try {
    // Get current data for audit log
    const [currentData] = await pool.execute(
      `SELECT ${getSelectColumns()}
       FROM appliances 
       WHERE id = ?`,
      [id]
    );

    if (currentData.length === 0) {
      return res.status(404).json({ error: 'Appliance not found' });
    }

    const originalData = mapDbToJs(currentData[0]);

    // Handle password encryption
    let encryptedPassword = currentData[0].remote_password_encrypted; // Keep existing if not changed
    if (req.body.remotePassword && req.body.remotePassword !== '') {
      encryptedPassword = encrypt(req.body.remotePassword);
    }

    await pool.execute(
      `UPDATE appliances SET 
        name = ?, url = ?, description = ?, icon = ?, color = ?, 
        category = ?, isFavorite = ?, start_command = ?, stop_command = ?, 
        status_command = ?, auto_start = ?, ssh_connection = ?,
        transparency = ?, blur_amount = ?, open_mode_mini = ?,
        open_mode_mobile = ?, open_mode_desktop = ?,
        remote_desktop_enabled = ?, remote_protocol = ?, remote_host = ?, remote_port = ?,
        remote_username = ?, remote_password_encrypted = ?
       WHERE id = ?`,
      [
        dbData.name,
        dbData.url,
        dbData.description,
        dbData.icon,
        dbData.color,
        dbData.category,
        dbData.isFavorite,
        dbData.start_command || null,
        dbData.stop_command || null,
        dbData.status_command || null,
        dbData.auto_start || 0,
        dbData.ssh_connection || null,
        dbData.transparency !== undefined ? dbData.transparency : 0.85,
        dbData.blur_amount !== undefined ? dbData.blur_amount : 8,
        dbData.open_mode_mini || 'browser_tab',
        dbData.open_mode_mobile || 'browser_tab',
        dbData.open_mode_desktop || 'browser_tab',
        req.body.remoteDesktopEnabled ? 1 : 0,
        req.body.remoteProtocol || 'vnc',
        req.body.remoteHost || null,
        req.body.remotePort || null,
        req.body.remoteUsername || null,
        encryptedPassword,
        id,
      ]
    );

    // Fetch updated appliance
    const [updatedRows] = await pool.execute(
      `SELECT ${getSelectColumns()}
       FROM appliances 
       WHERE id = ?`,
      [id]
    );

    if (updatedRows.length === 0) {
      return res.status(404).json({ error: 'Appliance not found' });
    }

    const mappedAppliance = mapDbToJs(updatedRows[0]);

    // Create audit log
    if (req.user) {
      await createAuditLog(
        req.user.id,
        'appliance_update',
        'appliances',
        id,
        {
          original_data: originalData,
          new_data: mappedAppliance,
          updated_by: req.user.username,
        },
        req.clientIp || req.ip
      );
    }

    // Sync Guacamole connection if remote desktop settings changed
    const remoteDesktopFieldsChanged = 
      originalData.remoteDesktopEnabled !== mappedAppliance.remoteDesktopEnabled ||
      originalData.remoteProtocol !== mappedAppliance.remoteProtocol ||
      originalData.remoteHost !== mappedAppliance.remoteHost ||
      originalData.remotePort !== mappedAppliance.remotePort ||
      originalData.remoteUsername !== mappedAppliance.remoteUsername ||
      req.body.remotePassword; // Password was changed

    if (remoteDesktopFieldsChanged) {
      // Convert to DB format for Guacamole sync
      const dbAppliance = {
        id: parseInt(id),
        remote_desktop_enabled: req.body.remoteDesktopEnabled ? 1 : 0,
        remote_protocol: req.body.remoteProtocol,
        remote_host: req.body.remoteHost,
        remote_port: req.body.remotePort,
        remote_username: req.body.remoteUsername,
        remote_password_encrypted: encryptedPassword
      };
      syncGuacamoleConnection(dbAppliance).catch(err => 
        console.error('Failed to sync Guacamole connection:', err)
      );
    }

    // Check if remote desktop fields were updated
    const remoteDesktopUpdated = 
      'remoteDesktopEnabled' in updates ||
      'remoteProtocol' in updates ||
      'remoteHost' in updates ||
      'remotePort' in updates ||
      'remoteUsername' in updates ||
      'remotePassword' in updates;

    if (remoteDesktopUpdated) {
      // Sync Guacamole connection
      syncGuacamoleConnection(updatedRows[0]).catch(err => 
        console.error('Failed to sync Guacamole connection:', err)
      );
    }

    // Broadcast the update to all connected clients
    broadcast('appliance_updated', mappedAppliance);
    broadcast('audit_log_created', {
      action: 'appliance_update',
      resource_type: 'appliances',
      resource_id: id,
      user: req.user?.username || 'System',
    });

    res.json(mappedAppliance);
  } catch (error) {
    console.error('Error updating appliance:', error);
    res.status(500).json({
      error: 'Failed to update appliance',
      details:
        process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Update last used timestamp
router.patch('/:id/lastUsed', verifyToken, async (req, res) => {
  try {
    await pool.execute(
      'UPDATE appliances SET lastUsed = CURRENT_TIMESTAMP WHERE id = ?',
      [req.params.id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating lastUsed:', error);
    res.status(500).json({
      error: 'Failed to update lastUsed',
      details:
        process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Patch route for quick updates (e.g., visual settings)
router.patch('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    // First, get the current data for audit log
    const [originalRows] = await pool.execute(
      `SELECT ${getSelectColumns()}
       FROM appliances 
       WHERE id = ?`,
      [id]
    );

    if (originalRows.length === 0) {
      return res.status(404).json({ error: 'Appliance not found' });
    }

    const originalData = originalRows[0];

    // Build dynamic UPDATE query based on provided fields
    const updateFields = [];
    const updateValues = [];
    const updateData = {}; // Store the actual updates for audit log

    // Map frontend field names to database column names
    const fieldMapping = {
      transparency: 'transparency',
      blur: 'blur_amount',
      blur_amount: 'blur_amount', // Support both field names
      name: 'name',
      url: 'url',
      description: 'description',
      icon: 'icon',
      color: 'color',
      category: 'category',
      isFavorite: 'isFavorite',
      startCommand: 'start_command',
      stopCommand: 'stop_command',
      statusCommand: 'status_command',
      autoStart: 'auto_start',
      sshConnection: 'ssh_connection',
      openModeMini: 'open_mode_mini',
      openModeMobile: 'open_mode_mobile',
      openModeDesktop: 'open_mode_desktop',
      open_mode_mini: 'open_mode_mini',
      open_mode_mobile: 'open_mode_mobile',
      open_mode_desktop: 'open_mode_desktop',
      // Remote Desktop fields
      remoteDesktopEnabled: 'remote_desktop_enabled',
      remoteProtocol: 'remote_protocol',
      remoteHost: 'remote_host',
      remotePort: 'remote_port',
      remoteUsername: 'remote_username',
    };

    // Handle password encryption separately
    if (updates.remotePassword && updates.remotePassword !== '') {
      const encryptedPassword = encrypt(updates.remotePassword);
      updateFields.push('remote_password_encrypted = ?');
      updateValues.push(encryptedPassword);
      updateData['remote_password_encrypted'] = 'encrypted'; // Don't store actual encrypted value in audit log
    }

    // Build the UPDATE query dynamically
    Object.keys(updates).forEach(key => {
      if (fieldMapping[key] !== undefined && updates[key] !== undefined) {
        // Handle boolean conversion for remote_desktop_enabled
        if (key === 'remoteDesktopEnabled') {
          updateFields.push(`${fieldMapping[key]} = ?`);
          updateValues.push(updates[key] ? 1 : 0);
          updateData[fieldMapping[key]] = updates[key] ? 1 : 0;
        } else {
          updateFields.push(`${fieldMapping[key]} = ?`);
          updateValues.push(updates[key]);
          updateData[fieldMapping[key]] = updates[key];
        }
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Add the ID to the end of values array
    updateValues.push(id);

    // Execute the update
    await pool.execute(
      `UPDATE appliances SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    // Fetch the updated appliance
    const [updatedRows] = await pool.execute(
      `SELECT ${getSelectColumns()}
       FROM appliances 
       WHERE id = ?`,
      [id]
    );

    if (updatedRows.length === 0) {
      return res.status(404).json({ error: 'Appliance not found' });
    }

    const mappedAppliance = mapDbToJs(updatedRows[0]);

    // Create audit log
    if (req.user) {
      // Create an object with only the changed original values
      const originalChangedData = {};
      Object.keys(updateData).forEach(key => {
        originalChangedData[key] = originalData[key];
      });

      await createAuditLog(
        req.user.id,
        'appliance_update',
        'appliances',
        id,
        {
          original_data: originalChangedData,
          new_data: updateData,
          fields_updated: Object.keys(updateData),
          updated_by: req.user.username,
        },
        getClientIp(req)
      );
    }

    // Broadcast the update to all connected clients
    broadcast('appliance_updated', mappedAppliance);
    broadcast('audit_log_created', {
      action: 'appliance_update',
      resource_type: 'appliances',
      resource_id: id,
      user: req.user?.username || 'System',
    });

    res.json(mappedAppliance);
  } catch (error) {
    console.error('Error patching appliance:', error);
    res.status(500).json({
      error: 'Failed to patch appliance',
      details:
        process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Toggle favorite status
router.patch('/:id/favorite', verifyToken, async (req, res) => {
  try {
    // First get current status
    const [current] = await pool.execute(
      'SELECT isFavorite FROM appliances WHERE id = ?',
      [req.params.id]
    );

    if (current.length === 0) {
      return res.status(404).json({ error: 'Appliance not found' });
    }

    const newStatus = !current[0].isFavorite;

    await pool.execute('UPDATE appliances SET isFavorite = ? WHERE id = ?', [
      newStatus ? 1 : 0,
      req.params.id,
    ]);

    // Get updated appliance data
    const [updatedRows] = await pool.execute(
      `
      SELECT ${getSelectColumns()}
      FROM appliances 
      WHERE id = ?
    `,
      [req.params.id]
    );

    const mappedAppliance = mapDbToJs(updatedRows[0]);

    // Create audit log
    if (req.user) {
      await createAuditLog(
        req.user.id,
        'appliance_update',
        'appliances',
        req.params.id,
        {
          field_updated: 'isFavorite',
          old_value: current[0].isFavorite,
          new_value: newStatus,
          updated_by: req.user.username,
        },
        req.clientIp || req.ip
      );
    }

    // Broadcast the update to all connected clients
    broadcast('appliance_updated', mappedAppliance);
    broadcast('audit_log_created', {
      action: 'appliance_update',
      resource_type: 'appliances',
      resource_id: req.params.id,
      user: req.user?.username || 'System',
    });

    res.json(mappedAppliance);
  } catch (error) {
    console.error('Error toggling favorite:', error);
    res.status(500).json({
      error: 'Failed to toggle favorite',
      details:
        process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Delete appliance
router.delete('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    // Get appliance details for audit log
    const [appliances] = await pool.execute(
      `SELECT ${getSelectColumns()}
       FROM appliances 
       WHERE id = ?`,
      [id]
    );

    if (appliances.length === 0) {
      return res.status(404).json({ error: 'Appliance not found' });
    }

    const deletedService = mapDbToJs(appliances[0]);

    // Save background image data if exists
    let backgroundImageData = null;
    if (deletedService.backgroundImage) {
      backgroundImageData = await saveBackgroundImageToAuditLog(deletedService.backgroundImage);
    }

    // Get custom commands for this appliance
    const [customCommands] = await pool.execute(
      `SELECT id, description, command, ssh_host_id
       FROM appliance_commands
       WHERE appliance_id = ?`,
      [id]
    );

    const [result] = await pool.execute('DELETE FROM appliances WHERE id = ?', [
      id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Appliance not found' });
    }

    // Create audit log with custom commands and background image
    if (req.user) {
      await createAuditLog(
        req.user.id,
        'appliance_deleted',
        'appliances',
        id,
        {
          appliance: deletedService,
          customCommands,
          backgroundImageData,
          deleted_by: req.user.username,
        },
        req.clientIp || req.ip
      );
    }

    // Delete Guacamole connection if it exists
    deleteGuacamoleConnection(parseInt(id)).catch(err => 
      console.error('Failed to delete Guacamole connection:', err)
    );

    // Broadcast the deletion
    broadcast('appliance_deleted', { id: parseInt(id) });
    broadcast('audit_log_created', {
      action: 'appliance_deleted',
      resource_type: 'appliances',
      resource_id: id,
      user: req.user?.username || 'System',
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting appliance:', error);
    res.status(500).json({
      error: 'Failed to delete appliance',
      details:
        process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

module.exports = router;
