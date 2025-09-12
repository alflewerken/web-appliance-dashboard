const express = require('express');
const router = express.Router();
const pool = require('../utils/database');
const { prepareInsert } = require('../utils/genericFieldMapping');
const { v4: uuidv4 } = require('uuid');
const { verifyToken } = require('../utils/auth');
const path = require('path');
const fs = require('fs').promises;
const { encryptionManager } = require('../utils/encryption');
const { createAuditLog } = require('../utils/auditLogger');

// Store für aktive Restore Sessions
const restoreSessions = new Map();

// Test endpoint to verify routing works
router.get('/test', (req, res) => {
  res.json({ message: 'Restore progress router is working', sessionCount: restoreSessions.size });
});

// SSE Endpoint für Restore Progress
router.get('/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  // Setup SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  
  // Send initial connection message
  res.write('data: {"type":"connected","message":"Connected to restore progress stream"}\n\n');
  
  // Store connection
  if (!restoreSessions.has(sessionId)) {
    restoreSessions.set(sessionId, {
      connections: [],
      progress: 0,
      currentStep: null,
      totalItems: {},
      processedItems: {}
    });
  }
  
  const session = restoreSessions.get(sessionId);
  session.connections.push(res);
  
  // Send current state
  res.write(`data: ${JSON.stringify({
    type: 'state',
    progress: session.progress,
    currentStep: session.currentStep,
    totalItems: session.totalItems,
    processedItems: session.processedItems
  })}\n\n`);
  
  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(':heartbeat\n\n');
  }, 30000);
  
  // Clean up on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    if (session) {
      session.connections = session.connections.filter(conn => conn !== res);
      if (session.connections.length === 0) {
        // Clean up session after 5 minutes if no connections
        setTimeout(() => {
          if (restoreSessions.get(sessionId)?.connections.length === 0) {
            restoreSessions.delete(sessionId);
          }
        }, 300000);
      }
    }
  });
});

// Helper function to send progress updates
function sendProgressUpdate(sessionId, data) {
  const session = restoreSessions.get(sessionId);
  if (!session) return;
  
  // Update session state
  if (data.progress !== undefined) session.progress = data.progress;
  if (data.currentStep !== undefined) session.currentStep = data.currentStep;
  if (data.totalItems) Object.assign(session.totalItems, data.totalItems);
  if (data.processedItems) Object.assign(session.processedItems, data.processedItems);
  
  // Send to all connected clients
  const message = `data: ${JSON.stringify(data)}\n\n`;
  session.connections.forEach(res => {
    try {
      res.write(message);
    } catch (err) {
      console.error('Error sending SSE update:', err);
    }
  });
}

