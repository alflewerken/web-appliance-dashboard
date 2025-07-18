// Category Icon Update Script
// This can be run from the backend to update emoji icons to Lucide icons

const mysql = require('mysql2/promise');

// Icon mapping from emojis to Lucide icons
const iconMapping = {
  // Productivity
  '⚡': 'Zap',
  '📊': 'BarChart',
  '📈': 'TrendingUp',
  '🏢': 'Building',
  '💼': 'Briefcase',

  // Media
  '📺': 'Tv',
  '🎬': 'Film',
  '🎵': 'Music',
  '📸': 'Camera',
  '🎮': 'Gamepad2',

  // Smart Home
  '🏠': 'Home',
  '💡': 'Lightbulb',
  '🌡️': 'Thermometer',
  '🔌': 'Plug',

  // Monitoring
  '🔔': 'Bell',
  '⚠️': 'AlertTriangle',

  // Cloud & Storage
  '☁️': 'Cloud',
  '💾': 'HardDrive',
  '📁': 'Folder',
  '🗄️': 'Archive',

  // Databases
  '🗃️': 'Database',
  '💿': 'Database',

  // Security
  '🔒': 'Lock',
  '🛡️': 'Shield',
  '🔑': 'Key',

  // Development
  '💻': 'Monitor',
  '🖥️': 'Monitor',
  '⌨️': 'Keyboard',
  '🔧': 'Wrench',
  '⚙️': 'Settings',

  // Communication
  '💬': 'MessageCircle',
  '📧': 'Mail',
  '📱': 'Smartphone',
  '☎️': 'Phone',

  // Finance
  '💰': 'DollarSign',
  '💵': 'DollarSign',
  '💶': 'Euro',
  '💳': 'CreditCard',
  '🏦': 'Building',

  // Network
  '🌐': 'Globe',
  '📡': 'Wifi',
  '🔗': 'Link',

  // AI/KI
  '🤖': 'Bot',
  '🧠': 'Brain',
  '✨': 'Sparkles',
};

// Category name to icon mapping
const categoryIconMapping = {
  finanzen: 'DollarSign',
  productivity: 'Briefcase',
  produktivität: 'Briefcase',
  'mac docker': 'Box',
  monitoring: 'Activity',
  media: 'Tv',
  medien: 'Tv',
  alf: 'Globe',
  dokumentation: 'FileText',
  ki: 'Brain',
  ai: 'Brain',
  development: 'Code',
  entwicklung: 'Code',
  communication: 'MessageCircle',
  kommunikation: 'MessageCircle',
  finance: 'DollarSign',
  'smart-home': 'Home',
  'smart home': 'Home',
  cloud: 'Cloud',
  databases: 'Database',
  datenbanken: 'Database',
  security: 'Shield',
  sicherheit: 'Shield',
};

async function updateCategoryIcons() {
  let connection;

  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'mysql',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'rootpassword',
      database: process.env.DB_NAME || 'appliance_dashboard',
    });

    console.log('Connected to database');

    // Get all categories
    const [categories] = await connection.execute(
      'SELECT id, name, icon FROM categories'
    );
    console.log(`Found ${categories.length} categories`);

    for (const category of categories) {
      let newIcon = null;

      // Check if icon is an emoji
      if (iconMapping[category.icon]) {
        newIcon = iconMapping[category.icon];
      }
      // Check by category name
      else if (categoryIconMapping[category.name.toLowerCase()]) {
        newIcon = categoryIconMapping[category.name.toLowerCase()];
      }
      // Check if icon contains non-alphanumeric characters (likely emoji)
      else if (category.icon && !/^[a-zA-Z0-9]+$/.test(category.icon)) {
        newIcon = 'Folder'; // Default fallback
      }

      if (newIcon && newIcon !== category.icon) {
        await connection.execute(
          'UPDATE categories SET icon = ? WHERE id = ?',
          [newIcon, category.id]
        );
        console.log(
          `Updated category "${category.name}": ${category.icon} → ${newIcon}`
        );
      }
    }

    console.log('Category icon update completed');
  } catch (error) {
    console.error('Error updating category icons:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Export for use in other files
module.exports = { updateCategoryIcons, iconMapping, categoryIconMapping };

// Run if called directly
if (require.main === module) {
  updateCategoryIcons();
}
