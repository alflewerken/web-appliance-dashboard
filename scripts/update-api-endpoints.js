#!/usr/bin/env node

// Script to update API endpoints from kebab-case to camelCase
const fs = require('fs');
const path = require('path');

const replacements = {
  '/api/audit-logs': '/api/auditLogs',
  '/api/audit-restore': '/api/auditRestore',
  '/api/ssh-keys': '/api/sshKeys',
  '/api/status-check': '/api/statusCheck',
  '/api/rustdesk-install': '/api/rustdeskInstall'
};

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  for (const [oldValue, newValue] of Object.entries(replacements)) {
    if (content.includes(oldValue)) {
      content = content.replace(new RegExp(oldValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newValue);
      modified = true;
      console.log(`  Updated ${filePath}: ${oldValue} -> ${newValue}`);
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      walkDir(filePath);
    } else if (stat.isFile() && (file.endsWith('.js') || file.endsWith('.jsx'))) {
      processFile(filePath);
    }
  }
}

console.log('Updating API endpoints in frontend...');
const frontendPath = path.join(__dirname, '../frontend/src');
walkDir(frontendPath);
console.log('API endpoint updates completed!');
