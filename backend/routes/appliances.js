const express = require('express');
const router = express.Router();
const pool = require('../utils/database');
const QueryBuilder = require('../utils/QueryBuilder');
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

// Initialize QueryBuilder
const db = new QueryBuilder(pool);

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
    const appliances = await db.select('appliances', {}, { orderBy: 'name' });

    // Debug: Log first appliance with SSH connection
    const debugAppliance = appliances.find(a => a.sshConnection);
    if (debugAppliance) {
      console.log('DEBUG: Raw appliance with SSH:', {
        id: debugAppliance.id,
        name: debugAppliance.name,
        sshConnection: debugAppliance.sshConnection,
        remoteDesktopType: debugAppliance.remoteDesktopType,
        remoteDesktopEnabled: debugAppliance.remoteDesktopEnabled
      });
    }

    // Debug: Check mapped appliance
    const debugMapped = appliances.find(a => a.sshConnection);
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

    res.json(appliances);
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
    const appliance = await db.findOne('appliances', { id: req.params.id });

    if (!appliance) {
      return res.status(404).json({ error: 'Appliance not found' });
    }

    res.json(appliance);
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
    const result = await db.insert('appliances', {
      name: dbData.name,
      url: dbData.url,
      description: dbData.description || '',
      icon: dbData.icon || 'Server',
      color: dbData.color || '#007AFF',
      category: dbData.category || 'productivity',
      isFavorite: dbData.isFavorite || false,
      startCommand: dbData.start_command || null,
      stopCommand: dbData.stop_command || null,
      statusCommand: dbData.status_command || null,
      autoStart: dbData.auto_start || false,
      sshConnection: dbData.ssh_connection || null,
      transparency: dbData.transparency !== undefined ? dbData.transparency : 0.85,
      blurAmount: dbData.blur_amount !== undefined ? dbData.blur_amount : 8,
      openModeMini: dbData.open_mode_mini || 'browser_tab',
      openModeMobile: dbData.open_mode_mobile || 'browser_tab',
      openModeDesktop: dbData.open_mode_desktop || 'browser_tab',
      remoteDesktopEnabled: dbData.remote_desktop_enabled || false,
      remoteDesktopType: dbData.remote_desktop_type || 'guacamole',
      remoteProtocol: dbData.remote_protocol || 'vnc',
      remoteHost: dbData.remote_host || null,
      remotePort: dbData.remote_port || null,
      remoteUsername: dbData.remote_username || null,
      remotePasswordEncrypted: encryptedPassword,
      rustdeskId: dbData.rustdesk_id || null,
      rustdeskInstalled: dbData.rustdesk_installed || false,
      rustdeskPasswordEncrypted: encryptedRustDeskPassword,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Fetch the created appliance with all fields
    const newAppliance = await db.findOne('appliances', { id: result.insertId });

    // Create audit log
    if (req.user) {
      await createAuditLog(
        req.user.id,
        'appliance_create',
        'appliances',
        result.insertId,
        {
          appliance_name: req.body.name,
          service: newAppliance,
          created_by: req.user.username,
        },
        req.clientIp || req.ip
      );
    }

    // Sync Guacamole connection if remote desktop is enabled
    if (newAppliance.remoteDesktopEnabled) {
      // Use the appliance data directly for Guacamole sync
      const dbAppliance = {
        id: result.insertId,
        remote_desktop_enabled: 1,
        remote_protocol: newAppliance.remoteProtocol,
        remote_host: newAppliance.remoteHost,
        remote_port: newAppliance.remotePort,
        remote_username: newAppliance.remoteUsername,
        remote_password_encrypted: encryptedPassword
      };
      syncGuacamoleConnection(dbAppliance).catch(err => 
        console.error('Failed to sync Guacamole connection:', err)
      );
    }

    // Broadcast SSE events
    broadcast('appliance_created', newAppliance);
    broadcast('audit_log_created', {
      action: 'appliance_create',
      resource_type: 'appliances',
      resource_id: result.insertId,
      user: req.user?.username || 'System',
    });

    res.status(201).json(newAppliance);
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

  try {
    // Get current data for audit log
    const currentAppliance = await db.findOne('appliances', { id });

    if (!currentAppliance) {
      return res.status(404).json({ error: 'Appliance not found' });
    }

    // Map originalData to consistent format
    const originalMapped = mapDbToJs(currentAppliance, 'appliances');

    // Handle password encryption
    let encryptedPassword = currentAppliance.remotePasswordEncrypted; // Keep existing if not changed
    if (req.body.remotePassword && req.body.remotePassword !== '') {
      encryptedPassword = encrypt(req.body.remotePassword);
    }
    
    // Handle RustDesk password encryption
    let encryptedRustDeskPassword = currentAppliance.rustdeskPasswordEncrypted; // Keep existing if not changed
    if (req.body.rustdeskPassword && req.body.rustdeskPassword !== '') {
      encryptedRustDeskPassword = encrypt(req.body.rustdeskPassword);
    }

    // Prepare update data from request body
    const updateData = {
      name: req.body.name,
      url: req.body.url,
      description: req.body.description,
      icon: req.body.icon,
      color: req.body.color,
      category: req.body.category,
      isFavorite: req.body.isFavorite,
      startCommand: req.body.startCommand || null,
      stopCommand: req.body.stopCommand || null,
      statusCommand: req.body.statusCommand || null,
      autoStart: req.body.autoStart || false,
      sshConnection: req.body.sshConnection || null,
      transparency: req.body.transparency !== undefined ? req.body.transparency : 0.85,
      blurAmount: req.body.blurAmount !== undefined ? req.body.blurAmount : 8,
      openModeMini: req.body.openModeMini || 'browser_tab',
      openModeMobile: req.body.openModeMobile || 'browser_tab',
      openModeDesktop: req.body.openModeDesktop || 'browser_tab',
      remoteDesktopEnabled: req.body.remoteDesktopEnabled || false,
      remoteDesktopType: req.body.remoteDesktopType || 'guacamole',
      remoteProtocol: req.body.remoteProtocol || 'vnc',
      remoteHost: req.body.remoteHost || null,
      remotePort: req.body.remotePort || null,
      remoteUsername: req.body.remoteUsername || null,
      remotePasswordEncrypted: encryptedPassword,
      rustdeskId: req.body.rustdeskId || null,
      rustdeskInstalled: req.body.rustdeskInstalled !== undefined ? req.body.rustdeskInstalled : false,
      rustdeskPasswordEncrypted: encryptedRustDeskPassword,
      updatedAt: new Date()
    };

    await db.update('appliances', updateData, { id });

    // Fetch updated appliance
    const updatedAppliance = await db.findOne('appliances', { id });

    if (!updatedAppliance) {
      return res.status(404).json({ error: 'Appliance not found' });
    }

    // Calculate changed fields - only include fields that actually changed
    const changedFields = {};
    const oldValues = {};
    
    console.log('PUT Debug - Comparing fields for appliance', id);
    console.log('PUT Debug - updateData keys:', Object.keys(updateData));
    
    Object.keys(updateData).forEach(key => {
      // Skip updatedAt and password fields
      if (key === 'updatedAt' || key.includes('Password')) return;
      
      // Use mapped original data for consistent comparison
      const oldVal = originalMapped[key];
      const newVal = updateData[key];
      
      console.log(`PUT Debug - Field ${key}: old="${oldVal}" (${typeof oldVal}), new="${newVal}" (${typeof newVal})`);
      
      // Normalize values for comparison
      let normalizedOld = oldVal;
      let normalizedNew = newVal;
      
      // Handle null/undefined/empty string as equivalent
      if (oldVal === null || oldVal === undefined || oldVal === '') normalizedOld = '';
      if (newVal === null || newVal === undefined || newVal === '') normalizedNew = '';
      
      // Handle boolean comparisons (database returns 0/1, frontend sends true/false)
      if (typeof normalizedNew === 'boolean' || normalizedOld === 0 || normalizedOld === 1) {
        normalizedOld = Boolean(normalizedOld);
        normalizedNew = Boolean(normalizedNew);
      }
      
      // Handle number/string conversion for numeric fields
      const numericFields = ['transparency', 'blurAmount', 'remotePort'];
      if (numericFields.includes(key)) {
        // Convert both to numbers if possible, otherwise keep as string
        const oldNum = parseFloat(normalizedOld);
        const newNum = parseFloat(normalizedNew);
        if (!isNaN(oldNum) && !isNaN(newNum)) {
          normalizedOld = oldNum;
          normalizedNew = newNum;
        }
      }
      
      // Convert to string for final comparison
      const oldStr = String(normalizedOld);
      const newStr = String(normalizedNew);
      
      if (oldStr !== newStr) {
        console.log(`PUT Debug - Field ${key} CHANGED: "${oldStr}" -> "${newStr}"`);
        changedFields[key] = newVal;
        oldValues[key] = oldVal;
      } else {
        console.log(`PUT Debug - Field ${key} unchanged`);
      }
    });
    
    console.log('PUT Debug - Total changed fields:', Object.keys(changedFields).length);
    console.log('PUT Debug - Changed fields:', changedFields);

    // Create audit log
    if (req.user) {
      if (Object.keys(changedFields).length > 0) {
        console.log('PUT Debug - Creating audit log for changes:', changedFields);
        await createAuditLog(
          req.user.id,
          'appliance_update',
          'appliances',
          id,
          {
            appliance_name: updatedAppliance.name || originalData.name,
            changes: changedFields,
            oldValues: oldValues,
            fields_updated: Object.keys(changedFields),
            updated_by: req.user.username,
          },
          req.clientIp || req.ip
        );
      } else {
        console.log('PUT Debug - No changes detected, skipping audit log');
      }
    }

    // Sync Guacamole connection if remote desktop settings changed
    const remoteDesktopFieldsChanged = 
      originalMapped.remoteDesktopEnabled !== updatedAppliance.remoteDesktopEnabled ||
      originalMapped.remoteProtocol !== updatedAppliance.remoteProtocol ||
      originalMapped.remoteHost !== updatedAppliance.remoteHost ||
      originalMapped.remotePort !== updatedAppliance.remotePort ||
      originalMapped.remoteUsername !== updatedAppliance.remoteUsername ||
      req.body.remotePassword; // Password was changed

    if (remoteDesktopFieldsChanged) {
      // Convert to DB format for Guacamole sync
      const dbAppliance = {
        id: parseInt(id),
        remote_desktop_enabled: updatedAppliance.remoteDesktopEnabled ? 1 : 0,
        remote_protocol: updatedAppliance.remoteProtocol,
        remote_host: updatedAppliance.remoteHost,
        remote_port: updatedAppliance.remotePort,
        remote_username: updatedAppliance.remoteUsername,
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
      syncGuacamoleConnection(updatedAppliance).catch(err => 
        console.error('Failed to sync Guacamole connection:', err)
      );
    }

    // Broadcast the update to all connected clients
    broadcast('appliance_updated', updatedAppliance);
    broadcast('audit_log_created', {
      action: 'appliance_update',
      resource_type: 'appliances',
      resource_id: id,
      user: req.user?.username || 'System',
    });

    res.json(updatedAppliance);
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
    const appliance = await db.findOne('appliances', { id: applianceId });
    
    if (!appliance) {
      return res.status(404).json({ error: 'Appliance not found' });
    }
    
    // Update last used timestamp
    await db.update(
      'appliances',
      { lastUsed: new Date() },
      { id: applianceId }
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
    const originalDataRaw = await db.findOne('appliances', { id });

    if (!originalDataRaw) {
      return res.status(404).json({ error: 'Appliance not found' });
    }
    
    // Map to consistent format
    const originalData = mapDbToJs(originalDataRaw, 'appliances');

    // Prepare update data
    const updateData = {};

    // Handle password encryption separately
    if (updates.remotePassword && updates.remotePassword !== '') {
      updateData.remotePasswordEncrypted = encrypt(updates.remotePassword);
    }

    // Handle RustDesk password encryption
    if (updates.rustdeskPassword && updates.rustdeskPassword !== '') {
      updateData.rustdeskPasswordEncrypted = encrypt(updates.rustdeskPassword);
    }

    // Map all other fields from request body
    const fieldsToCopy = [
      'transparency', 'blurAmount', 'name', 'url', 'description', 
      'icon', 'color', 'category', // removed isFavorite - mapping layer handles it
      'startCommand', 'stopCommand', 'statusCommand', 'autoStart',
      'sshConnection', 'openModeMini', 'openModeMobile', 'openModeDesktop',
      'remoteDesktopEnabled', 'remoteDesktopType', 'remoteProtocol',
      'remoteHost', 'remotePort', 'remoteUsername', 'rustdeskId', 'rustdeskInstalled'
    ];

    fieldsToCopy.forEach(field => {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    });

    // Handle isFavorite separately - it needs field mapping
    if (updates.isFavorite !== undefined) {
      updateData.isFavorite = updates.isFavorite;
    }

    // Also support snake_case field names from legacy requests
    if (updates.blur !== undefined) updateData.blurAmount = updates.blur;
    if (updates.blur_amount !== undefined) updateData.blurAmount = updates.blur_amount;
    if (updates.open_mode_mini !== undefined) updateData.openModeMini = updates.open_mode_mini;
    if (updates.open_mode_mobile !== undefined) updateData.openModeMobile = updates.open_mode_mobile;
    if (updates.open_mode_desktop !== undefined) updateData.openModeDesktop = updates.open_mode_desktop;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Add updatedAt timestamp
    updateData.updatedAt = new Date();

    // Execute the update
    await db.update('appliances', updateData, { id });
    
    // If remote password was updated and RustDesk is installed, update RustDesk password too
    if (updates.remotePassword && originalData.rustdeskInstalled && originalData.rustdeskId) {
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
    const updatedAppliance = await db.findOne('appliances', { id });

    if (!updatedAppliance) {
      return res.status(404).json({ error: 'Appliance not found' });
    }

    // Create audit log
    if (req.user) {
      // Calculate actual changes - only include fields that really changed
      const changedFields = {};
      const oldValues = {};
      
      // Debug logging
      console.log('PATCH Debug - updateData keys:', Object.keys(updateData));
      console.log('PATCH Debug - originalData sample:', {
        color: originalData.color,
        startCommand: originalData.startCommand,
        stopCommand: originalData.stopCommand
      });
      
      Object.keys(updateData).forEach(key => {
        // Skip updatedAt and password fields in comparison
        if (key === 'updatedAt' || key.includes('Password')) return;
        
        const oldVal = originalData[key];
        const newVal = updateData[key];
        
        // Debug: Check if field exists in original data
        if (oldVal === undefined && newVal !== undefined) {
          console.log(`PATCH Debug - Field ${key} not in originalData, newVal: ${newVal}`);
        }
        
        // Normalize values for comparison
        let normalizedOld = oldVal;
        let normalizedNew = newVal;
        
        // Handle null/undefined/empty string as equivalent
        if (oldVal === null || oldVal === undefined || oldVal === '') normalizedOld = '';
        if (newVal === null || newVal === undefined || newVal === '') normalizedNew = '';
        
        // Handle boolean comparisons (database returns 0/1, frontend sends true/false)
        if (typeof normalizedNew === 'boolean' || normalizedOld === 0 || normalizedOld === 1) {
          normalizedOld = Boolean(normalizedOld);
          normalizedNew = Boolean(normalizedNew);
        }
        
        // Handle number/string conversion for numeric fields
        const numericFields = ['transparency', 'blurAmount', 'remotePort'];
        if (numericFields.includes(key)) {
          // Convert both to numbers if possible, otherwise keep as string
          const oldNum = parseFloat(normalizedOld);
          const newNum = parseFloat(normalizedNew);
          if (!isNaN(oldNum) && !isNaN(newNum)) {
            normalizedOld = oldNum;
            normalizedNew = newNum;
          }
        }
        
        // Convert to string for final comparison
        const oldStr = String(normalizedOld);
        const newStr = String(normalizedNew);
        
        // Only track if values are actually different
        if (oldStr !== newStr) {
          console.log(`PATCH Debug - Field ${key} changed: "${oldStr}" -> "${newStr}"`);
          changedFields[key] = newVal;
          oldValues[key] = oldVal;
        }
      });
      
      // Only create audit log if there were actual changes (besides updatedAt)
      if (Object.keys(changedFields).length > 0) {
        await createAuditLog(
          req.user.id,
          'appliance_update',
          'appliances',
          id,
          {
            appliance_name: originalData.name,
            changes: changedFields,
            oldValues: oldValues,
            fields_updated: Object.keys(changedFields),
            updated_by: req.user.username,
          },
          getClientIp(req)
        );
      }
    }

    // Broadcast the update to all connected clients
    broadcast('appliance_updated', updatedAppliance);
    broadcast('audit_log_created', {
      action: 'appliance_update',
      resource_type: 'appliances',
      resource_id: id,
      user: req.user?.username || 'System',
    });

    res.json(updatedAppliance);
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
    const current = await db.findOne('appliances', { id: req.params.id });

    if (!current) {
      return res.status(404).json({ error: 'Appliance not found' });
    }

    const newStatus = !current.isFavorite;

    await db.update(
      'appliances',
      { isFavorite: newStatus, updatedAt: new Date() },
      { id: req.params.id }
    );

    // Get updated appliance data
    const updatedAppliance = await db.findOne('appliances', { id: req.params.id });

    // Create audit log
    if (req.user) {
      await createAuditLog(
        req.user.id,
        'appliance_update',
        'appliances',
        req.params.id,
        {
          appliance_name: updatedAppliance.name,
          changes: { isFavorite: newStatus },
          oldValues: { isFavorite: current.isFavorite },
          field_updated: 'isFavorite',
          updated_by: req.user.username,
        },
        req.clientIp || req.ip
      );
    }

    // Broadcast the update to all connected clients
    broadcast('appliance_updated', updatedAppliance);
    broadcast('audit_log_created', {
      action: 'appliance_update',
      resource_type: 'appliances',
      resource_id: req.params.id,
      user: req.user?.username || 'System',
    });

    res.json(updatedAppliance);
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
    const appliance = await db.findOne('appliances', { id });

    if (!appliance) {
      return res.status(404).json({ error: 'Appliance not found' });
    }

    // Save background image data if exists
    let backgroundImageData = null;
    if (appliance.backgroundImage) {
      backgroundImageData = await saveBackgroundImageToAuditLog(appliance.backgroundImage);
    }

    // Get custom commands for this appliance
    const customCommands = await db.select('appliance_commands', { applianceId: id });

    const result = await db.delete('appliances', { id });

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
          appliance_name: appliance.name,
          appliance: appliance,
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
    await db.update(
      'appliances',
      { lastUsed: new Date() },
      { id }
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
