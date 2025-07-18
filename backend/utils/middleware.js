// Common middleware utilities
const fs = require('fs').promises;
const path = require('path');

// Create required directories on startup
const createRequiredDirectories = async () => {
  try {
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    const backgroundsDir = path.join(__dirname, '..', 'uploads', 'backgrounds');

    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.mkdir(backgroundsDir, { recursive: true });

    console.log('✅ Required directories created/verified');
  } catch (error) {
    console.error('❌ Error creating directories:', error);
  }
};

module.exports = {
  createRequiredDirectories,
};
