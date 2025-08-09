#!/usr/bin/env node
/**
 * Migration Tool: Convert Routes to use QueryBuilder
 * This tool helps migrate existing routes to use the consistent mapping layer
 */

const fs = require('fs').promises;
const path = require('path');

// Configuration for route migration
const routeMigrationConfig = {
  // Routes that need simple INSERT/UPDATE conversion
  simpleRoutes: [
    'settings.js',
    'commands.js',
    'background.js',
    'roles.js'
  ],
  
  // Routes that need complex migration (manual review required)
  complexRoutes: [
    'appliances.js',  // Already uses mapping, but could be simplified
    'hosts.js',       // Has complex SSH logic
    'backup.js',      // Complex restore logic
    'auth.js',        // Security-sensitive
    'sshKeys.js'      // Complex key management
  ],
  
  // Routes to skip (don't need database operations)
  skipRoutes: [
    'sse.js',
    'index.js',
    'applianceProxy.js',
    'simpleProxy.js',
    'networkProxy.js',
    'servicesProxy.js',
    'workingProxy.js',
    'nativeProxy.js',
    'browser.js',
    'streaming.js',
    'webrtc.js'
  ]
};

/**
 * Generate migration guide for a route file
 */
async function generateMigrationGuide(routePath) {
  const content = await fs.readFile(routePath, 'utf8');
  const fileName = path.basename(routePath);
  
  const guide = {
    file: fileName,
    changes: [],
    imports: [],
    warnings: []
  };
  
  // Check for direct SQL usage
  const insertMatches = content.match(/INSERT INTO\s+(\w+)/gi) || [];
  const updateMatches = content.match(/UPDATE\s+(\w+)\s+SET/gi) || [];
  const selectMatches = content.match(/SELECT\s+.+\s+FROM\s+(\w+)/gi) || [];
  const deleteMatches = content.match(/DELETE\s+FROM\s+(\w+)/gi) || [];
  
  // Add required imports
  if (insertMatches.length || updateMatches.length || selectMatches.length || deleteMatches.length) {
    guide.imports.push("const QueryBuilder = require('../utils/QueryBuilder');");
    guide.imports.push("const db = new QueryBuilder(pool);");
  }
  
  // Generate conversion suggestions
  insertMatches.forEach(match => {
    const table = match.match(/INSERT INTO\s+(\w+)/i)[1];
    guide.changes.push({
      type: 'INSERT',
      table,
      before: 'Direct SQL INSERT',
      after: `await db.insert('${table}', dataObject)`
    });
  });
  
  updateMatches.forEach(match => {
    const table = match.match(/UPDATE\s+(\w+)/i)[1];
    guide.changes.push({
      type: 'UPDATE',
      table,
      before: 'Direct SQL UPDATE',
      after: `await db.update('${table}', dataObject, whereObject)`
    });
  });
  
  selectMatches.forEach(match => {
    const table = match.match(/FROM\s+(\w+)/i)?.[1];
    if (table) {
      guide.changes.push({
        type: 'SELECT',
        table,
        before: 'Direct SQL SELECT',
        after: `await db.select('${table}', whereObject, options)`
      });
    }
  });
  
  deleteMatches.forEach(match => {
    const table = match.match(/DELETE\s+FROM\s+(\w+)/i)[1];
    guide.changes.push({
      type: 'DELETE',
      table,
      before: 'Direct SQL DELETE',
      after: `await db.delete('${table}', whereObject)`
    });
  });
  
  // Check for complex queries
  if (content.includes('JOIN')) {
    guide.warnings.push('Contains JOIN queries - may need db.raw() for complex queries');
  }
  
  if (content.includes('GROUP BY')) {
    guide.warnings.push('Contains GROUP BY - may need db.raw() for aggregations');
  }
  
  if (content.includes('transaction')) {
    guide.warnings.push('Uses transactions - ensure proper connection handling');
  }
  
  return guide;
}

/**
 * Main migration analyzer
 */
async function analyzeMigration() {
  const routesDir = path.join(__dirname, '../../routes');
  const files = await fs.readdir(routesDir);
  
  console.log('=== Route Migration Analysis ===\n');
  
  const allGuides = [];
  
  for (const file of files) {
    if (!file.endsWith('.js')) continue;
    if (routeMigrationConfig.skipRoutes.includes(file)) continue;
    
    const filePath = path.join(routesDir, file);
    const guide = await generateMigrationGuide(filePath);
    
    if (guide.changes.length > 0) {
      allGuides.push(guide);
    }
  }
  
  // Generate report
  console.log(`Found ${allGuides.length} routes that need migration:\n`);
  
  allGuides.forEach(guide => {
    console.log(`\n📁 ${guide.file}`);
    console.log(`   Changes needed: ${guide.changes.length}`);
    
    // Group by operation type
    const byType = guide.changes.reduce((acc, change) => {
      acc[change.type] = (acc[change.type] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`   - ${type}: ${count} occurrences`);
    });
    
    if (guide.warnings.length > 0) {
      console.log(`   ⚠️  Warnings:`);
      guide.warnings.forEach(warning => {
        console.log(`      - ${warning}`);
      });
    }
  });
  
  // Save detailed report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalFiles: allGuides.length,
      totalChanges: allGuides.reduce((sum, g) => sum + g.changes.length, 0)
    },
    files: allGuides
  };
  
  await fs.writeFile(
    path.join(__dirname, 'migration-report.json'),
    JSON.stringify(report, null, 2)
  );
  
  console.log('\n✅ Detailed report saved to migration-report.json');
}

// Run if called directly
if (require.main === module) {
  analyzeMigration().catch(console.error);
}

module.exports = {
  generateMigrationGuide,
  analyzeMigration
};
