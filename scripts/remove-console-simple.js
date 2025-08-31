#!/usr/bin/env node

/**
 * Safe console.log remover - Simple version without external dependencies
 * Created: 2025-08-30 22:20:00
 * 
 * This script safely removes console statements using regex patterns
 * that handle multi-line cases properly.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  // Test mode - just count, don't modify
  testMode: process.argv.includes('--test'),
  // Verbose output
  verbose: process.argv.includes('--verbose'),
  // Target specific directory
  targetDir: process.argv.find(arg => arg.startsWith('--dir='))?.split('=')[1],
  // Target specific file
  targetFile: process.argv.find(arg => arg.endsWith('.js') && !arg.startsWith('--') && !arg.includes('remove-console')),
  // Directories to skip
  skipDirs: ['node_modules', '.git', 'build', 'dist', 'coverage', '.next', 'my-data', 'nginx/static'],
  // Files to skip
  skipFiles: ['remove-console-simple.js', 'webpack.config.js'],
  // Patterns to skip (e.g., bundle files)
  skipPatterns: [/bundle\.[a-f0-9]+\.js$/, /\.min\.js$/],
  // Show stats only
  statsOnly: process.argv.includes('--stats')
};

let stats = {
  totalFiles: 0,
  filesModified: 0,
  statementsRemoved: 0,
  fileStats: []
};

/**
 * Count console statements in a file
 */
function countConsoleStatements(content) {
  const patterns = [
    /console\s*\.\s*log\s*\(/g,
    /console\s*\.\s*debug\s*\(/g,
    /console\s*\.\s*info\s*\(/g,
    /console\s*\.\s*warn\s*\(/g,
    /console\s*\.\s*trace\s*\(/g
  ];
  
  let count = 0;
  patterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) count += matches.length;
  });
  
  return count;
}

/**
 * Remove console statements safely
 */
function removeConsoleStatements(content, filePath) {
  let modified = content;
  let removedCount = 0;
  
  // Pattern 1: Simple one-line console statements
  const simplePattern = /^\s*console\s*\.\s*(log|debug|info|warn|trace)\s*\([^;]*\);?\s*$/gm;
  const simpleMatches = modified.match(simplePattern) || [];
  modified = modified.replace(simplePattern, '');
  removedCount += simpleMatches.length;
  
  // Pattern 2: Multi-line console statements (conservative approach)
  // This handles console.log({ ... }) across multiple lines
  const multiLinePattern = /console\s*\.\s*(log|debug|info|warn|trace)\s*\([^)]*\{[^}]*\}[^)]*\)[;,]?\s*/gs;
  const multiLineMatches = modified.match(multiLinePattern) || [];
  
  multiLineMatches.forEach(match => {
    // Only remove if it's a standalone statement (starts at line beginning)
    if (/^\s*console/.test(match)) {
      modified = modified.replace(match, '');
      removedCount++;
    }
  });
  
  // Pattern 3: Console statements with template literals
  const templatePattern = /^\s*console\s*\.\s*(log|debug|info|warn|trace)\s*\(`[^`]*`\)[;,]?\s*$/gm;
  const templateMatches = modified.match(templatePattern) || [];
  modified = modified.replace(templatePattern, '');
  removedCount += templateMatches.length;
  
  // Clean up multiple empty lines (leave maximum 2)
  modified = modified.replace(/\n\s*\n\s*\n+/g, '\n\n');
  
  return { modified, removedCount };
}

/**
 * Process a single file
 */
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const originalCount = countConsoleStatements(content);
    
    if (originalCount === 0) {
      if (CONFIG.verbose) {
        console.log(`✓ ${filePath}: Already clean`);
      }
      return;
    }
    
    stats.totalFiles++;
    
    if (CONFIG.statsOnly) {
      stats.fileStats.push({ file: filePath, count: originalCount });
      return;
    }
    
    const { modified, removedCount } = removeConsoleStatements(content, filePath);
    
    if (removedCount > 0) {
      stats.filesModified++;
      stats.statementsRemoved += removedCount;
      
      if (!CONFIG.testMode) {
        // Create backup first
        const backupPath = filePath + '.backup';
        fs.writeFileSync(backupPath, content);
        
        // Write modified content
        fs.writeFileSync(filePath, modified);
        
        // Remove backup if successful
        fs.unlinkSync(backupPath);
        
        console.log(`✅ ${path.relative(process.cwd(), filePath)}: Removed ${removedCount}/${originalCount} statements`);
      } else {
        console.log(`📊 ${path.relative(process.cwd(), filePath)}: Would remove ${removedCount}/${originalCount} statements`);
      }
    }
    
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
}

/**
 * Find all JavaScript files recursively
 */
function findJsFiles(dir, fileList = []) {
  try {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        if (!CONFIG.skipDirs.includes(path.basename(filePath))) {
          findJsFiles(filePath, fileList);
        }
      } else if (file.endsWith('.js') && !CONFIG.skipFiles.includes(file)) {
        // Check if file matches any skip pattern
        const shouldSkip = CONFIG.skipPatterns.some(pattern => pattern.test(file));
        if (!shouldSkip) {
          fileList.push(filePath);
        }
      }
    });
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
  }
  
  return fileList;
}

// Main execution
console.log('🧹 Console.log Cleanup Tool (Simple Version)');
console.log('=============================================');

if (CONFIG.statsOnly) {
  console.log('Mode: STATISTICS ONLY');
} else {
  console.log(`Mode: ${CONFIG.testMode ? 'TEST (no changes)' : 'PRODUCTION (will modify files)'}`);
}
console.log('');

// Determine what to process
let targetPath;
if (CONFIG.targetFile) {
  targetPath = path.resolve(CONFIG.targetFile);
  console.log(`Processing single file: ${targetPath}`);
  processFile(targetPath);
} else {
  if (CONFIG.targetDir) {
    targetPath = path.resolve(CONFIG.targetDir);
  } else {
    targetPath = process.cwd();
  }
  
  console.log(`Scanning directory: ${targetPath}`);
  const jsFiles = findJsFiles(targetPath);
  
  console.log(`Found ${jsFiles.length} JavaScript files`);
  console.log('');
  
  if (CONFIG.statsOnly) {
    jsFiles.forEach(processFile);
    
    // Show top offenders
    console.log('\n📊 Top 10 Files with Most Console Statements:');
    console.log('================================================');
    stats.fileStats
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .forEach((stat, index) => {
        const relPath = path.relative(process.cwd(), stat.file);
        console.log(`${index + 1}. ${relPath}: ${stat.count} statements`);
      });
  } else {
    jsFiles.forEach(processFile);
  }
}

// Summary
console.log('\n📈 Summary:');
console.log('===========');
if (CONFIG.statsOnly) {
  const total = stats.fileStats.reduce((sum, s) => sum + s.count, 0);
  console.log(`Total console statements found: ${total}`);
  console.log(`Files with console statements: ${stats.fileStats.length}`);
} else {
  console.log(`Files processed: ${stats.totalFiles}`);
  console.log(`Files modified: ${stats.filesModified}`);
  console.log(`Statements removed: ${stats.statementsRemoved}`);
  
  if (CONFIG.testMode) {
    console.log('\nℹ️  This was a test run. To actually remove statements, run without --test');
  }
}
