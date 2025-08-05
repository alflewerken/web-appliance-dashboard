#!/usr/bin/env node

// Script to update snake_case variables to camelCase in routes
const fs = require('fs');
const path = require('path');

const replacements = {
  'guacamole_performance_mode': 'guacamolePerformanceMode',
  'rustdesk_id': 'rustdeskId',
  'rustdesk_password': 'rustdeskPassword',
  'ssh_key_name': 'sshKeyName'
};

// Don't replace these patterns (they are in SQL queries or uppercase constants)
const skipPatterns = [
  /INSERT INTO/,
  /UPDATE\s+\w+\s+SET/,
  /SELECT.*FROM/,
  /WHERE/,
  /RUSTDESK_ID/,
  /RUSTDESK_PASSWORD/,
  /`[^`]+`/  // Skip anything in backticks (SQL column names)
];

function shouldSkipLine(line) {
  return skipPatterns.some(pattern => pattern.test(line));
}

function updateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let lines = content.split('\n');
  let modified = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip SQL queries and uppercase constants
    if (shouldSkipLine(line)) {
      continue;
    }
    
    // Check each replacement
    for (const [oldValue, newValue] of Object.entries(replacements)) {
      // Only replace if it's used as a JavaScript variable, not in SQL
      const jsPattern = new RegExp(`\\b${oldValue}\\b(?![\\s]*[=:]\\s*['"\`]|\\s*FROM|\\s*WHERE)`, 'g');
      
      if (jsPattern.test(line)) {
        lines[i] = line.replace(jsPattern, newValue);
        modified = true;
        console.log(`Updated ${filePath}:${i + 1} - ${oldValue} -> ${newValue}`);
      }
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, lines.join('\n'));
  }
}

// Update routes directory
const routesPath = path.join(__dirname, '../backend/routes');
const files = fs.readdirSync(routesPath);

files.forEach(file => {
  if (file.endsWith('.js')) {
    const filePath = path.join(routesPath, file);
    updateFile(filePath);
  }
});

console.log('Route variables updated!');
