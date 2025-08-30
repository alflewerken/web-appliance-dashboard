// Background Images API routes - Using QueryBuilder
const express = require('express');
const router = express.Router();
const multer = require('multer');
// const sharp = require('sharp'); // Temporarily disabled for ARM64 compatibility
const path = require('path');
const fs = require('fs').promises;
const pool = require('../utils/database');
const QueryBuilder = require('../utils/QueryBuilder');
const { broadcast } = require('./sse');

// Initialize QueryBuilder
const db = new QueryBuilder(pool);

// Configure multer for file uploads
const storage = multer.memoryStorage(); // Store in memory for processing
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// Upload background image
router.post('/upload', upload.single('background'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const extension = path.extname(req.file.originalname) || '.jpg';
    const filename = `background_${timestamp}${extension}`;
    const filepath = path.join(
      __dirname,
      '..',
      'uploads',
      'backgrounds',
      filename
    );

    // Process image with Sharp
    let metadata;
    let processedBuffer = req.file.buffer;

    try {
      metadata = await sharp(req.file.buffer).metadata();
    } catch (sharpError) {
      return res.status(400).json({ error: 'Invalid image file format' });
    }

    // Resize image to reasonable dimensions while maintaining aspect ratio
    const maxWidth = 2560;
    const maxHeight = 1440;

    if (metadata.width > maxWidth || metadata.height > maxHeight) {
      try {
        processedBuffer = await sharp(req.file.buffer)
          .resize(maxWidth, maxHeight, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: 85 })
          .toBuffer();
      } catch (resizeError) {
        return res.status(500).json({ error: 'Failed to process image' });
      }
    }

    // Save processed image
    try {
      await fs.writeFile(filepath, processedBuffer);
    } catch (writeError) {
      return res.status(500).json({ error: 'Failed to save image' });
    }

    // Get final metadata
    let finalMetadata;
    try {
      finalMetadata = await sharp(processedBuffer).metadata();
    } catch (finalMetaError) {
      // Continue anyway with original metadata
      finalMetadata = metadata;
    }

    // Deactivate current background
    try {
      await db.update(
        'background_images', 
        { isActive: false },
        {} // Update all records
      );
    } catch (dbError) {
      console.error('Database deactivate error:', dbError);
    }

    // Insert new background into database
    try {
      const result = await db.insert('background_images', {
        filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: processedBuffer.length,
        width: finalMetadata.width,
        height: finalMetadata.height,
        isActive: true,
        createdAt: new Date()
      });

      // Enable background in settings - use proper UPDATE/INSERT logic
      const [existingEnabled] = await pool.execute(
        'SELECT id FROM user_settings WHERE user_id IS NULL AND setting_key = ?',
        ['background_enabled']
      );

      if (existingEnabled.length > 0) {
        await pool.execute(
          'UPDATE user_settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id IS NULL AND setting_key = ?',
          ['true', 'background_enabled']
        );
      } else {
        await pool.execute(
          'INSERT INTO user_settings (user_id, setting_key, setting_value) VALUES (NULL, ?, ?)',
          ['background_enabled', 'true']
        );
      }

      const responseData = {
        message: 'Background image uploaded successfully',
        background: {
          id: result.insertId,
          filename,
          url: `/uploads/backgrounds/${filename}`,
          width: finalMetadata.width,
          height: finalMetadata.height,
          size: processedBuffer.length,
        },
      };

      res.json(responseData);

      // Broadcast background upload
      broadcast('background_uploaded', responseData);
    } catch (dbInsertError) {
      console.error('Database insert error:', dbInsertError);
      // Try to cleanup file
      try {
        await fs.unlink(filepath);
      } catch (unlinkError) {
        console.error('Failed to cleanup file after DB error:', unlinkError);
      }
      return res.status(500).json({ error: 'Failed to save to database' });
    }
  } catch (error) {
    console.error('General upload error:', error);
    res
      .status(500)
      .json({ error: 'Failed to upload background image: ' + error.message });
  }
});

// Get current background image
router.get('/current', async (req, res) => {
  try {
    const backgrounds = await db.select(
      'background_images', 
      { isActive: true },
      { orderBy: 'createdAt', orderDir: 'DESC', limit: 1 }
    );

    if (backgrounds.length === 0) {
      return res.json({ background: null });
    }

    const background = backgrounds[0];
    res.json({
      background: {
        id: background.id,
        filename: background.filename,
        url: `/uploads/backgrounds/${background.filename}`,
        width: background.width,
        height: background.height,
        size: background.fileSize,
        created_at: background.createdAt,
      },
    });
  } catch (error) {
    console.error('Error fetching current background:', error);
    res.status(500).json({ error: 'Failed to fetch current background' });
  }
});

