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
  const backupDecryptionKey = backupData.encryption_key || null;
  
  // Function to re-encrypt password from backup to system key
  const reEncryptFromBackup = (encryptedData) => {
    if (!encryptedData) return null;
    
    if (!backupDecryptionKey) {
      // No backup key, return as-is
      return encryptedData;
    }

    try {
      const systemKey = encryptionManager.getSystemKey();
      const result = encryptionManager.reEncrypt(encryptedData, backupDecryptionKey, systemKey);
      
      if (!result) {
        // Try to decrypt manually and re-encrypt
        const decrypted = encryptionManager.decrypt(encryptedData, backupDecryptionKey);
        if (decrypted) {
          const reEncrypted = encryptionManager.encrypt(decrypted, systemKey);
          return reEncrypted || encryptedData;
        }
        return encryptedData;
      }
      
      return result;
    } catch (error) {
      console.error('❌ Re-encryption error:', error.message);
      return encryptedData;
    }
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
  
  // Count items for progress - include background_images
  const totalItems = {
    categories: backupData.data?.categories?.length || 0,
    users: backupData.data?.users?.length || 0,  // Dashboard users
    ssh_keys: backupData.data?.ssh_keys?.length || 0,  // Must be before hosts!
    hosts: backupData.data?.hosts?.length || 0,
    appliances: backupData.data?.appliances?.length || 0,
    background_images: backupData.data?.background_images?.length || 0,  // Will handle files too
    snmp_metrics: backupData.data?.snmp_metrics?.length || 0,
    host_snmp_configs: backupData.data?.host_snmp_configs?.length || 0,
    user_settings: backupData.data?.user_settings?.length || backupData.data?.settings?.length || 0,
  };
  
  // Send immediate response with sessionId
  res.json({
    sessionId,
    status: 'started',
    message: 'Restore process started',
    totalItems
  });
  
  // Process restore in background
  setImmediate(async () => {
    let connection = null;
    const startTime = Date.now();
    const MAX_RUNTIME = 5 * 60 * 1000; // 5 minutes max
    
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
      
      // Calculate weighted progress based on actual item counts
      const totalItemCount = Object.values(totalItems).reduce((sum, count) => sum + count, 0);
      let processedItemCount = 0;
      
      // Helper function to calculate progress
      const calculateProgress = (processed) => {
        return Math.min(99, Math.round((processed / totalItemCount) * 100));
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
              const sshKeyData = {
                keyName: sshKey.key_name || sshKey.keyName,  // Ensure camelCase for prepareInsert
                privateKey: sshKey.private_key || sshKey.privateKey || '',
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
      const hostIdMapping = {}; // Track old ID -> new ID mappings for later use
      
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
          const hostData = {
            ...host,
            password: reEncryptFromBackup(host.password),
            privateKey: reEncryptFromBackup(host.privateKey || host.private_key),
            remotePassword: reEncryptFromBackup(host.remotePassword || host.remote_password),
            rustdeskPassword: reEncryptFromBackup(host.rustdeskPassword || host.rustdesk_password)
          };
          
          const oldHostId = host.id;
          delete hostData.id; // Remove ID to let DB auto-increment
          
          const { sql, values } = prepareInsert('hosts', hostData);
          const [result] = await connection.execute(sql, values);
          
          // Map old ID to new ID
          const newHostId = result.insertId;
          hostIdMapping[oldHostId] = newHostId;
          console.log(`📌 Host ID mapping: ${oldHostId} -> ${newHostId} (${host.name})`);
          
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
          const applianceData = {
            ...appliance,
            remotePasswordEncrypted: reEncryptFromBackup(appliance.remotePasswordEncrypted || appliance.remote_password_encrypted),
            rustdeskPasswordEncrypted: reEncryptFromBackup(appliance.rustdeskPasswordEncrypted || appliance.rustdesk_password_encrypted)
          };
          
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
      
      // 7. NOW restore SNMP Metrics (after hosts exist!)
      if (backupData.data?.snmp_metrics?.length > 0) {
        const snmpMetrics = backupData.data.snmp_metrics;
        const batchSize = 100; // Smaller batch size to prevent overload
        
        sendProgressUpdate(sessionId, {
          type: 'step',
          currentStep: 'snmp_metrics',
          message: `Restoring ${snmpMetrics.length.toLocaleString()} SNMP metrics...`
        });
        
        await connection.execute('DELETE FROM snmp_metrics');
        
        for (let i = 0; i < snmpMetrics.length; i += batchSize) {
          // Check timeout
          checkTimeout();
          
          const batch = snmpMetrics.slice(i, i + batchSize);
          
          // Build bulk insert query for better performance
          if (batch.length > 0) {
            const placeholders = batch.map(() => '(?, ?, ?, ?, ?)').join(',');
            const sql = `INSERT INTO snmp_metrics (host_id, metric_key, metric_value, metric_name, timestamp) VALUES ${placeholders}`;
            const values = [];
            
            for (const metric of batch) {
              values.push(
                metric.host_id || metric.hostId,
                metric.metric_key || metric.metricKey,
                metric.metric_value || metric.metricValue,
                metric.metric_name || metric.metricName || null,
                metric.timestamp || new Date()
              );
            }
            
            try {
              await connection.execute(sql, values);
            } catch (err) {
              console.error(`Error inserting batch at index ${i}:`, err.message);
              // Try individual inserts as fallback
              for (const metric of batch) {
                try {
                  const metricData = {
                    hostId: metric.host_id || metric.hostId,
                    metricKey: metric.metric_key || metric.metricKey,
                    metricValue: metric.metric_value || metric.metricValue,
                    metricName: metric.metric_name || metric.metricName || null,
                    timestamp: metric.timestamp || new Date()
                  };
                  const { sql, values } = prepareInsert('snmp_metrics', metricData);
                  await connection.execute(sql, values);
                } catch (individualErr) {
                  console.error('Skipping metric due to error:', individualErr.message);
                }
              }
            }
          }
          
          // Send progress for each batch
          const processed = Math.min(i + batchSize, snmpMetrics.length);
          const progress = calculateProgress(processedItemCount + processed);
          
          sendProgressUpdate(sessionId, {
            type: 'progress',
            progress,
            processedItems: { snmp_metrics: processed },
            message: `Processed ${processed.toLocaleString()} of ${snmpMetrics.length.toLocaleString()} metrics`,
            detail: `Batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(snmpMetrics.length / batchSize)}`
          });
          
          // Give event loop a chance to breathe
          await new Promise(resolve => setImmediate(resolve));
        }
        processedItemCount += totalItems.snmp_metrics;
      }
      
      // Re-enable foreign key checks
      await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
      
      // 8. Restore host SNMP configs (depends on hosts)
      if (backupData.data?.host_snmp_configs?.length > 0) {
        sendProgressUpdate(sessionId, {
          type: 'step',
          currentStep: 'host_snmp_configs',
          message: `Restoring ${totalItems.host_snmp_configs} SNMP configurations...`
        });
        
        await connection.execute('DELETE FROM host_snmp_configs');
        
        for (const config of backupData.data.host_snmp_configs) {
          const { sql, values } = prepareInsert('host_snmp_configs', config);
          await connection.execute(sql, values);
        }
        processedItemCount += totalItems.host_snmp_configs;
        sendProgressUpdate(sessionId, {
          type: 'progress',
          progress: calculateProgress(processedItemCount),
          processedItems: { host_snmp_configs: totalItems.host_snmp_configs },
          message: `Processed ${totalItems.host_snmp_configs} SNMP configurations`
        });
      }
      
      // 9. Restore user settings
      if (backupData.data?.user_settings?.length > 0 || backupData.data?.settings?.length > 0) {
        const settings = backupData.data.user_settings || backupData.data.settings;
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
      }
      
      await connection.commit();
      
      // Create audit log for successful restore
      try {
        await createAuditLog(req.user?.id || null, 'restore_complete', {
          sessionId,
          totalItems,
          processedItemCount,
          duration: Date.now() - startTime
        });
      } catch (auditErr) {
        console.error('Failed to create audit log:', auditErr);
      }
      
      // Send completion
      sendProgressUpdate(sessionId, {
        type: 'complete',
        progress: 100,
        message: 'Restore completed successfully!',
        success: true
      });
      
      // Update session status
      const session = restoreSessions.get(sessionId);
      if (session) {
        session.status = 'complete';
      }
      
      console.log(`✅ Restore completed for session ${sessionId}`);
      
    } catch (error) {
      console.error(`❌ Restore error for session ${sessionId}:`, error);
      if (connection) await connection.rollback();
      
      sendProgressUpdate(sessionId, {
        type: 'error',
        message: `Error: ${error.message}`,
        success: false
      });
      
      const session = restoreSessions.get(sessionId);
      if (session) {
        session.status = 'error';
      }
    } finally {
      if (connection) connection.release();
    }
  });
});

module.exports = router;
module.exports.sendProgressUpdate = sendProgressUpdate;
module.exports.restoreSessions = restoreSessions;
