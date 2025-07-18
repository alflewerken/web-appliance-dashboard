// Background Images API routes
const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const pool = require('../utils/database');
const { broadcast } = require('./sse');

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
      await pool.execute('UPDATE background_images SET is_active = FALSE');
    } catch (dbError) {
      console.error('Database deactivate error:', dbError);
    }

    // Insert new background into database
    try {
      const [result] = await pool.execute(
        `INSERT INTO background_images (filename, original_name, mime_type, file_size, width, height, is_active) 
         VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
        [
          filename,
          req.file.originalname,
          req.file.mimetype,
          processedBuffer.length,
          finalMetadata.width,
          finalMetadata.height,
        ]
      );

      // Enable background in settings
      await pool.execute(
        `INSERT INTO user_settings (setting_key, setting_value) 
         VALUES ('background_enabled', 'true') 
         ON DUPLICATE KEY UPDATE setting_value = 'true'`
      );

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
    const [rows] = await pool.execute(
      'SELECT * FROM background_images WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 1'
    );

    if (rows.length === 0) {
      return res.json({ background: null });
    }

    const background = rows[0];
    res.json({
      background: {
        id: background.id,
        filename: background.filename,
        url: `/uploads/backgrounds/${background.filename}`,
        width: background.width,
        height: background.height,
        size: background.file_size,
        created_at: background.created_at,
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
    const [rows] = await pool.execute(
      'SELECT * FROM background_images ORDER BY created_at DESC'
    );

    const backgrounds = rows.map(bg => ({
      id: bg.id,
      filename: bg.filename,
      original_name: bg.original_name,
      url: `/uploads/backgrounds/${bg.filename}`,
      width: bg.width,
      height: bg.height,
      size: bg.file_size,
      is_active: bg.is_active,
      created_at: bg.created_at,
    }));

    res.json({ backgrounds });
  } catch (error) {
    console.error('Error fetching background list:', error);
    res.status(500).json({ error: 'Failed to fetch background list' });
  }
});

// Set active background
router.post('/activate/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Deactivate all backgrounds
    await pool.execute('UPDATE background_images SET is_active = FALSE');

    // Activate selected background
    const [result] = await pool.execute(
      'UPDATE background_images SET is_active = TRUE WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Background image not found' });
    }

    // Enable background in settings
    await pool.execute(
      `INSERT INTO user_settings (setting_key, setting_value) 
       VALUES ('background_enabled', 'true') 
       ON DUPLICATE KEY UPDATE setting_value = 'true'`
    );

    res.json({ message: 'Background activated successfully' });

    // Broadcast background activation
    broadcast('background_activated', { id: parseInt(id) });
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
    const [rows] = await pool.execute(
      'SELECT filename, is_active FROM background_images WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Background image not found' });
    }

    const background = rows[0];

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
    await pool.execute('DELETE FROM background_images WHERE id = ?', [id]);

    // If this was the active background, disable background feature
    if (background.is_active) {
      await pool.execute(
        `INSERT INTO user_settings (setting_key, setting_value) 
         VALUES ('background_enabled', 'false') 
         ON DUPLICATE KEY UPDATE setting_value = 'false'`
      );
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
    await pool.execute(
      `INSERT INTO user_settings (setting_key, setting_value) 
       VALUES ('background_enabled', 'false') 
       ON DUPLICATE KEY UPDATE setting_value = 'false'`
    );

    res.json({ message: 'Background disabled successfully' });

    // Broadcast background disabled
    broadcast('background_disabled', {});
  } catch (error) {
    console.error('Error disabling background:', error);
    res.status(500).json({ error: 'Failed to disable background' });
  }
});

module.exports = router;
