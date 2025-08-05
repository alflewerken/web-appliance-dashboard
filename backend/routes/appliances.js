const express = require('express');
const router = express.Router();
const pool = require('../utils/database');
const {
  getSelectColumns,
  mapDbToJs,
  mapJsToDb,
  mapDbToJsWithPasswords,
} = require('../utils/dbFieldMapping');
const { verifyToken } = require('../utils/auth');
const { createAuditLog } = require('../utils/auditLogger');
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

    // Debug: Log first appliance with SSH connection
    const debugAppliance = appliances.find(a => a.ssh_connection);
    if (debugAppliance) {
      console.log('DEBUG: Raw appliance with SSH:', {
        id: debugAppliance.id,
        name: debugAppliance.name,
        ssh_connection: debugAppliance.ssh_connection,
        remote_desktop_type: debugAppliance.remote_desktop_type,
        remote_desktop_enabled: debugAppliance.remote_desktop_enabled
      });
    }

    // Map all appliances to consistent JS format
    const mappedAppliances = appliances.map(mapDbToJs);
    
    // Debug: Check mapped appliance
    const debugMapped = mappedAppliances.find(a => a.sshConnection);
    if (debugMapped) {
      console.log('DEBUG: Mapped appliance with SSH:', {
        id: debugMapped.id,
        name: debugMapped.name,
        sshConnection: debugMapped.sshConnection,
        remoteDesktopEnabled: debugMapped.remoteDesktopEnabled,
        remoteDesktopType: debugMapped.remoteDesktopType,
        remoteProtocol: debugMapped.remoteProtocol
      });
    }

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
  
  // Encrypt RustDesk password if provided
  let encryptedRustDeskPassword = null;
  if (req.body.rustdeskPassword) {
    encryptedRustDeskPassword = encrypt(req.body.rustdeskPassword);
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO appliances (
        name, url, description, icon, color, category, isFavorite,
        start_command, stop_command, status_command, auto_start, ssh_connection,
        transparency, blur_amount, open_mode_mini, open_mode_mobile, open_mode_desktop,
        remote_desktop_enabled, remote_desktop_type, remote_protocol, remote_host, remote_port, remote_username, remote_password_encrypted,
        rustdeskId, rustdesk_installed, rustdesk_password_encrypted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        dbData.remote_desktop_enabled ? 1 : 0,
        dbData.remote_desktop_type || 'guacamole',
        dbData.remote_protocol || 'vnc',
        dbData.remote_host || null,
        dbData.remote_port || null,
        dbData.remote_username || null,
        encryptedPassword,
        dbData.rustdesk_id || null,
        dbData.rustdesk_installed || 0,
        encryptedRustDeskPassword
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
          appliance_name: name,
          service: mappedAppliance,
          created_by: req.user.username,
        },
        req.clientIp || req.ip
      );
    }

    // Sync Guacamole connection if remote desktop is enabled
    if (dbData.remote_desktop_enabled) {
      // Convert JS format back to DB format for Guacamole sync
      const dbAppliance = {
        id: result.insertId,
        remote_desktop_enabled: 1,
        remote_protocol: dbData.remote_protocol,
        remote_host: dbData.remote_host,
        remote_port: dbData.remote_port,
        remote_username: dbData.remote_username,
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
    
    // Handle RustDesk password encryption
    let encryptedRustDeskPassword = currentData[0].rustdesk_password_encrypted; // Keep existing if not changed
    if (req.body.rustdeskPassword && req.body.rustdeskPassword !== '') {
      encryptedRustDeskPassword = encrypt(req.body.rustdeskPassword);
    }

    await pool.execute(
      `UPDATE appliances SET 
        name = ?, url = ?, description = ?, icon = ?, color = ?, 
        category = ?, isFavorite = ?, start_command = ?, stop_command = ?, 
        status_command = ?, auto_start = ?, ssh_connection = ?,
        transparency = ?, blur_amount = ?, open_mode_mini = ?,
        open_mode_mobile = ?, open_mode_desktop = ?,
        remote_desktop_enabled = ?, remote_desktop_type = ?, remote_protocol = ?, remote_host = ?, remote_port = ?,
        remote_username = ?, remote_password_encrypted = ?,
        rustdesk_id = ?, rustdesk_installed = ?, rustdesk_password_encrypted = ?
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
        dbData.remote_desktop_enabled ? 1 : 0,
        dbData.remote_desktop_type || 'guacamole',
        dbData.remote_protocol || 'vnc',
        dbData.remote_host || null,
        dbData.remote_port || null,
        dbData.remote_username || null,
        encryptedPassword,
        dbData.rustdesk_id || null,
        dbData.rustdesk_installed !== undefined ? dbData.rustdesk_installed : 0,
        encryptedRustDeskPassword,
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
          appliance_name: mappedAppliance.name || originalData.name,
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
        remote_desktop_enabled: dbData.remote_desktop_enabled ? 1 : 0,
        remote_protocol: dbData.remote_protocol,
        remote_host: dbData.remote_host,
        remote_port: dbData.remote_port,
        remote_username: dbData.remote_username,
        remote_password_encrypted: encryptedPassword
      };
      syncGuacamoleConnection(dbAppliance).catch(err => 
        console.error('Failed to sync Guacamole connection:', err)
      );
    }

    // Check if remote desktop fields were updated
    const remoteDesktopUpdated = 
      'remoteDesktopEnabled' in req.body ||
      'remoteProtocol' in req.body ||
      'remoteHost' in req.body ||
      'remotePort' in req.body ||
      'remoteUsername' in req.body ||
      'remotePassword' in req.body;

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
    const applianceId = req.params.id;
    
    // Get appliance details for audit log
    const [applianceRows] = await pool.execute(
      'SELECT name FROM appliances WHERE id = ?',
      [applianceId]
    );
    
    if (applianceRows.length === 0) {
      return res.status(404).json({ error: 'Appliance not found' });
    }
    
    const appliance = applianceRows[0];
    
    // Update last used timestamp
    await pool.execute(
      'UPDATE appliances SET lastUsed = CURRENT_TIMESTAMP WHERE id = ?',
      [applianceId]
    );
    
    // Create audit log entry
    await createAuditLog(
      req.user.id,
      'appliance_accessed',
      'appliances',
      applianceId,
      {
        appliance_name: appliance.name,
        access_time: new Date().toISOString(),
        method: 'web_interface'
      },
      getClientIp(req)
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
      remoteDesktopType: 'remote_desktop_type',
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
    
    // If remote password was updated and RustDesk is installed, update RustDesk password too
    if (updates.remotePassword && originalData.rustdesk_installed && originalData.rustdeskId) {
      try {
        const axios = require('axios');
        const baseURL = `http://localhost:${process.env.BACKEND_PORT || 3001}`;
        
        // Call the RustDesk password update endpoint
        await axios.put(
          `${baseURL}/api/rustdesk-install/${id}/password`,
          {},
          {
            headers: {
              'Authorization': req.headers.authorization
            }
          }
        );
        console.log('RustDesk password updated successfully for appliance', id);
      } catch (error) {
        console.error('Failed to update RustDesk password:', error.message);
        // Continue with the response even if RustDesk password update fails
      }
    }

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
          appliance_name: originalData.name,
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
          appliance_name: mappedAppliance.name,
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

// Partial update appliance (PATCH)
router.patch('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    // Get current data
    const [currentData] = await pool.execute(
      `SELECT * FROM appliances WHERE id = ?`,
      [id]
    );

    if (currentData.length === 0) {
      return res.status(404).json({ error: 'Appliance not found' });
    }

    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];

    // Handle RustDesk specific fields
    if (updates.rustdesk_installed !== undefined) {
      updateFields.push('rustdesk_installed = ?');
      updateValues.push(updates.rustdesk_installed ? 1 : 0);
    }
    if (updates.rustdeskId !== undefined) {
      updateFields.push('rustdeskId = ?');
      updateValues.push(updates.rustdeskId);
    }
    if (updates.rustdeskPassword !== undefined) {
      updateFields.push('rustdesk_password_encrypted = ?');
      const encryptedPassword = updates.rustdeskPassword ? encrypt(updates.rustdeskPassword) : null;
      updateValues.push(encryptedPassword);
    }
    if (updates.rustdesk_installation_date !== undefined) {
      updateFields.push('rustdesk_installation_date = ?');
      updateValues.push(updates.rustdesk_installation_date);
    }

    // Handle other fields that might be updated
    const mappableFields = [
      'name', 'url', 'description', 'icon', 'color', 
      'category', 'isFavorite', 'remote_desktop_type'
    ];

    mappableFields.forEach(field => {
      if (updates[field] !== undefined) {
        const dbField = mapJsToDb({ [field]: updates[field] });
        const dbFieldName = Object.keys(dbField)[0];
        if (dbFieldName) {
          updateFields.push(`${dbFieldName} = ?`);
          updateValues.push(dbField[dbFieldName]);
        }
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Add ID to values
    updateValues.push(id);

    // Execute update
    await pool.execute(
      `UPDATE appliances SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    // Get updated data
    const [updatedRows] = await pool.execute(
      `SELECT ${getSelectColumns()} FROM appliances WHERE id = ?`,
      [id]
    );

    const mappedAppliance = mapDbToJs(updatedRows[0]);

    // Create audit log
    if (req.user) {
      await createAuditLog(
        req.user.id,
        'appliance_update_partial',
        'appliances',
        id,
        {
          appliance_name: mappedAppliance.name,
          updates: updates,
          updated_by: req.user.username,
        },
        req.clientIp || req.ip
      );
    }

    // Broadcast update
    broadcast('appliance_updated', mappedAppliance);

    res.json(mappedAppliance);
  } catch (error) {
    console.error('Error updating appliance:', error);
    res.status(500).json({ error: error.message });
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

    // Use special mapping that includes passwords for audit log
    const deletedService = mapDbToJsWithPasswords(appliances[0]);

    // Save background image data if exists
    let backgroundImageData = null;
    if (deletedService.backgroundImage) {
      backgroundImageData = await saveBackgroundImageToAuditLog(deletedService.backgroundImage);
    }

    // Get custom commands for this appliance
    const [customCommands] = await pool.execute(
      `SELECT id, description, command, host_id
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
          appliance_name: deletedService.name,
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

/**
 * @swagger
 * /api/appliances/{id}/access:
 *   post:
 *     summary: Log appliance access
 *     tags: [Appliances]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The appliance ID
 *     responses:
 *       200:
 *         description: Access logged successfully
 *       404:
 *         description: Appliance not found
 */
router.post('/:id/access', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Update last accessed time
    await pool.execute(
      'UPDATE appliances SET lastUsed = NOW() WHERE id = ?',
      [id]
    );
    
    // Don't create audit log here - it's already created by the /lastUsed endpoint
    // which is called by the frontend's useAppliances hook
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error logging appliance access:', error);
    res.status(500).json({ error: 'Failed to log access' });
  }
});

module.exports = router;