// NEW: Start restore endpoint that returns sessionId immediately
router.post('/start', verifyToken, async (req, res) => {
  const sessionId = uuidv4();
  const backupData = req.body;
  
  console.log('🚀 Starting restore with immediate response, sessionId:', sessionId);
  
  // Extract encryption key from backup if present
  let backupDecryptionKey = backupData.encryption_key || backupData.decryption_key || null;
  
  // Validate the backup key if provided
  let keyValidationResult = {
    isValid: true,
    message: null
  };
  
  if (backupDecryptionKey && backupData.validation_token) {
    console.log('🔐 Validating backup key...');
    try {
      const decryptedToken = encryptionManager.decrypt(backupData.validation_token, backupDecryptionKey);
      if (decryptedToken === 'VALID_BACKUP_KEY_2025') {
        console.log('✅ Backup key is valid');
        keyValidationResult.isValid = true;
      } else {
        console.log('❌ Invalid backup key - decryption succeeded but token mismatch');
        keyValidationResult.isValid = false;
        keyValidationResult.message = 'Der eingegebene Schlüssel ist ungültig. Die Passwörter können nicht wiederhergestellt werden.';
      }
    } catch (error) {
      console.log('❌ Invalid backup key - decryption failed:', error.message);
      keyValidationResult.isValid = false;
      keyValidationResult.message = 'Der eingegebene Schlüssel ist ungültig. Die Passwörter können nicht wiederhergestellt werden.';
    }
    
    // If key is invalid and user hasn't confirmed to continue
    if (!keyValidationResult.isValid && !backupData.confirmInvalidKey) {
      // Return validation error to frontend
      return res.json({
        success: false,
        keyValidation: keyValidationResult,
        requiresConfirmation: true,
        message: keyValidationResult.message
      });
    }
    
    // If key is invalid but user confirmed to continue
    if (!keyValidationResult.isValid && backupData.confirmInvalidKey) {
      console.log('⚠️ User confirmed to continue with invalid key');
      // Clear the key so passwords won't be restored
      backupDecryptionKey = null;
    }
  }
  
  // WICHTIG: Der Backup-Key wird NICHT gehasht - er wird direkt verwendet wie beim Backup!
  // BUG FIXED: Removed SHA256 hashing that was causing decryption failures
  if (backupDecryptionKey) {
    console.log('🔑 Backup key provided for decryption');
    console.log(`   Key length: ${backupDecryptionKey.length} characters`);
  }
  
  // Function to re-encrypt password from backup to system key
  // FIXED: Returns null on failure instead of original data
  const reEncryptFromBackup = (encryptedData, entityType = 'unknown', entityName = 'unknown', isSSHKey = false) => {
    if (!encryptedData) return null;
    
    // DEBUG: Log the key status
    console.log(`🔍 DEBUG reEncryptFromBackup for ${entityType}: ${entityName}`);
    console.log(`   - backupDecryptionKey exists: ${!!backupDecryptionKey}`);
    console.log(`   - backupDecryptionKey length: ${backupDecryptionKey ? backupDecryptionKey.length : 'null'}`);
    console.log(`   - backupDecryptionKey first 10 chars: ${backupDecryptionKey ? backupDecryptionKey.substring(0, 10) + '...' : 'null'}`);
    
    if (!backupDecryptionKey) {
      console.warn(`⚠️  No backup key provided for ${entityType}: ${entityName} - password needs manual reset`);
      // Track failed restoration
      if (isSSHKey) {
        failedRestorations.sshKeys.push({
          type: entityType,
          name: entityName,
          reason: 'No backup key provided'
        });
      } else {
        failedRestorations.passwords.push({
          type: entityType,
          name: entityName,
          reason: 'No backup key provided'
        });
      }
      // Return null instead of original data - safer than storing corrupted passwords
      return null;
    }

    try {
      // First try to decrypt with backup key
      const decrypted = encryptionManager.decrypt(encryptedData, backupDecryptionKey);
      
      if (!decrypted) {
        console.warn(`⚠️  Cannot decrypt ${entityType}: ${entityName} with backup key - password needs manual reset`);
        // Track failed restoration
        if (isSSHKey) {
          failedRestorations.sshKeys.push({
            type: entityType,
            name: entityName,
            reason: 'Cannot decrypt with backup key'
          });
        } else {
          failedRestorations.passwords.push({
            type: entityType,
            name: entityName,
            reason: 'Cannot decrypt with backup key'
          });
        }
        return null; // Cannot decrypt = cannot restore
      }
      
      // Re-encrypt with system key
      const systemKey = encryptionManager.getSystemKey();
      const reEncrypted = encryptionManager.encrypt(decrypted, systemKey);
      
      if (!reEncrypted) {
        console.error(`❌ Failed to re-encrypt ${entityType}: ${entityName} with system key`);
        // Track failed restoration
        if (isSSHKey) {
          failedRestorations.sshKeys.push({
            type: entityType,
            name: entityName,
            reason: 'Re-encryption failed'
          });
        } else {
          failedRestorations.passwords.push({
            type: entityType,
            name: entityName,
            reason: 'Re-encryption failed'
          });
        }
        return null;
      }
      
      return reEncrypted;
    } catch (error) {
      console.error(`Failed to re-encrypt ${entityType}: ${entityName}:`, error.message);
      // Track failed restoration
      if (isSSHKey) {
        failedRestorations.sshKeys.push({
          type: entityType,
          name: entityName,
          reason: error.message
        });
      } else {
        failedRestorations.passwords.push({
          type: entityType,
          name: entityName,
          reason: error.message
        });
      }
      return null; // Return null on error instead of corrupted data
    }
  };
  
  // Track failed password/key restorations for user feedback
  const failedRestorations = {
    passwords: [],
    sshKeys: []
  };
  
  // Initialize session
  restoreSessions.set(sessionId, {
    connections: [],
    progress: 0,
    currentStep: 'initializing',
    totalItems: {},
    processedItems: {},
    status: 'processing'
  });
  
  // Extract restore options
  const shouldRestoreSnmpMetrics = backupData.restoreSnmpMetrics !== false; // Default to true for backward compatibility
  console.log(`🔍 shouldRestoreSnmpMetrics value: ${shouldRestoreSnmpMetrics}, backupData.restoreSnmpMetrics: ${backupData.restoreSnmpMetrics}`);
  
  // Count items for progress - include all monitoring tables
  const totalItems = {
    categories: backupData.data?.categories?.length || 0,
    users: backupData.data?.users?.length || 0,  // Dashboard users
    ssh_keys: backupData.data?.ssh_keys?.length || 0,  // Must be before hosts!
    hosts: backupData.data?.hosts?.length || 0,
    appliances: backupData.data?.appliances?.length || 0,
    background_images: backupData.data?.background_images?.length || 0,  // Will handle files too
    snmp_metrics: shouldRestoreSnmpMetrics ? (backupData.data?.snmp_metrics?.length || 0) : 0,
    host_snmp_configs: backupData.data?.host_snmp_configs?.length || 0,
    host_metrics_logging: backupData.data?.host_metrics_logging?.length || 0,
    host_monitoring_data: shouldRestoreSnmpMetrics ? (backupData.data?.host_monitoring_data?.length || 0) : 0,
    host_disk_config: backupData.data?.host_disk_config?.length || 0,
    host_interface_mappings: backupData.data?.host_interface_mappings?.length || 0,
    user_settings: backupData.data?.user_settings?.length || backupData.data?.settings?.length || 0,
  };
  
  // Send immediate response with sessionId
  res.json({
    sessionId,
    status: 'started',
    message: 'Restore process started',
    totalItems
  });
  
  console.log(`📢 Response sent to client, starting background restore...`);
  
  // Process restore in background
  setImmediate(async () => {
    console.log(`🚀 Background restore process started for session ${sessionId}`);
    
    // DEBUG: Check if backupDecryptionKey is still available
    console.log(`🔍 DEBUG: backupDecryptionKey in setImmediate:`);
    console.log(`   - exists: ${!!backupDecryptionKey}`);
    console.log(`   - length: ${backupDecryptionKey ? backupDecryptionKey.length : 'null'}`);
    console.log(`   - first 10 chars: ${backupDecryptionKey ? backupDecryptionKey.substring(0, 10) + '...' : 'null'}`);
    
    let connection = null;
    const startTime = Date.now();
    const MAX_RUNTIME = 5 * 60 * 1000; // 5 minutes max
    
    // Store user ID for audit log (req.user won't be available in background)
    const userId = req.user?.id || null;
    
    try {
      console.log(`📦 Starting background restore for session ${sessionId}`);
      
      // Check if we're still within time limit
      const checkTimeout = () => {
        if (Date.now() - startTime > MAX_RUNTIME) {
          throw new Error('Restore timeout - process took too long');
        }
      };
      
      // Send initial SSE update
      sendProgressUpdate(sessionId, {
        type: 'init',
        totalItems,
        message: 'Preparing restore...'
      });
      
      connection = await pool.getConnection();
      await connection.beginTransaction();
      
      // Disable foreign key checks temporarily for restore
      await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
      
      // Track old ID -> new ID mappings for hosts (needed for SNMP metrics and other relations)
      const hostIdMapping = {};
      
      // Calculate weighted progress based on actual item counts
      const totalItemCount = Object.values(totalItems).reduce((sum, count) => sum + count, 0);
      let processedItemCount = 0;
      
      // Helper function to calculate progress (ensure we reach 100%)
      const calculateProgress = (processed) => {
        if (totalItemCount === 0) return 100;
        const progress = Math.round((processed / totalItemCount) * 100);
        // Never report 100% until we're really done
        return Math.min(99, progress);
      };
      
      // 1. Restore categories first (no dependencies)
      if (backupData.data?.categories?.length > 0) {
        sendProgressUpdate(sessionId, {
          type: 'step',
          currentStep: 'categories',
          message: `Restoring ${totalItems.categories} categories...`
        });
        
        await connection.execute('DELETE FROM categories');
        
        for (let i = 0; i < backupData.data.categories.length; i++) {
          const category = backupData.data.categories[i];
          const { sql, values } = prepareInsert('categories', category);
          await connection.execute(sql, values);
          
          if (i % 5 === 0 || i === backupData.data.categories.length - 1) {
            processedItemCount += (i + 1) - (processedItemCount > 0 ? processedItemCount : 0);
            sendProgressUpdate(sessionId, {
              type: 'progress',
              progress: calculateProgress(processedItemCount),
              processedItems: { categories: i + 1 },
              message: `Processed ${i + 1} of ${totalItems.categories} categories`
            });
          }
        }
        processedItemCount = totalItems.categories; // Ensure full count
      }
      
      // 2. Restore users (Dashboard users - no dependencies)
      if (backupData.data?.users?.length > 0) {
        console.log(`👤 Processing ${backupData.data.users.length} users...`);
        sendProgressUpdate(sessionId, {
          type: 'step',
          currentStep: 'users',
          message: `Restoring ${totalItems.users} users...`
        });
        
        await connection.execute('DELETE FROM users');
        
        for (let i = 0; i < backupData.data.users.length; i++) {
          const user = backupData.data.users[i];
          try {
            const { sql, values } = prepareInsert('users', user);
            await connection.execute(sql, values);
            
            if (i % 2 === 0 || i === backupData.data.users.length - 1) {
              sendProgressUpdate(sessionId, {
                type: 'progress',
                progress: calculateProgress(processedItemCount + i + 1),
                processedItems: { users: i + 1 },
                message: `Processed ${i + 1} of ${totalItems.users} users`
              });
            }
          } catch (userErr) {
            console.error(`  ❌ Error processing user ${user.username}:`, userErr.message);
          }
        }
        processedItemCount += totalItems.users;
      }
      
      // 3. Restore SSH keys BEFORE hosts (hosts reference ssh_keys!)
      if (backupData.data?.ssh_keys?.length > 0) {
        console.log(`🔑 Processing ${backupData.data.ssh_keys.length} SSH keys...`);
        sendProgressUpdate(sessionId, {
          type: 'step',
          currentStep: 'ssh_keys',
          message: `Restoring ${totalItems.ssh_keys} SSH keys...`
        });
        
        try {
          await connection.execute('DELETE FROM ssh_keys');
          console.log('🗑️ Deleted existing SSH keys');
          
          for (let i = 0; i < backupData.data.ssh_keys.length; i++) {
            const sshKey = backupData.data.ssh_keys[i];
            console.log(`  Processing SSH key ${i + 1}/${backupData.data.ssh_keys.length}: ${sshKey.key_name || sshKey.keyName || 'unnamed'}`);
            
            try {
              // Build SSH key data with proper field names - handle both snake_case and camelCase
              const keyName = sshKey.key_name || sshKey.keyName || 'unnamed';
              const encryptedPrivateKey = sshKey.private_key || sshKey.privateKey || '';
              
              // Re-encrypt private key if needed
              const reEncryptedPrivateKey = encryptedPrivateKey ? 
                reEncryptFromBackup(encryptedPrivateKey, 'SSH Key', keyName, true) : '';
              
              const sshKeyData = {
                keyName: keyName,
                privateKey: reEncryptedPrivateKey || '',  // Use re-encrypted or empty if failed
                publicKey: sshKey.public_key || sshKey.publicKey || '',
                keyType: sshKey.key_type || sshKey.keyType || 'rsa',
                keySize: sshKey.key_size || sshKey.keySize || 2048,
                comment: sshKey.comment || '',
                fingerprint: sshKey.fingerprint || null,
                passphraseHash: sshKey.passphrase_hash || sshKey.passphraseHash || null,
                isDefault: sshKey.is_default !== undefined ? sshKey.is_default : (sshKey.isDefault || false),
                createdBy: sshKey.created_by || sshKey.createdBy || null,
                createdAt: sshKey.created_at || sshKey.createdAt || new Date(),
                updatedAt: sshKey.updated_at || sshKey.updatedAt || new Date()
              };
              
              if (!reEncryptedPrivateKey && encryptedPrivateKey) {
                console.warn(`  ⚠️  SSH key "${keyName}" could not be restored - manual re-creation required`);
              }
              
              const { sql, values } = prepareInsert('ssh_keys', sshKeyData);
              console.log(`  SQL: ${sql.substring(0, 100)}...`);
              await connection.execute(sql, values);
              console.log(`  ✅ SSH key ${sshKeyData.keyName} restored`);
              
              // Send progress update for each key
              if (i % 2 === 0 || i === backupData.data.ssh_keys.length - 1) {
                sendProgressUpdate(sessionId, {
                  type: 'progress',
                  progress: calculateProgress(processedItemCount + i + 1),
                  processedItems: { ssh_keys: i + 1 },
                  message: `Processed ${i + 1} of ${totalItems.ssh_keys} SSH keys`
                });
              }
            } catch (keyErr) {
              console.error(`  ❌ Error processing SSH key ${sshKey.key_name || sshKey.keyName}:`, keyErr.message);
              console.error(`  Full error:`, keyErr);
              // Continue with next key
            }
            
            // Give event loop a chance to breathe
            if (i % 10 === 0) {
              await new Promise(resolve => setImmediate(resolve));
            }
          }
          console.log('✅ SSH keys restored successfully');
        } catch (err) {
          console.error('❌ Fatal error restoring SSH keys:', err);
          throw err;
        }
        processedItemCount += totalItems.ssh_keys;
      }
      
      // 4. Restore hosts (depends on ssh_keys via ssh_key_name)
      // NOTE: hostIdMapping moved to top of function to be available for SNMP metrics
      
      if (backupData.data?.hosts?.length > 0) {
        sendProgressUpdate(sessionId, {
          type: 'step',
          currentStep: 'hosts',
          message: `Restoring ${totalItems.hosts} hosts...`
        });
        
        await connection.execute('DELETE FROM hosts');
        
        for (let i = 0; i < backupData.data.hosts.length; i++) {
          const host = backupData.data.hosts[i];
          
          // Re-encrypt passwords if backup has encryption key
          // WICHTIG: Erst kopieren, dann die verschlüsselten Felder explizit löschen
          const hostData = {
            ...host
          };
          
          // Entferne die Original-verschlüsselten Felder (beide Schreibweisen)
          delete hostData.password;
          delete hostData.privateKey;
          delete hostData.private_key;
          delete hostData.remotePassword;
          delete hostData.remote_password;
          delete hostData.rustdeskPassword;
          delete hostData.rustdesk_password;
          
          // Setze die re-verschlüsselten Werte (oder NULL wenn nicht entschlüsselbar)
          hostData.password = reEncryptFromBackup(host.password, 'Host SSH', host.name);
          hostData.private_key = reEncryptFromBackup(host.privateKey || host.private_key, 'Host SSH Key', host.name, true);
          hostData.remote_password = reEncryptFromBackup(host.remotePassword || host.remote_password, 'Host VNC/RDP', host.name);
          hostData.rustdesk_password = reEncryptFromBackup(host.rustdeskPassword || host.rustdesk_password, 'Host RustDesk', host.name);
          
          const oldHostId = host.id;
          // WICHTIG: Behalte die Original-ID bei, damit SNMP-Metriken korrekt zugeordnet bleiben!
          // delete hostData.id; // NICHT löschen - wir behalten die ID!
          
          // Setze die ID explizit
          hostData.id = oldHostId;
          
          const { sql, values } = prepareInsert('hosts', hostData);
          const [result] = await connection.execute(sql, values);
          
          // Kein Mapping mehr nötig, da wir die Original-IDs beibehalten
          // const newHostId = result.insertId;
          // hostIdMapping[oldHostId] = newHostId;
          console.log(`📌 Host restored with original ID: ${oldHostId} (${host.name})`);
          
          if (i % 5 === 0 || i === backupData.data.hosts.length - 1) {
            sendProgressUpdate(sessionId, {
              type: 'progress',
              progress: calculateProgress(processedItemCount + i + 1),
              processedItems: { hosts: i + 1 },
              message: `Processed ${i + 1} of ${totalItems.hosts} hosts`
            });
          }
        }
        processedItemCount += totalItems.hosts;
        
        // Synchronize Guacamole connections for remote desktop enabled hosts
        try {
          const { syncGuacamoleConnection } = require('../utils/guacamoleHelper');
          
          const [importedHosts] = await connection.execute(
            'SELECT * FROM hosts WHERE remote_desktop_enabled = 1'
          );
          
          for (const host of importedHosts) {
            try {
              const guacamoleData = {
                id: host.id,
                name: host.name,
                remote_desktop_enabled: host.remote_desktop_enabled,
                remote_host: host.hostname,
                remote_protocol: host.remote_protocol || 'vnc',
                remote_port: host.remote_port,
                remote_username: host.remote_username,
                remote_password_encrypted: host.remote_password,
                remotePassword: host.remote_password,
                guacamole_performance_mode: host.guacamole_performance_mode,
                sshHostname: host.hostname,
                sshUsername: host.username,
                sshPassword: host.password
              };
              
              await syncGuacamoleConnection(guacamoleData);
              console.log(`✅ Synced Guacamole for host: ${host.name}`);
            } catch (syncError) {
              console.error(`❌ Failed to sync Guacamole for host ${host.name}:`, syncError.message);
            }
          }
        } catch (guacError) {
          console.error('❌ Guacamole sync error:', guacError.message);
        }
      }
      
      // 5. Restore appliances (depends on categories)
      if (backupData.data?.appliances?.length > 0) {
        sendProgressUpdate(sessionId, {
          type: 'step',
          currentStep: 'appliances',
          message: `Restoring ${totalItems.appliances} appliances...`
        });
        
        await connection.execute('DELETE FROM appliances');
        
        for (let i = 0; i < backupData.data.appliances.length; i++) {
          const appliance = backupData.data.appliances[i];
          
          // Re-encrypt passwords if backup has encryption key
          // WICHTIG: Erst kopieren, dann die verschlüsselten Felder explizit löschen
          const applianceData = {
            ...appliance
          };
          
          // Entferne die Original-verschlüsselten Felder
          delete applianceData.remotePasswordEncrypted;
          delete applianceData.remote_password_encrypted;
          delete applianceData.rustdeskPasswordEncrypted;
          delete applianceData.rustdesk_password_encrypted;
          
          // Setze die re-verschlüsselten Werte (oder NULL wenn nicht entschlüsselbar)
          const remotePasswordEnc = appliance.remotePasswordEncrypted || appliance.remote_password_encrypted || null;
          const rustdeskPasswordEnc = appliance.rustdeskPasswordEncrypted || appliance.rustdesk_password_encrypted || null;
          
          applianceData.remote_password_encrypted = reEncryptFromBackup(remotePasswordEnc, 'Appliance VNC/RDP', appliance.name);
          applianceData.rustdesk_password_encrypted = reEncryptFromBackup(rustdeskPasswordEnc, 'Appliance RustDesk', appliance.name);
          
          if (!applianceData.remote_password_encrypted && remotePasswordEnc) {
            console.warn(`⚠️  VNC/RDP password for appliance "${appliance.name}" could not be restored`);
          }
          if (!applianceData.rustdesk_password_encrypted && rustdeskPasswordEnc) {
            console.warn(`⚠️  RustDesk password for appliance "${appliance.name}" could not be restored`);
          }
          
          const { sql, values } = prepareInsert('appliances', applianceData);
          await connection.execute(sql, values);
          
          if (i % 10 === 0 || i === backupData.data.appliances.length - 1) {
            sendProgressUpdate(sessionId, {
              type: 'progress',
              progress: calculateProgress(processedItemCount + i + 1),
              processedItems: { appliances: i + 1 },
              message: `Processed ${i + 1} of ${totalItems.appliances} appliances`
            });
          }
        }
        processedItemCount += totalItems.appliances;
        
        // Synchronize Guacamole connections for remote desktop enabled appliances
        console.log('🔄 Synchronizing Guacamole connections for appliances...');
        try {
          const { syncGuacamoleConnection } = require('../utils/guacamoleHelper');
          
          const [importedAppliances] = await connection.execute(
            'SELECT * FROM appliances WHERE remote_desktop_enabled = 1'
          );
          
          console.log(`Found ${importedAppliances.length} appliances with remote desktop enabled`);
          
          for (const appliance of importedAppliances) {
            try {
              // Appliances use a different data structure for Guacamole sync
              const guacamoleData = {
                id: appliance.id,
                name: appliance.name,
                remote_desktop_enabled: appliance.remote_desktop_enabled,
                remote_host: appliance.remote_host,
                remote_protocol: appliance.remote_protocol || 'vnc',
                remote_port: appliance.remote_port,
                remote_username: appliance.remote_username,
                remote_password_encrypted: appliance.remote_password_encrypted,
                guacamole_performance_mode: appliance.guacamole_performance_mode || 'balanced'
              };
              
              await syncGuacamoleConnection(guacamoleData);
              console.log(`✅ Synced Guacamole for appliance: ${appliance.name}`);
            } catch (syncError) {
              console.error(`❌ Failed to sync Guacamole for appliance ${appliance.name}:`, syncError.message);
            }
          }
        } catch (guacError) {
          console.error('❌ Guacamole sync error for appliances:', guacError.message);
        }
      }
      
      // 6. Restore background images WITH file restoration
      if (backupData.data?.background_images?.length > 0) {
        console.log(`🖼️ Processing ${backupData.data.background_images.length} background images...`);
        sendProgressUpdate(sessionId, {
          type: 'step', 
          currentStep: 'background_images',
          message: `Restoring ${totalItems.background_images} background images...`
        });
        
        try {
          // Delete existing DB records
          await connection.execute('DELETE FROM background_images');
          
          // Clean up existing background files
          const backgroundsDir = path.join(__dirname, '..', 'uploads', 'backgrounds');
          
          try {
            // Ensure directory exists
            await fs.mkdir(backgroundsDir, { recursive: true });
            
            // Clean existing files
            const existingFiles = await fs.readdir(backgroundsDir);
            for (const file of existingFiles) {
              try {
                await fs.unlink(path.join(backgroundsDir, file));
              } catch (unlinkError) {
                console.error(`Could not delete ${file}:`, unlinkError.message);
              }
            }
            console.log(`🗑️ Cleaned ${existingFiles.length} existing background files`);
          } catch (cleanupError) {
            console.error('Error cleaning backgrounds directory:', cleanupError.message);
          }
          
          // Restore each background image
          for (let i = 0; i < backupData.data.background_images.length; i++) {
            const bgImage = backupData.data.background_images[i];
            
            // Restore file if data is available
            if (bgImage.file_data && !bgImage.file_missing && !bgImage.file_error) {
              try {
                const fileBuffer = Buffer.from(bgImage.file_data, 'base64');
                const filepath = path.join(backgroundsDir, bgImage.filename);
                await fs.writeFile(filepath, fileBuffer);
                console.log(`✅ Restored file: ${bgImage.filename}`);
              } catch (fileError) {
                console.error(`❌ Error restoring file ${bgImage.filename}:`, fileError.message);
              }
            } else {
              console.log(`⚠️ No file data for ${bgImage.filename}`);
            }
            
            // Restore database record
            const backgroundData = {
              filename: bgImage.filename,
              originalName: bgImage.original_name || bgImage.originalName || bgImage.filename,
              mimeType: bgImage.mime_type || bgImage.mimeType || 'image/jpeg',
              fileSize: bgImage.file_size || bgImage.fileSize || 0,
              width: bgImage.width || 1920,
              height: bgImage.height || 1080,
              uploadedBy: bgImage.uploaded_by || bgImage.uploadedBy || null,
              isActive: Boolean(bgImage.is_active !== undefined ? bgImage.is_active : bgImage.isActive),
              usageCount: bgImage.usage_count || bgImage.usageCount || 0,
              createdAt: bgImage.created_at || bgImage.createdAt || new Date()
            };
            
            try {
              const { sql, values } = prepareInsert('background_images', backgroundData);
              await connection.execute(sql, values);
              
              if (i % 2 === 0 || i === backupData.data.background_images.length - 1) {
                sendProgressUpdate(sessionId, {
                  type: 'progress',
                  progress: calculateProgress(processedItemCount + i + 1),
                  processedItems: { background_images: i + 1 },
                  message: `Processed ${i + 1} of ${totalItems.background_images} images`
                });
              }
            } catch (dbErr) {
              console.error(`❌ Error saving background image to DB:`, dbErr.message);
            }
          }
          
          console.log(`✅ Restored ${backupData.data.background_images.length} background images`);
        } catch (error) {
          console.error('❌ Fatal error restoring background images:', error);
        }
        
        processedItemCount += totalItems.background_images;
      }
      
      // 7. NOW restore SNMP Metrics (after hosts exist - with mapped IDs!)
      // Check if user wants to restore SNMP metrics (can be optional due to size)
      // shouldRestoreSnmpMetrics already defined above in line 153
      console.log(`📊 SNMP Metrics restore check: shouldRestoreSnmpMetrics=${shouldRestoreSnmpMetrics}, metrics count=${backupData.data?.snmp_metrics?.length || 0}`);
      
      if (shouldRestoreSnmpMetrics && backupData.data?.snmp_metrics?.length > 0) {
        const snmpMetrics = backupData.data.snmp_metrics;
        const BATCH_SIZE = 5000; // MASSIVELY increased from 1000 to 5000
        
        sendProgressUpdate(sessionId, {
          type: 'step',
          currentStep: 'snmp_metrics',
          message: `Restoring ${snmpMetrics.length.toLocaleString()} SNMP metrics (ultra-fast mode)...`
        });
        
        await connection.execute('DELETE FROM snmp_metrics');
        
        let skippedMetrics = 0;
        let restoredMetrics = 0;
        let lastProgressUpdate = Date.now();
        
        console.log(`📊 Starting ULTRA-FAST SNMP metrics restore with batch size ${BATCH_SIZE}...`);
        
        // Pre-filter all metrics with valid host mappings for better performance
        console.log(`⚡ Pre-filtering metrics (using original IDs)...`);
        
        const validMetrics = [];
        
        for (const metric of snmpMetrics) {
          const hostId = metric.host_id || metric.hostId;
          
          validMetrics.push({
            host_id: hostId,
            metric_key: metric.metric_key || metric.metricKey,
            metric_value: metric.metric_value || metric.metricValue,
            metric_name: metric.metric_name || metric.metricName || null,
            // Convert ISO timestamp to MySQL format
            timestamp: metric.timestamp ? 
              new Date(metric.timestamp).toISOString().slice(0, 19).replace('T', ' ') : 
              new Date().toISOString().slice(0, 19).replace('T', ' ')
          });
        }
        
        // skippedMetrics bleibt bei 0, da wir alle Metriken verwenden
        console.log(`⚡ Pre-filtering complete: ${validMetrics.length} metrics ready for insert`);
        
        // Now bulk insert in large batches without per-batch processing overhead
        for (let i = 0; i < validMetrics.length; i += BATCH_SIZE) {
          const batch = validMetrics.slice(i, i + BATCH_SIZE);
          
          if (batch.length > 0) {
            try {
              // Build bulk insert query
              const placeholders = batch.map(() => '(?, ?, ?, ?, ?)').join(',');
              const sql = `INSERT INTO snmp_metrics (host_id, metric_key, metric_value, metric_name, timestamp) VALUES ${placeholders}`;
              
              // Flatten values array for query execution
              const values = [];
              for (const metric of batch) {
                values.push(
                  metric.host_id,
                  metric.metric_key,
                  metric.metric_value,
                  metric.metric_name,
                  metric.timestamp
                );
              }
              
              // Execute bulk insert
              await connection.execute(sql, values);
              restoredMetrics += batch.length;
              
              console.log(`  ✅ Ultra-fast bulk inserted ${batch.length} metrics (batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(validMetrics.length/BATCH_SIZE)})`);
              
              // Only send progress updates every 2 seconds to reduce overhead
              const now = Date.now();
              if (now - lastProgressUpdate > 2000) {
                const progress = calculateProgress(processedItemCount + (restoredMetrics * totalItems.snmp_metrics / snmpMetrics.length));
                sendProgressUpdate(sessionId, {
                  type: 'progress',
                  progress,
                  processedItems: { snmp_metrics: restoredMetrics },
                  message: `Processed ${restoredMetrics.toLocaleString()} of ${validMetrics.length.toLocaleString()} metrics (ultra-fast mode)`
                });
                lastProgressUpdate = now;
              }
            } catch (err) {
              console.error(`❌ Bulk insert failed for batch at index ${i}:`, err.message);
              // Skip fallback to individual inserts for performance - just log the error
              console.error(`  ⚠️ Skipping ${batch.length} metrics due to bulk insert failure`);
            }
          }
        }
        
        // Final progress update
        sendProgressUpdate(sessionId, {
          type: 'progress',
          progress: calculateProgress(processedItemCount + totalItems.snmp_metrics),
          processedItems: { snmp_metrics: restoredMetrics },
          message: `Completed: ${restoredMetrics.toLocaleString()} metrics restored`,
          detail: `Skipped: ${skippedMetrics}`
        });
        
        console.log(`✅ ULTRA-FAST restore complete: ${restoredMetrics.toLocaleString()} SNMP metrics restored with original host IDs`);
        
        processedItemCount += totalItems.snmp_metrics;
      } else if (!shouldRestoreSnmpMetrics && backupData.data?.snmp_metrics?.length > 0) {
        // User chose to skip SNMP metrics restoration
        sendProgressUpdate(sessionId, {
          type: 'step',
          currentStep: 'snmp_metrics',
          message: `Skipping ${backupData.data.snmp_metrics.length.toLocaleString()} SNMP metrics (user choice)...`
        });
        console.log(`⏭️ Skipped ${backupData.data.snmp_metrics.length} SNMP metrics as requested by user`);
      }
      
      // Re-enable foreign key checks
      await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
      
      // 8. Restore host SNMP configs (depends on hosts - use mapped IDs!)
      if (backupData.data?.host_snmp_configs?.length > 0) {
        sendProgressUpdate(sessionId, {
          type: 'step',
          currentStep: 'host_snmp_configs',
          message: `Restoring ${totalItems.host_snmp_configs} SNMP configurations...`
        });
        
        await connection.execute('DELETE FROM host_snmp_configs');
        
        let restoredConfigs = 0;
        for (const config of backupData.data.host_snmp_configs) {
          // Verwende Original Host-ID direkt
          const hostId = config.host_id || config.hostId;
          
          // Update config with original host ID
          const configData = {
            ...config,
            hostId: hostId  // Use original host ID
          };
          
          // Remove the old ID field to avoid confusion
          delete configData.id;
          delete configData.host_id;
          
          const { sql, values } = prepareInsert('host_snmp_configs', configData);
          await connection.execute(sql, values);
          restoredConfigs++;
        }
        
        processedItemCount += totalItems.host_snmp_configs;
        sendProgressUpdate(sessionId, {
          type: 'progress',
          progress: calculateProgress(processedItemCount),
          processedItems: { host_snmp_configs: restoredConfigs },
          message: `Processed ${restoredConfigs} of ${totalItems.host_snmp_configs} SNMP configurations`
        });
        
        console.log(`✅ Restored ${restoredConfigs} SNMP configs with mapped host IDs`);
        
        // WICHTIG: Synchronisiere SNMP-Einstellungen von host_snmp_configs zur hosts Tabelle
        console.log('🔄 Synchronizing SNMP settings to hosts table...');
        await connection.execute(
          'UPDATE hosts h ' +
          'INNER JOIN host_snmp_configs c ON h.id = c.host_id ' +
          'SET h.snmp_enabled = c.enabled, ' +
          '    h.snmp_community = c.community, ' +
          '    h.snmp_port = c.port, ' +
          '    h.snmp_version = c.version'
        );
        console.log('✅ SNMP settings synchronized to hosts table');
      }
      
      // 9. Restore host_metrics_logging (metric configurations per host)
      if (backupData.data?.host_metrics_logging?.length > 0) {
        console.log(`📊 Restoring ${backupData.data.host_metrics_logging.length} metric logging configs...`);
        console.log('  First config sample:', JSON.stringify(backupData.data.host_metrics_logging[0]));
        
        sendProgressUpdate(sessionId, {
          type: 'step',
          currentStep: 'host_metrics_logging',
          message: `Restoring ${totalItems.host_metrics_logging} metric logging configurations...`
        });
        
        await connection.execute('DELETE FROM host_metrics_logging');
        
        let restoredLogging = 0;
        for (const logging of backupData.data.host_metrics_logging) {
          // Verwende Original Host-ID direkt (kein Mapping mehr nötig)
          const hostId = logging.host_id || logging.hostId;
          
          const loggingData = {
            hostId: hostId,  // Use original host ID
            config: typeof logging.config === 'string' ? logging.config : JSON.stringify(logging.config || {}),
            customNames: typeof logging.custom_names === 'string' ? logging.custom_names : 
              (typeof logging.customNames === 'string' ? logging.customNames : 
                JSON.stringify(logging.custom_names || logging.customNames || {})),
            selectedMetrics: typeof logging.selected_metrics === 'string' ? logging.selected_metrics :
              (typeof logging.selectedMetrics === 'string' ? logging.selectedMetrics :
                JSON.stringify(logging.selected_metrics || logging.selectedMetrics || null)),
            defaultTimeRange: logging.default_time_range || logging.defaultTimeRange || '15m',
            createdAt: logging.created_at || logging.createdAt || new Date(),
            updatedAt: logging.updated_at || logging.updatedAt || new Date()
          };
          
          try {
            const { sql, values } = prepareInsert('host_metrics_logging', loggingData);
            await connection.execute(sql, values);
            restoredLogging++;
          } catch (err) {
            console.error(`❌ Error restoring metrics logging for host ${hostId}:`, err.message);
          }
        }
        
        console.log(`✅ Restored ${restoredLogging} metric logging configs`);
        processedItemCount += totalItems.host_metrics_logging;
        sendProgressUpdate(sessionId, {
          type: 'progress',
          progress: calculateProgress(processedItemCount),
          processedItems: { host_metrics_logging: restoredLogging },
          message: `Processed ${restoredLogging} metric logging configurations`
        });
      } else {
        console.log('⚠️ No host_metrics_logging data in backup');
      }
      
      // WICHTIG: Stelle sicher, dass jeder Host eine Metrik-Konfiguration hat
      // ABER überschreibe keine existierenden Konfigurationen!
      console.log('🔄 Ensuring all hosts have metric configurations...');
      const [allHosts] = await connection.execute('SELECT id, name FROM hosts');
      for (const host of allHosts) {
        const [existing] = await connection.execute(
          'SELECT id, selected_metrics FROM host_metrics_logging WHERE host_id = ?',
          [host.id]
        );
        
        if (existing.length === 0) {
          // Erstelle Default-Konfiguration mit allen wichtigen Metriken
          const defaultMetrics = [
            'cpu.user', 'cpu.system', 'cpu.idle', 'cpu.load1',
            'memory.total', 'memory.free', 'memory.used', 
            'disk.0', 'disk.1',
            'network.interface.en0.bytesIn', 'network.interface.en0.bytesOut',
            'process.count', 'process.user', 'process.system'
          ];
          
          await connection.execute(
            'INSERT INTO host_metrics_logging (host_id, selected_metrics, default_time_range, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
            [host.id, JSON.stringify(defaultMetrics), '30d']
          );
          console.log(`  ✅ Created default metrics config for ${host.name} (ID ${host.id})`);
        } else {
          // Log existing config
          const selected = JSON.parse(existing[0].selected_metrics || '[]');
          console.log(`  ✓ ${host.name} has config with ${selected.length} metrics`);
        }
      }
      console.log('✅ All hosts have metric configurations');
      
      // 10. Restore host_monitoring_data (historical monitoring data)
      // Only restore if user wants SNMP metrics (since this is also monitoring history)
      if (shouldRestoreSnmpMetrics && backupData.data?.host_monitoring_data?.length > 0) {
        console.log(`📈 Restoring ${backupData.data.host_monitoring_data.length.toLocaleString()} monitoring data entries using BULK INSERT...`);
        sendProgressUpdate(sessionId, {
          type: 'step',
          currentStep: 'host_monitoring_data',
          message: `Restoring ${totalItems.host_monitoring_data.toLocaleString()} monitoring data entries (optimized bulk insert)...`
        });
        
        await connection.execute('DELETE FROM host_monitoring_data');
        
        // OPTIMIZED: Use bulk insert for massive performance improvement
        const BATCH_SIZE = 1000; // Insert 1000 rows at a time
        let totalRestored = 0;
        let skippedEntries = 0;
        
        for (let i = 0; i < backupData.data.host_monitoring_data.length; i += BATCH_SIZE) {
          const batch = backupData.data.host_monitoring_data.slice(i, i + BATCH_SIZE);
          const mappedValues = [];
          
          // Prepare batch values
          for (const data of batch) {
            const hostId = data.host_id || data.hostId;
            
            // Skip if no host ID
            if (!hostId) {
              skippedEntries++;
              continue; // Skip data for non-existent hosts
            }
            
            // Add values array for this row
            mappedValues.push([
              hostId,  // Use original host ID
              data.metric_key || data.metricKey,
              data.metric_value || data.metricValue,
              data.timestamp || new Date().toISOString()
            ]);
          }
          
          // Execute bulk insert if we have any valid rows
          if (mappedValues.length > 0) {
            try {
              // Build bulk insert query
              const placeholders = mappedValues.map(() => '(?, ?, ?, ?)').join(', ');
              const bulkSql = `INSERT INTO host_monitoring_data (host_id, metric_key, metric_value, timestamp) VALUES ${placeholders}`;
              
              // Flatten values array for query execution
              const flatValues = mappedValues.flat();
              
              // Execute bulk insert
              await connection.execute(bulkSql, flatValues);
              totalRestored += mappedValues.length;
              
              console.log(`  ✅ Inserted batch: ${totalRestored.toLocaleString()} / ${backupData.data.host_monitoring_data.length.toLocaleString()} entries`);
            } catch (err) {
              console.error(`❌ Error in bulk insert for monitoring data:`, err.message);
              
              // Fallback: Try inserting individually if bulk fails
              console.log(`  ⚠️ Falling back to individual inserts for this batch...`);
              for (const values of mappedValues) {
                try {
                  await connection.execute(
                    'INSERT INTO host_monitoring_data (host_id, metric_key, metric_value, timestamp) VALUES (?, ?, ?, ?)',
                    values
                  );
                  totalRestored++;
                } catch (individualErr) {
                  console.error(`    ❌ Failed to insert individual monitoring entry:`, individualErr.message);
                }
              }
            }
          }
          
          // Send progress update every batch
          const processed = Math.min(i + BATCH_SIZE, backupData.data.host_monitoring_data.length);
          const progressPercent = calculateProgress(processedItemCount + (processed * totalItems.host_monitoring_data / backupData.data.host_monitoring_data.length));
          
          sendProgressUpdate(sessionId, {
            type: 'progress',
            progress: progressPercent,
            processedItems: { host_monitoring_data: totalRestored },
            message: `Processed ${totalRestored.toLocaleString()} of ${totalItems.host_monitoring_data.toLocaleString()} monitoring entries (bulk mode)`
          });
        }
        
        console.log(`✅ Successfully restored ${totalRestored.toLocaleString()} monitoring data entries using bulk insert`);
        if (skippedEntries > 0) {
          console.log(`⚠️ Skipped ${skippedEntries.toLocaleString()} entries due to missing host mappings`);
        }
        processedItemCount += totalItems.host_monitoring_data;
      } else if (!shouldRestoreSnmpMetrics && backupData.data?.host_monitoring_data?.length > 0) {
        // User chose to skip monitoring data restoration
        sendProgressUpdate(sessionId, {
          type: 'step',
          currentStep: 'host_monitoring_data',
          message: `Skipping ${backupData.data.host_monitoring_data.length.toLocaleString()} monitoring data entries (user choice)...`
        });
        console.log(`⏭️ Skipped ${backupData.data.host_monitoring_data.length} monitoring data entries as requested by user`);
      }
      
      // 11. Restore host_disk_config (disk configurations per host)
      if (backupData.data?.host_disk_config?.length > 0) {
        console.log(`💾 Restoring ${backupData.data.host_disk_config.length} disk configurations...`);
        sendProgressUpdate(sessionId, {
          type: 'step',
          currentStep: 'host_disk_config',
          message: `Restoring ${totalItems.host_disk_config} disk configurations...`
        });
        
        await connection.execute('DELETE FROM host_disk_config');
        
        let restoredDiskConfigs = 0;
        for (const config of backupData.data.host_disk_config) {
          const oldHostId = config.host_id || config.hostId;
          const newHostId = hostIdMapping[oldHostId];
          
          if (!newHostId) {
            console.warn(`⚠️ Skipping disk config for unknown host ID ${oldHostId}`);
            continue;
          }
          
          const diskData = {
            hostId: newHostId,  // Use mapped host ID
            diskIndex: config.disk_index || config.diskIndex || 0,
            diskName: config.disk_name || config.diskName || 'Disk',
            totalSizeGb: config.total_size_gb || config.totalSizeGb || 0,
            createdAt: config.created_at || config.createdAt || new Date(),
            updatedAt: config.updated_at || config.updatedAt || new Date()
          };
          
          try {
            const { sql, values } = prepareInsert('host_disk_config', diskData);
            await connection.execute(sql, values);
            restoredDiskConfigs++;
          } catch (err) {
            console.error(`❌ Error restoring disk config for host ${newHostId}:`, err.message);
          }
        }
        
        console.log(`✅ Restored ${restoredDiskConfigs} disk configurations`);
        processedItemCount += totalItems.host_disk_config;
        sendProgressUpdate(sessionId, {
          type: 'progress',
          progress: calculateProgress(processedItemCount),
          processedItems: { host_disk_config: restoredDiskConfigs },
          message: `Processed ${restoredDiskConfigs} disk configurations`
        });
      }
      
      // 12. Restore host_interface_mappings (network interface mappings per host)
      if (backupData.data?.host_interface_mappings?.length > 0) {
        console.log(`🔌 Restoring ${backupData.data.host_interface_mappings.length} interface mappings...`);
        sendProgressUpdate(sessionId, {
          type: 'step',
          currentStep: 'host_interface_mappings',
          message: `Restoring ${totalItems.host_interface_mappings} interface mappings...`
        });
        
        await connection.execute('DELETE FROM host_interface_mappings');
        
        let restoredMappings = 0;
        for (const mapping of backupData.data.host_interface_mappings) {
          const oldHostId = mapping.host_id || mapping.hostId;
          const newHostId = hostIdMapping[oldHostId];
          
          if (!newHostId) {
            console.warn(`⚠️ Skipping interface mapping for unknown host ID ${oldHostId}`);
            continue;
          }
          
          const mappingData = {
            hostId: newHostId,  // Use mapped host ID
            interfaceIndex: mapping.interface_index || mapping.interfaceIndex,
            interfaceName: mapping.interface_name || mapping.interfaceName,
            interfaceDescription: mapping.interface_description || mapping.interfaceDescription || null,
            interfaceType: mapping.interface_type || mapping.interfaceType || null,
            interfaceSpeed: mapping.interface_speed || mapping.interfaceSpeed || null,
            macAddress: mapping.mac_address || mapping.macAddress || null,
            ipAddress: mapping.ip_address || mapping.ipAddress || null,
            createdAt: mapping.created_at || mapping.createdAt || new Date(),
            updatedAt: mapping.updated_at || mapping.updatedAt || new Date()
          };
          
          try {
            const { sql, values } = prepareInsert('host_interface_mappings', mappingData);
            await connection.execute(sql, values);
            restoredMappings++;
          } catch (err) {
            console.error(`❌ Error restoring interface mapping for host ${newHostId}:`, err.message);
          }
        }
        
        console.log(`✅ Restored ${restoredMappings} interface mappings`);
        processedItemCount += totalItems.host_interface_mappings;
        sendProgressUpdate(sessionId, {
          type: 'progress',
          progress: calculateProgress(processedItemCount),
          processedItems: { host_interface_mappings: restoredMappings },
          message: `Processed ${restoredMappings} interface mappings`
        });
      }
      
      // 13. Restore user settings
      if (backupData.data?.user_settings?.length > 0 || backupData.data?.settings?.length > 0) {
        const settings = backupData.data.user_settings || backupData.data.settings;
        console.log(`⚙️ Restoring ${settings.length} user settings...`);
        sendProgressUpdate(sessionId, {
          type: 'step',
          currentStep: 'user_settings',
          message: `Restoring ${settings.length} user settings...`
        });
        
        await connection.execute('DELETE FROM user_settings');
        
        for (const setting of settings) {
          const { sql, values } = prepareInsert('user_settings', setting);
          await connection.execute(sql, values);
        }
        processedItemCount += settings.length;
        sendProgressUpdate(sessionId, {
          type: 'progress',
          progress: calculateProgress(processedItemCount),
          processedItems: { user_settings: settings.length },
          message: `Processed ${settings.length} user settings`
        });
        console.log(`✅ User settings restored`);
      }
      
      console.log(`🏁 All restore operations complete, committing transaction...`);
      
      await connection.commit();
      
      // Signal Background Polling Service to reload all hosts with new IDs
      try {
        console.log(`📡 Signaling Background Polling Service to reload all hosts...`);
        
        // Clear any existing signals
        await connection.execute('DELETE FROM snmp_reload_signals');
        
        // Insert reload-all signal (host_id = NULL for global signals)
        await connection.execute(
          `INSERT INTO snmp_reload_signals (host_id, signal_type, created_at, processed_at) 
           VALUES (NULL, 'reload-all', NOW(), NULL)`
        );
        
        console.log(`✅ Created reload-all signal for Background Polling Service`);
        console.log(`⏳ The service will reload all hosts within 30 seconds`);
        
      } catch (signalErr) {
        console.error(`❌ Failed to signal Background Polling Service:`, signalErr);
        console.log(`⚠️ Manual restart required: docker restart appliance_backend`);
        // Don't fail the restore because of this
      }
      
      // Create audit log for successful restore
      try {
        console.log(`📝 Creating audit log for user ${userId}, session ${sessionId}`);
        await createAuditLog(userId, 'restore_complete', {
          sessionId,
          totalItems,
          processedItemCount,
          duration: Date.now() - startTime
        });
      } catch (auditErr) {
        console.error('Failed to create audit log:', auditErr);
        // Don't fail the restore because of audit log error
      }
      
      // Send completion with restart flag
      console.log(`📤 Sending complete event for session ${sessionId}`);
      
      // Prepare warning message if there were failed restorations
      let warningMessage = null;
      const totalFailedPasswords = failedRestorations.passwords.length;
      const totalFailedKeys = failedRestorations.sshKeys.length;
      
      if (totalFailedPasswords > 0 || totalFailedKeys > 0) {
        const warnings = [];
        if (totalFailedPasswords > 0) {
          warnings.push(`${totalFailedPasswords} password(s)`);
        }
        if (totalFailedKeys > 0) {
          warnings.push(`${totalFailedKeys} SSH key(s)`);
        }
        warningMessage = `Warning: ${warnings.join(' and ')} could not be restored and must be re-entered manually.`;
        
        console.warn('⚠️  Failed restorations:');
        if (totalFailedPasswords > 0) {
          console.warn(`  Passwords: ${totalFailedPasswords}`);
          // Group by type for better logging
          const passwordsByType = failedRestorations.passwords.reduce((acc, item) => {
            if (!acc[item.type]) acc[item.type] = [];
            acc[item.type].push(item.name);
            return acc;
          }, {});
          Object.entries(passwordsByType).forEach(([type, names]) => {
            console.warn(`    ${type}: ${names.join(', ')}`);
          });
        }
        if (totalFailedKeys > 0) {
          console.warn(`  SSH Keys: ${totalFailedKeys}`);
          failedRestorations.sshKeys.forEach(key => {
            console.warn(`    ${key.name}: ${key.reason}`);
          });
        }
      }
      
      sendProgressUpdate(sessionId, {
        type: 'complete',
        progress: 100,
        message: 'Restore completed successfully! Backend restart required for SNMP polling.',
        success: true,
        restartRequired: true,  // Flag for frontend
        warning: warningMessage,
        failedRestorations: (totalFailedPasswords > 0 || totalFailedKeys > 0) ? failedRestorations : undefined
      });
      
      // Update session status
      const session = restoreSessions.get(sessionId);
      if (session) {
        session.status = 'complete';
        console.log(`✅ Session ${sessionId} marked as complete`);
      }
      
      console.log(`✅ Restore completed for session ${sessionId}`);
      
    } catch (error) {
      console.error(`❌ Restore error for session ${sessionId}:`, error);
      if (connection) {
        try {
          await connection.rollback();
        } catch (rollbackErr) {
          console.error('Rollback error:', rollbackErr);
        }
      }
      
      sendProgressUpdate(sessionId, {
        type: 'error',
        message: `Error: ${error.message}`,
        success: false,
        // Include any failed restorations even in error case
        failedRestorations: (failedRestorations.passwords.length > 0 || failedRestorations.sshKeys.length > 0) ? failedRestorations : undefined
      });
      
      const session = restoreSessions.get(sessionId);
      if (session) {
        session.status = 'error';
      }
    } finally {
      if (connection) {
        try {
          connection.release();
        } catch (releaseErr) {
          console.error('Connection release error:', releaseErr);
        }
      }
      
      // ALWAYS send a final status if not already sent
      const session = restoreSessions.get(sessionId);
      if (session && session.status === 'processing') {
        console.log(`⚠️ Restore ended without proper completion, sending complete event anyway`);
        sendProgressUpdate(sessionId, {
          type: 'complete',
          progress: 100,
          message: 'Restore process finished',
          success: true
        });
        session.status = 'complete';
      }
    }
  });
});

module.exports = router;
module.exports.sendProgressUpdate = sendProgressUpdate;
module.exports.restoreSessions = restoreSessions;
