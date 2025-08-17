// Utility endpoint to fix double-encrypted passwords in the database
// This should be run if there are issues with multiple encryption layers

const express = require('express');
const router = express.Router();
const { encryptionManager, fixDoubleEncryption } = require('../utils/encryption');
const QueryBuilder = require('../utils/QueryBuilder');
const pool = require('../utils/database');

// Initialize QueryBuilder
const db = new QueryBuilder(pool);

// Fix double-encrypted passwords in appliances table
router.post('/fix-double-encryption', async (req, res) => {
  const { tables = ['appliances', 'hosts'], dryRun = true } = req.body;
  
  const results = {
    checked: 0,
    fixed: 0,
    errors: 0,
    details: []
  };
  
  try {
    // Fix appliances table
    if (tables.includes('appliances')) {
      const appliances = await db.select('appliances');
      
      for (const appliance of appliances) {
        results.checked++;
        
        // Check remote_password_encrypted
        if (appliance.remote_password_encrypted) {
          const fixed = fixDoubleEncryption(appliance.remote_password_encrypted);
          if (fixed !== appliance.remote_password_encrypted) {
            results.fixed++;
            results.details.push({
              table: 'appliances',
              id: appliance.id,
              field: 'remote_password_encrypted',
              action: dryRun ? 'would fix' : 'fixed'
            });
            
            if (!dryRun) {
              await db.update('appliances', appliance.id, {
                remote_password_encrypted: fixed
              });
            }
          }
        }
        
        // Check rustdesk_password_encrypted
        if (appliance.rustdesk_password_encrypted) {
          const fixed = fixDoubleEncryption(appliance.rustdesk_password_encrypted);
          if (fixed !== appliance.rustdesk_password_encrypted) {
            results.fixed++;
            results.details.push({
              table: 'appliances',
              id: appliance.id,
              field: 'rustdesk_password_encrypted',
              action: dryRun ? 'would fix' : 'fixed'
            });
            
            if (!dryRun) {
              await db.update('appliances', appliance.id, {
                rustdesk_password_encrypted: fixed
              });
            }
          }
        }
      }
    }
    
    // Fix hosts table
    if (tables.includes('hosts')) {
      const hosts = await db.select('hosts');
      
      for (const host of hosts) {
        results.checked++;
        
        // Check password field
        if (host.password) {
          const fixed = fixDoubleEncryption(host.password);
          if (fixed !== host.password) {
            results.fixed++;
            results.details.push({
              table: 'hosts',
              id: host.id,
              field: 'password',
              action: dryRun ? 'would fix' : 'fixed'
            });
            
            if (!dryRun) {
              await db.update('hosts', host.id, {
                password: fixed
              });
            }
          }
        }
        
        // Check remote_password field
        if (host.remote_password) {
          const fixed = fixDoubleEncryption(host.remote_password);
          if (fixed !== host.remote_password) {
            results.fixed++;
            results.details.push({
              table: 'hosts',
              id: host.id,
              field: 'remote_password',
              action: dryRun ? 'would fix' : 'fixed'
            });
            
            if (!dryRun) {
              await db.update('hosts', host.id, {
                remote_password: fixed
              });
            }
          }
        }
        
        // Check rustdesk_password field
        if (host.rustdesk_password) {
          const fixed = fixDoubleEncryption(host.rustdesk_password);
          if (fixed !== host.rustdesk_password) {
            results.fixed++;
            results.details.push({
              table: 'hosts',
              id: host.id,
              field: 'rustdesk_password',
              action: dryRun ? 'would fix' : 'fixed'
            });
            
            if (!dryRun) {
              await db.update('hosts', host.id, {
                rustdesk_password: fixed
              });
            }
          }
        }
      }
    }
    
    res.json({
      success: true,
      message: dryRun ? 'Dry run completed - no changes made' : 'Double encryption fixed',
      results
    });
    
  } catch (error) {
    console.error('Error fixing double encryption:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      results
    });
  }
});

// Check for potential double encryption issues
router.get('/check-double-encryption', async (req, res) => {
  const issues = [];
  
  try {
    // Check appliances
    const appliances = await db.select('appliances');
    for (const appliance of appliances) {
      if (appliance.remote_password_encrypted) {
        // Try to decrypt and check if result looks encrypted
        const decrypted = encryptionManager.decrypt(appliance.remote_password_encrypted);
        if (decrypted && encryptionManager.isEncrypted(decrypted)) {
          issues.push({
            table: 'appliances',
            id: appliance.id,
            field: 'remote_password_encrypted',
            name: appliance.name
          });
        }
      }
      
      if (appliance.rustdesk_password_encrypted) {
        const decrypted = encryptionManager.decrypt(appliance.rustdesk_password_encrypted);
        if (decrypted && encryptionManager.isEncrypted(decrypted)) {
          issues.push({
            table: 'appliances',
            id: appliance.id,
            field: 'rustdesk_password_encrypted',
            name: appliance.name
          });
        }
      }
    }
    
    // Check hosts
    const hosts = await db.select('hosts');
    for (const host of hosts) {
      if (host.password) {
        const decrypted = encryptionManager.decrypt(host.password);
        if (decrypted && encryptionManager.isEncrypted(decrypted)) {
          issues.push({
            table: 'hosts',
            id: host.id,
            field: 'password',
            name: host.name
          });
        }
      }
      
      if (host.remote_password) {
        const decrypted = encryptionManager.decrypt(host.remote_password);
        if (decrypted && encryptionManager.isEncrypted(decrypted)) {
          issues.push({
            table: 'hosts',
            id: host.id,
            field: 'remote_password',
            name: host.name
          });
        }
      }
      
      if (host.rustdesk_password) {
        const decrypted = encryptionManager.decrypt(host.rustdesk_password);
        if (decrypted && encryptionManager.isEncrypted(decrypted)) {
          issues.push({
            table: 'hosts',
            id: host.id,
            field: 'rustdesk_password',
            name: host.name
          });
        }
      }
    }
    
    res.json({
      success: true,
      hasIssues: issues.length > 0,
      issueCount: issues.length,
      issues,
      message: issues.length > 0 
        ? `Found ${issues.length} potential double encryption issue(s)` 
        : 'No double encryption issues detected'
    });
    
  } catch (error) {
    console.error('Error checking double encryption:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
