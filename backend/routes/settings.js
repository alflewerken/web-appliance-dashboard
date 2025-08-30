// Settings API routes - Using QueryBuilder
const express = require('express');
const router = express.Router();
const pool = require('../utils/database');
const QueryBuilder = require('../utils/QueryBuilder');
const { broadcast } = require('./sse');
const { createAuditLog } = require('../utils/auditLogger');
const statusChecker = require('../utils/statusChecker');

// Initialize QueryBuilder
const db = new QueryBuilder(pool);

// Get all user settings
router.get('/', async (req, res) => {
  try {
    // Get global settings (user_id = NULL) - use snake_case for database
    const rows = await db.select('user_settings', { user_id: null }, { orderBy: 'setting_key' });

    // Convert to key-value object for easier frontend usage  
    const settings = {};
    const processedKeys = new Set(); // Track processed keys to avoid duplicates
    
    rows.forEach(row => {
      // Map snake_case to camelCase
      const key = row.setting_key || row.settingKey;
      const value = row.setting_value || row.settingValue;
      
      // Only add if we haven't seen this key before (use first occurrence)
      if (!processedKeys.has(key)) {
        settings[key] = value;
        processedKeys.add(key);
      }
    });
    
    // Ensure background settings have default values if not set
    if (!settings.background_blur) {
      settings.background_blur = '5';
    }
    if (!settings.background_opacity) {
      settings.background_opacity = '0.3';
    }
    if (!settings.background_position) {
      settings.background_position = 'center center';
    }
    if (!settings.background_enabled) {
      settings.background_enabled = 'false';
    }

    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Get specific setting by key
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;

    // Get global setting (user_id = NULL) - use snake_case for database
    const setting = await db.findOne('user_settings', { 
      user_id: null,
      setting_key: key 
    });

    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    // Map snake_case to camelCase
    const value = setting.setting_value || setting.settingValue;
    res.json({ key, value });
  } catch (error) {
    console.error('Error fetching setting:', error);
    res.status(500).json({ error: 'Failed to fetch setting' });
  }
});

// Update or create setting
router.post('/', async (req, res) => {
  try {
    const { key, value, description } = req.body;

    if (!key) {
      return res.status(400).json({ error: 'Setting key is required' });
    }

    // First check if setting exists for global settings (user_id = NULL)
    const [existing] = await pool.execute(
      'SELECT id FROM user_settings WHERE user_id IS NULL AND setting_key = ?',
      [key]
    );

    if (existing.length > 0) {
      // Update existing setting
      await pool.execute(
        `UPDATE user_settings 
         SET setting_value = ?, 
             description = COALESCE(?, description),
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id IS NULL AND setting_key = ?`,
        [value || '', description || null, key]
      );
    } else {
      // Insert new setting
      await pool.execute(
        `INSERT INTO user_settings (user_id, setting_key, setting_value, description) 
         VALUES (NULL, ?, ?, ?)`,
        [key, value || '', description || null]
      );
    }

    res.json({
      message: 'Setting updated successfully',
      key,
      value,
    });

    // Create audit log - skip background-related settings
    const backgroundSettingKeys = [
      'background_enabled',
      'background_opacity',
      'background_blur',
      'background_position',
    ];
    if (!backgroundSettingKeys.includes(key)) {
      const ipAddress = req.clientIp;
      await createAuditLog(
        req.user?.id || null,
        'settings_update',
        'settings',
        null,
        {
          key,
          value,
          description,
          updated_by: req.user?.username || 'unknown',
        },
        ipAddress,
        key  // Add setting key as resource name
      );
    }

    // Broadcast setting change to all connected clients
    broadcast('setting_update', { key, value });
    
    // Check if service interval was updated and reload statusChecker if needed
    if (key === 'service_status_refresh_interval' || key === 'service_poll_interval') {

      await statusChecker.reloadSettings();
    }
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

// Update multiple settings at once
router.put('/', async (req, res) => {
  try {
    const settings = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings object is required' });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      let updatedCount = 0;

      for (const [key, value] of Object.entries(settings)) {
        // Check if setting exists
        const [existing] = await connection.execute(
          'SELECT id FROM user_settings WHERE user_id IS NULL AND setting_key = ?',
          [key]
        );

        if (existing.length > 0) {
          // Update existing
          await connection.execute(
            `UPDATE user_settings 
             SET setting_value = ?, updated_at = CURRENT_TIMESTAMP
             WHERE user_id IS NULL AND setting_key = ?`,
            [value, key]
          );
        } else {
          // Insert new
          await connection.execute(
            `INSERT INTO user_settings (user_id, setting_key, setting_value) 
             VALUES (NULL, ?, ?)`,
            [key, value]
          );
        }
        updatedCount++;
      }

      await connection.commit();

      res.json({
        message: `${updatedCount} settings updated successfully`,
        updated_count: updatedCount,
      });

      // Create audit log for bulk updates - skip background-related settings
      const backgroundSettingKeys = [
        'background_enabled',
        'background_opacity',
        'background_blur',
        'background_position',
      ];
      const nonBackgroundSettings = {};

      for (const [key, value] of Object.entries(settings)) {
        if (!backgroundSettingKeys.includes(key)) {
          nonBackgroundSettings[key] = value;
        }
      }

      if (Object.keys(nonBackgroundSettings).length > 0) {
        const ipAddress = req.clientIp;
        await createAuditLog(
          req.user?.id || null,
          'settings_bulk_update',
          'settings',
          null,
          {
            settings: nonBackgroundSettings,
            updated_count: Object.keys(nonBackgroundSettings).length,
            updated_by: req.user?.username || 'unknown',
          },
          ipAddress
        );
      }

      // Broadcast all settings updates
      broadcast('settings_bulk_update', settings);
      
      // Check if service interval was updated and reload statusChecker if needed
      if (settings['service_status_refresh_interval'] || settings['service_poll_interval']) {

        await statusChecker.reloadSettings();
      }
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error updating multiple settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Delete setting
router.delete('/:key', async (req, res) => {
  try {
    const { key } = req.params;

    const result = await db.delete('user_settings', { settingKey: key });

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    res.json({ message: 'Setting deleted successfully' });
  } catch (error) {
    console.error('Error deleting setting:', error);
    res.status(500).json({ error: 'Failed to delete setting' });
  }
});

module.exports = router;
