#!/usr/bin/env node

// Script to update Swagger documentation to use camelCase endpoints
const fs = require('fs');
const path = require('path');

const replacements = {
  '/api/audit-logs': '/api/auditLogs',
  '/api/audit-restore': '/api/auditRestore',
  '/api/status-check': '/api/statusCheck'
};

function updateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  for (const [oldValue, newValue] of Object.entries(replacements)) {
    if (content.includes(oldValue)) {
      content = content.replace(new RegExp(oldValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newValue);
      modified = true;
      console.log(`Updated ${filePath}: ${oldValue} -> ${newValue}`);
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content);
  }
}

// Update all swagger files
const swaggerPath = path.join(__dirname, '../backend/swagger');
const files = fs.readdirSync(swaggerPath);

files.forEach(file => {
  const filePath = path.join(swaggerPath, file);
  const stat = fs.statSync(filePath);
  
  if (stat.isFile() && (file.endsWith('.js') || file.endsWith('.json') || file.endsWith('.md') || file.endsWith('.sh') || file.endsWith('.py'))) {
    updateFile(filePath);
  }
});

console.log('Swagger documentation updated!');
