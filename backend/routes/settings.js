// Settings API routes
const express = require('express');
const router = express.Router();
const pool = require('../utils/database');
const { broadcast } = require('./sse');
const { createAuditLog } = require('../utils/auth');

// Get all user settings
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT setting_key, setting_value, description FROM user_settings ORDER BY setting_key'
    );

    // Convert to key-value object for easier frontend usage
    const settings = {};
    rows.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });

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

    const [rows] = await pool.execute(
      'SELECT setting_value FROM user_settings WHERE setting_key = ?',
      [key]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    res.json({ key, value: rows[0].setting_value });
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

    // Use INSERT ... ON DUPLICATE KEY UPDATE for upsert functionality
    const [result] = await pool.execute(
      `INSERT INTO user_settings (setting_key, setting_value, description) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE 
       setting_value = VALUES(setting_value), 
       description = COALESCE(VALUES(description), description),
       updated_at = CURRENT_TIMESTAMP`,
      [key, value || '', description || null]
    );

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
        ipAddress
      );
    }

    // Broadcast setting change to all connected clients
    broadcast('setting_update', { key, value });
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

// Update multiple settings at once
router.put('/', async (req, res) => {
  try {
    const settings = req.body;

    console.log('Updating multiple settings:', settings);

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings object is required' });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      let updatedCount = 0;

      for (const [key, value] of Object.entries(settings)) {
        await connection.execute(
          `INSERT INTO user_settings (setting_key, setting_value) 
           VALUES (?, ?) 
           ON DUPLICATE KEY UPDATE 
           setting_value = VALUES(setting_value),
           updated_at = CURRENT_TIMESTAMP`,
          [key, value]
        );
        updatedCount++;
      }

      await connection.commit();

      console.log(`Updated ${updatedCount} settings successfully`);

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

    console.log('Deleting setting:', key);

    const [result] = await pool.execute(
      'DELETE FROM user_settings WHERE setting_key = ?',
      [key]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    console.log('Setting deleted successfully:', key);

    res.json({ message: 'Setting deleted successfully' });
  } catch (error) {
    console.error('Error deleting setting:', error);
    res.status(500).json({ error: 'Failed to delete setting' });
  }
});

module.exports = router;
