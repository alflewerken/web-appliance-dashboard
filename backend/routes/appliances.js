const express = require('express');
const router = express.Router();
const pool = require('../utils/database');
const QueryBuilder = require('../utils/QueryBuilder');
const { getSelectColumns } = require('../utils/dbFieldMapping');
const { verifyToken } = require('../utils/auth');
const { createAuditLog } = require('../utils/auditLogger');
const { broadcast } = require('./sse');
const { getClientIp } = require('../utils/getClientIp');
const { saveBackgroundImageToAuditLog } = require('../utils/backgroundImageHelper');
// WICHTIG: Verwende encryption.js (CBC) statt crypto.js (GCM) für Konsistenz mit Hosts!
const { encrypt, decrypt } = require('../utils/encryption');
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
router.get('/', verifyToken, async (req, res) => {
  try {
    // QueryBuilder already applies mapping via mapDbToJsForTable
    const mappedAppliances = await db.select('appliances', {}, { orderBy: 'name' });
    
    // Debug: Verify mapping from QueryBuilder
    if (mappedAppliances.length > 0) {
      const first = mappedAppliances[0];

    }
    
    // The data is already mapped by QueryBuilder, just ensure defaults
    const appliances = mappedAppliances.map(app => ({
      ...app,
      // Add defaults for potentially null/undefined fields
      description: app.description || '',
      icon: app.icon || 'Server',
      color: app.color || '#007AFF',
      category: app.category || 'productivity',
      transparency: app.transparency ?? 0.85,
      blurAmount: app.blurAmount ?? 8,
      blur: app.blurAmount ?? 8, // Alias for compatibility
      serviceStatus: app.serviceStatus || 'unknown',
    }));

    // Debug: Check specific appliance
    const debugApp = appliances.find(a => a.name === 'Nextcloud-Mac');
    if (debugApp) {

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
router.get('/:id', verifyToken, async (req, res) => {
  try {
    // QueryBuilder already applies mapping
    const appliance = await db.findOne('appliances', { id: req.params.id });

    if (!appliance) {
      return res.status(404).json({ error: 'Appliance not found' });
    }

    // Data is already mapped by QueryBuilder, just ensure defaults
    const enhancedAppliance = {
      ...appliance,
      description: appliance.description || '',
      icon: appliance.icon || 'Server',
      color: appliance.color || '#007AFF',
      transparency: appliance.transparency ?? 0.85,
      blurAmount: appliance.blurAmount ?? 8,
      blur: appliance.blurAmount ?? 8, // Alias for frontend compatibility
    };

    res.json(enhancedAppliance);
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
  // Validate required fields
  if (!req.body.name || !req.body.url) {
    return res.status(400).json({ error: 'Name and URL are required' });
  }

  // Encrypt passwords if provided
  let encryptedPassword = null;
  if (req.body.remotePassword) {
    encryptedPassword = encrypt(req.body.remotePassword);
  }
  
  let encryptedRustDeskPassword = null;
  if (req.body.rustdeskPassword) {
    encryptedRustDeskPassword = encrypt(req.body.rustdeskPassword);
  }

  try {
    // QueryBuilder handles mapping - use camelCase field names
    const result = await db.insert('appliances', {
      name: req.body.name,
      url: req.body.url,
      description: req.body.description || '',
      icon: req.body.icon || 'Server',
      color: req.body.color || '#007AFF',
      category: req.body.category || 'productivity',
      isFavorite: req.body.isFavorite || false,
      startCommand: req.body.startCommand || null,
      stopCommand: req.body.stopCommand || null,
      statusCommand: req.body.statusCommand || null,
      autoStart: req.body.autoStart || false,
      sshConnection: req.body.sshConnection || null,
      transparency: req.body.transparency ?? 0.85,
      // Accept both blur and blurAmount for compatibility
      blurAmount: req.body.blur ?? req.body.blurAmount ?? 8,
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
      rustdeskInstalled: req.body.rustdeskInstalled || false,
      rustdeskPasswordEncrypted: encryptedRustDeskPassword,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Fetch the created appliance with all fields
    const newAppliance = await db.findOne('appliances', { id: result.insertId });
    
    if (!newAppliance) {
      return res.status(500).json({ error: 'Failed to fetch created appliance' });
    }

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
      // Use the appliance data for Guacamole sync
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
    // QueryBuilder already returns data in camelCase format
    const currentAppliance = await db.findOne('appliances', { id });

    if (!currentAppliance) {
      return res.status(404).json({ error: 'Appliance not found' });
    }

    // No mapping needed - data is already in camelCase from QueryBuilder
    const originalMapped = currentAppliance;

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

    // Prepare update data from request body - only include fields that are actually sent
    const updateDataCamelCase = {
      updatedAt: new Date()
    };

    // Only update fields that are explicitly provided in the request
    if (req.body.name !== undefined) updateDataCamelCase.name = req.body.name;
    if (req.body.url !== undefined) updateDataCamelCase.url = req.body.url;
    if (req.body.description !== undefined) updateDataCamelCase.description = req.body.description;
    if (req.body.icon !== undefined) updateDataCamelCase.icon = req.body.icon;
    if (req.body.color !== undefined) updateDataCamelCase.color = req.body.color;
    if (req.body.category !== undefined) updateDataCamelCase.category = req.body.category;
    if (req.body.isFavorite !== undefined) updateDataCamelCase.isFavorite = req.body.isFavorite;
    if (req.body.startCommand !== undefined) updateDataCamelCase.startCommand = req.body.startCommand;
    if (req.body.stopCommand !== undefined) updateDataCamelCase.stopCommand = req.body.stopCommand;
    if (req.body.statusCommand !== undefined) updateDataCamelCase.statusCommand = req.body.statusCommand;
    if (req.body.autoStart !== undefined) updateDataCamelCase.autoStart = req.body.autoStart;
    if (req.body.sshConnection !== undefined) updateDataCamelCase.sshConnection = req.body.sshConnection;
    if (req.body.transparency !== undefined) updateDataCamelCase.transparency = req.body.transparency;
    // Accept both blur and blurAmount for compatibility
    if (req.body.blur !== undefined) updateDataCamelCase.blurAmount = req.body.blur;
    if (req.body.blurAmount !== undefined) updateDataCamelCase.blurAmount = req.body.blurAmount;
    if (req.body.openModeMini !== undefined) updateDataCamelCase.openModeMini = req.body.openModeMini;
    if (req.body.openModeMobile !== undefined) updateDataCamelCase.openModeMobile = req.body.openModeMobile;
    if (req.body.openModeDesktop !== undefined) updateDataCamelCase.openModeDesktop = req.body.openModeDesktop;
    if (req.body.remoteDesktopEnabled !== undefined) updateDataCamelCase.remoteDesktopEnabled = req.body.remoteDesktopEnabled;
    if (req.body.remoteDesktopType !== undefined) updateDataCamelCase.remoteDesktopType = req.body.remoteDesktopType;
    if (req.body.remoteProtocol !== undefined) updateDataCamelCase.remoteProtocol = req.body.remoteProtocol;
    if (req.body.remoteHost !== undefined) updateDataCamelCase.remoteHost = req.body.remoteHost;
    if (req.body.remotePort !== undefined) updateDataCamelCase.remotePort = req.body.remotePort;
    if (req.body.remoteUsername !== undefined) updateDataCamelCase.remoteUsername = req.body.remoteUsername;
    if (req.body.rustdeskId !== undefined) updateDataCamelCase.rustdeskId = req.body.rustdeskId;
    if (req.body.rustdeskInstalled !== undefined) updateDataCamelCase.rustdeskInstalled = req.body.rustdeskInstalled;
    
    // Handle password updates
    if (req.body.remotePassword !== undefined && req.body.remotePassword !== '') {
      updateDataCamelCase.remotePasswordEncrypted = encryptedPassword;
    }
    if (req.body.rustdeskPassword !== undefined && req.body.rustdeskPassword !== '') {
      updateDataCamelCase.rustdeskPasswordEncrypted = encryptedRustDeskPassword;
    }

    // QueryBuilder expects camelCase and handles the conversion internally
    await db.update('appliances', updateDataCamelCase, { id });

    // Fetch updated appliance
    // QueryBuilder returns data in camelCase format
    const updatedAppliance = await db.findOne('appliances', { id });

    if (!updatedAppliance) {
      return res.status(404).json({ error: 'Appliance not found' });
    }

    // Calculate changed fields - compare using camelCase
    const changedFields = {};
    const oldValues = {};

    Object.keys(updateDataCamelCase).forEach(key => {
      // Skip updatedAt and password fields
      if (key === 'updatedAt' || key.includes('Password')) return;
      
      // Use mapped original data for consistent comparison
      const oldVal = originalMapped[key];
      const newVal = updateDataCamelCase[key];

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

        changedFields[key] = newVal;
        oldValues[key] = oldVal;
      } else {

      }
    });

    // Create audit log
    if (req.user) {
      if (Object.keys(changedFields).length > 0) {

        await createAuditLog(
          req.user.id,
          'appliance_update',
          'appliances',
          id,
          {
            appliance_name: updatedAppliance.name || originalData.name,
            changes: changedFields,
            oldValues: oldValues,
            original_data: originalMapped,  // WICHTIG: Original-Daten für Revert
            fields_updated: Object.keys(changedFields),
            updated_by: req.user.username,
          },
          req.clientIp || req.ip,
          updatedAppliance.name || originalData.name  // resourceName
        );
      } else {

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
      // Guacamole helper expects snake_case format
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

    // Add blur alias for frontend compatibility  
    updatedAppliance.blur = updatedAppliance.blurAmount !== undefined ? updatedAppliance.blurAmount : 8;
    console.log('[SSE] Broadcasting updatedAppliance with blur:', updatedAppliance.blur, 'blurAmount:', updatedAppliance.blurAmount);

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
      getClientIp(req),
      appliance.name  // Add resource name
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

  console.log('[PATCH] Received updates for appliance', id, ':', updates);

  try {
    // First, get the current data for audit log
    // QueryBuilder returns data in camelCase format
    const originalData = await db.findOne('appliances', { id });

    if (!originalData) {
      return res.status(404).json({ error: 'Appliance not found' });
    }

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
    
    // Accept both blur and blurAmount for compatibility
    if (updates.blur !== undefined) {
      updateData.blurAmount = updates.blur;
      console.log('[PATCH] Setting blurAmount from blur:', updates.blur);
    }

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

    console.log('[PATCH] Final updateData to save:', updateData);

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

      } catch (error) {
        console.error('Failed to update RustDesk password:', error.message);
        // Continue with the response even if RustDesk password update fails
      }
    }

    // Fetch the updated appliance
    // QueryBuilder returns data in camelCase format
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

      Object.keys(updateData).forEach(key => {
        // Skip updatedAt and password fields in comparison
        if (key === 'updatedAt' || key.includes('Password')) return;
        
        const oldVal = originalData[key];
        const newVal = updateData[key];
        
        // Debug: Check if field exists in original data
        if (oldVal === undefined && newVal !== undefined) {

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
            original_data: originalData,  // WICHTIG: Original-Daten für Revert
            fields_updated: Object.keys(changedFields),
            updated_by: req.user.username,
          },
          getClientIp(req),
          originalData.name  // resourceName
        );
      }
    }

    // Add blur alias for frontend compatibility  
    updatedAppliance.blur = updatedAppliance.blurAmount !== undefined ? updatedAppliance.blurAmount : 8;
    console.log('[SSE] Broadcasting updatedAppliance with blur:', updatedAppliance.blur, 'blurAmount:', updatedAppliance.blurAmount);

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
    // QueryBuilder returns data in camelCase format
    const current = await db.findOne('appliances', { id: req.params.id });

    if (!current) {
      return res.status(404).json({ error: 'Appliance not found' });
    }

    // Use camelCase field name
    const newStatus = !current.isFavorite;

    await db.update(
      'appliances',
      { isFavorite: newStatus, updatedAt: new Date() },
      { id: req.params.id }
    );

    // Get updated appliance data
    // QueryBuilder returns data in camelCase format
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
          oldValues: { isFavorite: current.is_favorite },
          original_data: current,  // WICHTIG: Original-Daten für Revert
          field_updated: 'isFavorite',
          updated_by: req.user.username,
        },
        req.clientIp || req.ip,
        updatedAppliance.name  // resourceName
      );
    }

    // Add blur alias for frontend compatibility  
    updatedAppliance.blur = updatedAppliance.blurAmount !== undefined ? updatedAppliance.blurAmount : 8;
    console.log('[SSE] Broadcasting updatedAppliance with blur:', updatedAppliance.blur, 'blurAmount:', updatedAppliance.blurAmount);

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
          ...appliance,  // Spread all appliance fields directly into details
          customCommands,
          backgroundImageData,
          deleted_by: req.user.username,
        },
        req.clientIp || req.ip,
        appliance.name  // resourceName
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