// Get all background images
router.get('/list', async (req, res) => {
  try {
    const backgrounds = await db.select(
      'background_images',
      {},
      { orderBy: 'createdAt', orderDir: 'DESC' }
    );

    const mappedBackgrounds = backgrounds.map(bg => ({
      id: bg.id,
      filename: bg.filename,
      original_name: bg.originalName,
      url: `/uploads/backgrounds/${bg.filename}`,
      width: bg.width,
      height: bg.height,
      size: bg.fileSize,
      is_active: bg.isActive,
      created_at: bg.createdAt,
    }));

    res.json({ backgrounds: mappedBackgrounds });
  } catch (error) {
    console.error('Error fetching background list:', error);
    res.status(500).json({ error: 'Failed to fetch background list' });
  }
});

// Set active background
router.post('/activate/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Deactivate all backgrounds - using raw for UPDATE without WHERE
    await db.raw('UPDATE background_images SET is_active = FALSE');

    // Activate selected background
    const result = await db.update(
      'background_images',
      { isActive: true },
      { id }
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Background image not found' });
    }

    // Enable background in settings - use proper UPDATE/INSERT logic
    const [existingEnabled] = await pool.execute(
      'SELECT id FROM user_settings WHERE user_id IS NULL AND setting_key = ?',
      ['background_enabled']
    );

    if (existingEnabled.length > 0) {
      await pool.execute(
        'UPDATE user_settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id IS NULL AND setting_key = ?',
        ['true', 'background_enabled']
      );
    } else {
      await pool.execute(
        'INSERT INTO user_settings (user_id, setting_key, setting_value) VALUES (NULL, ?, ?)',
        ['background_enabled', 'true']
      );
    }

    // Get all current background settings to send back
    const [settings] = await pool.execute(
      `SELECT setting_key, setting_value FROM user_settings 
       WHERE setting_key IN ('background_blur', 'background_opacity', 'background_position', 'background_enabled')
       AND user_id IS NULL`
    );

    // Convert to object
    const backgroundSettings = {};
    settings.forEach(row => {
      backgroundSettings[row.setting_key] = row.setting_value;
    });

    res.json({ 
      message: 'Background activated successfully',
      settings: backgroundSettings 
    });

    // Broadcast background activation with settings
    broadcast('background_activated', { 
      id: parseInt(id),
      settings: backgroundSettings 
    });
  } catch (error) {
    console.error('Error activating background:', error);
    res.status(500).json({ error: 'Failed to activate background' });
  }
});

// Delete background image
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get background info before deletion
    const background = await db.findOne('background_images', { id });

    if (!background) {
      return res.status(404).json({ error: 'Background image not found' });
    }

    // Delete file from disk
    const filepath = path.join(
      __dirname,
      '..',
      'uploads',
      'backgrounds',
      background.filename
    );
    try {
      await fs.unlink(filepath);
    } catch (fileError) {
      console.warn('Could not delete file:', filepath, fileError.message);
    }

    // Delete from database
    await db.delete('background_images', { id });

    // If this was the active background, disable background feature
    if (background.isActive) {
      const [existingEnabled] = await pool.execute(
        'SELECT id FROM user_settings WHERE user_id IS NULL AND setting_key = ?',
        ['background_enabled']
      );

      if (existingEnabled.length > 0) {
        await pool.execute(
          'UPDATE user_settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id IS NULL AND setting_key = ?',
          ['false', 'background_enabled']
        );
      } else {
        await pool.execute(
          'INSERT INTO user_settings (user_id, setting_key, setting_value) VALUES (NULL, ?, ?)',
          ['background_enabled', 'false']
        );
      }
    }

    res.json({ message: 'Background image deleted successfully' });

    // Broadcast background deletion
    broadcast('background_deleted', { id: parseInt(id) });
  } catch (error) {
    console.error('Error deleting background:', error);
    res.status(500).json({ error: 'Failed to delete background' });
  }
});

// Disable background
router.post('/disable', async (req, res) => {
  try {
    const [existingEnabled] = await pool.execute(
      'SELECT id FROM user_settings WHERE user_id IS NULL AND setting_key = ?',
      ['background_enabled']
    );

    if (existingEnabled.length > 0) {
      await pool.execute(
        'UPDATE user_settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id IS NULL AND setting_key = ?',
        ['false', 'background_enabled']
      );
    } else {
      await pool.execute(
        'INSERT INTO user_settings (user_id, setting_key, setting_value) VALUES (NULL, ?, ?)',
        ['background_enabled', 'false']
      );
    }

    res.json({ message: 'Background disabled successfully' });

    // Broadcast background disabled
    broadcast('background_disabled', {});
  } catch (error) {
    console.error('Error disabling background:', error);
    res.status(500).json({ error: 'Failed to disable background' });
  }
});

module.exports = router;
