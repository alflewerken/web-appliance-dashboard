const fs = require('fs').promises;
const path = require('path');

/**
 * Save background image content to audit log
 */
async function saveBackgroundImageToAuditLog(backgroundImagePath) {
  if (!backgroundImagePath) return null;
  
  try {
    const fullPath = path.join(__dirname, '..', 'uploads', 'backgrounds', backgroundImagePath);
    const imageData = await fs.readFile(fullPath);
    return {
      filename: backgroundImagePath,
      data: imageData.toString('base64'),
      mimeType: getMimeType(backgroundImagePath)
    };
  } catch (error) {
    console.error('Error reading background image for audit log:', error);
    return null;
  }
}

/**
 * Restore background image from audit log
 */
async function restoreBackgroundImageFromAuditLog(imageData) {
  if (!imageData || !imageData.filename || !imageData.data) return null;
  
  try {
    const uploadsDir = path.join(__dirname, '..', 'uploads', 'backgrounds');
    
    // Ensure directory exists
    await fs.mkdir(uploadsDir, { recursive: true });
    
    // Generate new filename to avoid conflicts
    const timestamp = Date.now();
    const extension = path.extname(imageData.filename);
    const newFilename = `restored_${timestamp}${extension}`;
    const fullPath = path.join(uploadsDir, newFilename);
    
    // Write image data
    const buffer = Buffer.from(imageData.data, 'base64');
    await fs.writeFile(fullPath, buffer);
    
    return newFilename;
  } catch (error) {
    console.error('Error restoring background image:', error);
    return null;
  }
}

/**
 * Get MIME type from filename
 */
function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml'
  };
  return mimeTypes[ext] || 'image/jpeg';
}

module.exports = {
  saveBackgroundImageToAuditLog,
  restoreBackgroundImageFromAuditLog
};
