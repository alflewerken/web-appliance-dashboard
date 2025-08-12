     summary: Generate Guacamole access token
 *     tags: [Guacamole]
 *     security:
 *       - bearerAuth: []
 *     description: Generate time-limited Guacamole access token for remote desktop.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - applianceId
 *             properties:
 *               applianceId:
 *                 type: integer
 *                 description: Appliance ID for remote desktop connection
 *     responses:
 *       200:
 *         description: Token generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: Temporary access token
 *                 url:
 *                   type: string
 *                   description: Guacamole connection URL
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *                   description: Token expiration time
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Appliance not found or remote desktop not configured
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/guacamole/validate/{token}:
 *   get:
 *     summary: Validate Guacamole token
 *     tags: [Guacamole]
 *     description: Validate a Guacamole access token.
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Access token to validate
 *     responses:
 *       200:
 *         description: Token is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                   example: true
 *                 applianceId:
 *                   type: integer
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Token is invalid or expired
 */

/**
 * @swagger
 * /api/guacamole/cleanup:
 *   post:
 *     summary: Cleanup expired tokens
 *     tags: [Guacamole]
 *     security:
 *       - bearerAuth: []
 *     description: Clean up expired Guacamole access tokens.
 *     responses:
 *       200:
 *         description: Cleanup completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cleaned:
 *                   type: integer
 *                   description: Number of tokens cleaned
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/backup:
 *   get:
 *     summary: Export backup
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Export a complete system backup including all data and configurations.
 *       
 *       **Included in backup**:
 *       - All appliances and their configurations
 *       - Categories
 *       - Users and roles
 *       - SSH hosts and keys (public only)
 *       - System settings
 *       - Background images
 *       - Audit logs
 *       
 *       **Example Usage**:
 *       ```bash
 *       curl -X GET http://localhost:9080/api/backup \
 *         -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *         -o backup-$(date +%Y%m%d-%H%M%S).json
 *       ```
 *     responses:
 *       200:
 *         description: Backup file
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 version:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                 data:
 *                   type: object
 *         headers:
 *           Content-Disposition:
 *             description: Attachment filename
 *             schema:
 *               type: string
 *               example: attachment; filename="backup-20240101-120000.json"
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Backup creation failed
 */

/**
 * @swagger
 * /api/backup/stats:
 *   get:
 *     summary: Get backup statistics
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 *     description: Get statistics about data that would be included in a backup.
 *     responses:
 *       200:
 *         description: Backup statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 appliances:
 *                   type: integer
 *                 categories:
 *                   type: integer
 *                 users:
 *                   type: integer
 *                 sshHosts:
 *                   type: integer
 *                 sshKeys:
 *                   type: integer
 *                 settings:
 *                   type: integer
 *                 auditLogs:
 *                   type: integer
 *                 backgroundImages:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/restore:
 *   post:
 *     summary: Restore from backup
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Restore system from a backup file.
 *       
 *       **Warning**: This will overwrite existing data based on the restore options.
 *       
 *       **JavaScript Example**:
 *       ```javascript
 *       const formData = new FormData();
 *       formData.append('backup', backupFile);
 *       formData.append('options', JSON.stringify({
 *         appliances: true,
 *         categories: true,
 *         users: false,
 *         settings: true
 *       }));
 *       
 *       const response = await fetch('http://localhost:9080/api/restore', {
 *         method: 'POST',
 *         headers: {
 *           'Authorization': `Bearer ${token}`
 *         },
 *         body: formData
 *       });
 *       ```
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               backup:
 *                 type: string
 *                 format: binary
 *                 description: Backup JSON file
 *               options:
 *                 type: string
 *                 description: JSON string with restore options
 *     responses:
 *       200:
 *         description: Restore completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Restore completed successfully"
 *                 restored:
 *                   type: object
 *                   properties:
 *                     appliances:
 *                       type: integer
 *                     categories:
 *                       type: integer
 *                     users:
 *                       type: integer
 *                     settings:
 *                       type: integer
 *       400:
 *         description: Invalid backup file
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Restore failed
 */

/**
 * @swagger
 * /api/backup/enhanced/create:
 *   post:
 *     summary: Create enhanced backup
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 *     description: Create a comprehensive backup with additional metadata.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *                 description: Optional backup description
 *               includeAuditLogs:
 *                 type: boolean
 *                 default: true
 *               includeSensitive:
 *                 type: boolean
 *                 default: false
 *                 description: Include sensitive data like encrypted passwords
 *     responses:
 *       200:
 *         description: Enhanced backup created
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/backup/enhanced/list:
 *   get:
 *     summary: List available backups
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 *     description: List all available backup files.
 *     responses:
 *       200:
 *         description: List of backups
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   filename:
 *                     type: string
 *                   size:
 *                     type: integer
 *                   created:
 *                     type: string
 *                     format: date-time
 *                   description:
 *                     type: string
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/backup/enhanced/download/{filename}:
 *   get:
 *     summary: Download backup file
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 *     description: Download a specific backup file.
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: Backup filename
 *     responses:
 *       200:
 *         description: Backup file
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Backup file not found
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/backup/enhanced/validate:
 *   post:
 *     summary: Validate backup file
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 *     description: Validate a backup file before restoration.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               backup:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Validation results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                 version:
 *                   type: string
 *                 created:
 *                   type: string
 *                 contents:
 *                   type: object
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Invalid backup file
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/backup/enhanced/restore:
 *   post:
 *     summary: Restore from enhanced backup
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 *     description: Restore from an enhanced backup with selective restoration.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               backup:
 *                 type: string
 *                 format: binary
 *               options:
 *                 type: string
 *                 description: JSON string with restore options
 *     responses:
 *       200:
 *         description: Restore completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 restored:
 *                   type: object
 *                 skipped:
 *                   type: object
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Restore failed
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/backup/enhanced/cleanup:
 *   post:
 *     summary: Cleanup old backups
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 *     description: Delete backups older than specified days.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               daysToKeep:
 *                 type: integer
 *                 default: 30
 *                 description: Keep backups newer than this many days
 *     responses:
 *       200:
 *         description: Cleanup completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deleted:
 *                   type: integer
 *                 remaining:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/backup/enhanced/status:
 *   get:
 *     summary: Get backup/restore status
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 *     description: Get current backup or restore operation status.
 *     responses:
 *       200:
 *         description: Operation status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 operation:
 *                   type: string
 *                   enum: [backup, restore, idle]
 *                 progress:
 *                   type: integer
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/auditLogs:
 *   get:
 *     summary: Get audit logs
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Retrieve audit logs with optional filtering and pagination.
 *       
 *       **Available Actions**:
 *       - `login`: User login
 *       - `logout`: User logout
 *       - `appliance_created`: Appliance creation
 *       - `appliance_updated`: Appliance modification
 *       - `appliance_deleted`: Appliance deletion
 *       - `category_created`: Category creation
 *       - `category_updated`: Category modification
 *       - `category_deleted`: Category deletion
 *       - `setting_updated`: Setting change
 *       - `backup_created`: Backup creation
 *       - `restore_completed`: System restore
 *       - `ssh_host_created`: SSH host creation
 *       - `ssh_host_updated`: SSH host modification
 *       - `ssh_host_deleted`: SSH host deletion
 *       
 *       **Example Usage**:
 *       ```python
 *       import requests
 *       
 *       params = {
 *           'limit': 50,
 *           'offset': 0,
 *           'action': 'appliance_created',
 *           'startDate': '2024-01-01',
 *           'endDate': '2024-12-31'
 *       }
 *       
 *       response = requests.get(
 *           'http://localhost:9080/api/auditLogs',
 *           headers={'Authorization': f'Bearer {token}'},
 *           params=params
 *       )
 *       ```
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Number of logs to retrieve
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Pagination offset
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter by action type
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *         description: Filter by user ID
 *       - in: query
 *         name: resourceType
 *         schema:
 *           type: string
 *         description: Filter by resource type
 *       - in: query
 *         name: resourceId
 *         schema:
 *           type: integer
 *         description: Filter by resource ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter logs after this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter logs before this date
 *     responses:
 *       200:
 *         description: Audit logs retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 logs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AuditLog'
 *                 total:
 *                   type: integer
 *                   description: Total number of logs
 *                   example: 150
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/auditLogs/export:
 *   get:
 *     summary: Export audit logs as CSV
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     description: Export audit logs in CSV format.
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Export logs after this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Export logs before this date
 *     responses:
 *       200:
 *         description: CSV file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *         headers:
 *           Content-Disposition:
 *             description: Attachment filename
 *             schema:
 *               type: string
 *               example: attachment; filename="audit-logs-20240101.csv"
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/auditLogs/{resourceType}/{resourceId}:
 *   get:
 *     summary: Get audit logs for resource
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     description: Get audit logs for a specific resource.
 *     parameters:
 *       - in: path
 *         name: resourceType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [appliance, category, user, ssh_host, setting]
 *         description: Resource type
 *       - in: path
 *         name: resourceId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Resource ID
 *     responses:
 *       200:
 *         description: Resource audit logs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/AuditLog'
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/auditLogs/history/{resourceType}/{resourceId}:
 *   get:
 *     summary: Get resource history
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     description: Get complete change history for a resource.
 *     parameters:
 *       - in: path
 *         name: resourceType
 *         required: true
 *         schema:
 *           type: string
 *         description: Resource type
 *       - in: path
 *         name: resourceId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Resource ID
 *     responses:
 *       200:
 *         description: Resource history
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/auditLogs/ssh-hosts/{hostId}:
 *   get:
 *     summary: Get SSH host audit logs
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     description: Get audit logs for a specific SSH host.
 *     parameters:
 *       - in: path
 *         name: hostId
 *         required: true
 *         schema:
 *           type: integer
 *         description: SSH host ID
 *     responses:
 *       200:
 *         description: SSH host audit logs
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/auditLogs:
 *   delete:
 *     summary: Delete audit logs
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     description: Delete selected audit logs (admin only).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Array of audit log IDs to delete
 *     responses:
 *       200:
 *         description: Logs deleted successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin only
 */

/**
 * @swagger
 * /api/auditRestore/{id}:
 *   get:
 *     summary: Get audit log restore details
 *     tags: [Audit Restore]
 *     security:
 *       - bearerAuth: []
 *     description: Get detailed information about an audit log entry for restoration.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Audit log ID
 *     responses:
 *       200:
 *         description: Audit log details with restore options
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 log:
 *                   $ref: '#/components/schemas/AuditLog'
 *                 canRestore:
 *                   type: boolean
 *                 canRevert:
 *                   type: boolean
 *                 restoreOptions:
 *                   type: object
 *       404:
 *         description: Audit log not found
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/auditRestore/restore/{type}/{logId}:
 *   post:
 *     summary: Restore deleted resource
 *     tags: [Audit Restore]
 *     security:
 *       - bearerAuth: []
 *     description: Restore a deleted resource from audit log.
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [appliances, categories, users, services, ssh-hosts]
 *         description: Resource type
 *       - in: path
 *         name: logId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Audit log ID
 *     responses:
 *       200:
 *         description: Resource restored successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 restoredId:
 *                   type: integer
 *       400:
 *         description: Cannot restore - resource may already exist
 *       404:
 *         description: Audit log not found
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/auditRestore/revert/{type}/{logId}:
 *   post:
 *     summary: Revert resource to previous state
 *     tags: [Audit Restore]
 *     security:
 *       - bearerAuth: []
 *     description: Revert a resource to its state from a specific audit log entry.
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [appliances, categories, users, services, ssh-hosts]
 *         description: Resource type
 *       - in: path
 *         name: logId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Audit log ID
 *     responses:
 *       200:
 *         description: Resource reverted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Cannot revert - invalid operation
 *       404:
 *         description: Resource or audit log not found
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/background/upload:
 *   post:
 *     summary: Upload background image
 *     tags: [Background]
 *     security:
 *       - bearerAuth: []
 *     description: Upload a new background image.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Image file (JPEG, PNG, WebP)
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 filename:
 *                   type: string
 *                 url:
 *                   type: string
 *       400:
 *         description: Invalid image file
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/background/current:
 *   get:
 *     summary: Get current background
 *     tags: [Background]
 *     security:
 *       - bearerAuth: []
 *     description: Get the currently active background image.
 *     responses:
 *       200:
 *         description: Current background information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 filename:
 *                   type: string
 *                 url:
 *                   type: string
 *                 isActive:
 *                   type: boolean
 *       404:
 *         description: No background set
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/background/list:
 *   get:
 *     summary: List all backgrounds
 *     tags: [Background]
 *     security:
 *       - bearerAuth: []
 *     description: Get a list of all uploaded background images.
 *     responses:
 *       200:
 *         description: List of background images
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   filename:
 *                     type: string
 *                   url:
 *                     type: string
 *                   isActive:
 *                     type: boolean
 *                   uploadedAt:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/background/set/{id}:
 *   post:
 *     summary: Set active background
 *     tags: [Background]
 *     security:
 *       - bearerAuth: []
 *     description: Set a specific background image as active.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Background image ID
 *     responses:
 *       200:
 *         description: Background set successfully
 *       404:
 *         description: Background not found
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/background/{id}:
 *   delete:
 *     summary: Delete background image
 *     tags: [Background]
 *     security:
 *       - bearerAuth: []
 *     description: Delete a background image.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Background image ID
 *     responses:
 *       200:
 *         description: Background deleted successfully
 *       404:
 *         description: Background not found
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/background/disable:
 *   post:
 *     summary: Disable background
 *     tags: [Background]
 *     security:
 *       - bearerAuth: []
 *     description: Disable the current background image.
 *     responses:
 *       200:
 *         description: Background disabled
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/browser/open:
 *   post:
 *     summary: Open URL in browser
 *     tags: [Browser]
 *     security:
 *       - bearerAuth: []
 *     description: Open a URL in the system's default browser.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *                 description: URL to open
 *                 example: https://example.com
 *     responses:
 *       200:
 *         description: URL opened successfully
 *       400:
 *         description: Invalid URL
 *       500:
 *         description: Failed to open URL
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/statusCheck:
 *   post:
 *     summary: Check appliance status
 *     tags: [Status]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Check the online status of one or more appliances.
 *       
 *       **Response includes**:
 *       - `status`: online, offline, or error
 *       - `responseTime`: Time taken to check (ms)
 *       - `error`: Error message if check failed
 *       - `lastChecked`: Timestamp of check
 *       
 *       **JavaScript Example**:
 *       ```javascript
 *       const response = await fetch('http://localhost:9080/api/statusCheck', {
 *         method: 'POST',
 *         headers: {
 *           'Authorization': `Bearer ${token}`,
 *           'Content-Type': 'application/json'
 *         },
 *         body: JSON.stringify({ applianceIds: [1, 2, 3] })
 *       });
 *       
 *       const statuses = await response.json();
 *       // Result: { "1": { status: "online", responseTime: 145 }, ... }
 *       ```
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StatusCheckRequest'
 *     responses:
 *       200:
 *         description: Status check results
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StatusCheckResponse'
 *             example:
 *               "1":
 *                 status: "online"
 *                 responseTime: 145
 *                 lastChecked: "2024-01-01T00:00:00Z"
 *               "2":
 *                 status: "offline"
 *                 error: "Connection refused"
 *                 lastChecked: "2024-01-01T00:00:00Z"
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/statusCheck/force:
 *   post:
 *     summary: Force immediate status check
 *     tags: [Status]
 *     security:
 *       - bearerAuth: []
 *     description: Force an immediate status check for all appliances.
 *     responses:
 *       200:
 *         description: Status check initiated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Status check initiated"
 *                 applianceCount:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/statusCheck/info:
 *   get:
 *     summary: Get status checker info
 *     tags: [Status]
 *     security:
 *       - bearerAuth: []
 *     description: Get information about the status checker service.
 *     responses:
 *       200:
 *         description: Status checker information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isRunning:
 *                   type: boolean
 *                 checkInterval:
 *                   type: integer
 *                 lastCheck:
 *                   type: string
 *                   format: date-time
 *                 nextCheck:
 *                   type: string
 *                   format: date-time
 *                 applianceCount:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/statusCheck/cache/clear:
 *   post:
 *     summary: Clear status cache
 *     tags: [Status]
 *     security:
 *       - bearerAuth: []
 *     description: Clear the appliance status cache.
 *     responses:
 *       200:
 *         description: Cache cleared successfully
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/auth/users:
 *   get:
 *     summary: Get all users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     description: Get all users (admin only).
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   username:
 *                     type: string
 *                   email:
 *                     type: string
 *                   role:
 *                     type: string
 *                   isActive:
 *                     type: boolean
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin only
 */

/**
 * @swagger
 * /api/auth/users:
 *   post:
 *     summary: Create new user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     description: Create a new user (admin only).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *               - email
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 8
 *               email:
 *                 type: string
 *                 format: email
 *               role:
 *                 type: string
 *                 enum: [user, admin]
 *                 default: user
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Invalid data or user already exists
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin only
 */

/**
 * @swagger
 * /api/auth/users/{id}:
 *   put:
 *     summary: Update user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     description: Update user information (admin only).
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               role:
 *                 type: string
 *               password:
 *                 type: string
 *                 description: New password (optional)
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         description: Invalid data
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin only
 */

/**
 * @swagger
 * /api/auth/users/{id}/toggle-active:
 *   put:
 *     summary: Toggle user active status
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     description: Enable or disable a user account (admin only).
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User status toggled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isActive:
 *                   type: boolean
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin only
 */

/**
 * @swagger
 * /api/auth/users/{id}:
 *   delete:
 *     summary: Delete user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     description: Delete a user account (admin only).
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       400:
 *         description: Cannot delete last admin user
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin only
 */

/**
 * @swagger
 * /api/roles:
 *   get:
 *     summary: Get all roles
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     description: Get all available roles with their permissions.
 *     responses:
 *       200:
 *         description: List of roles
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   displayName:
 *                     type: string
 *                   permissions:
 *                     type: array
 *                     items:
 *                       type: string
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/roles/users:
 *   get:
 *     summary: Get users with roles
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     description: Get all users with enhanced role information.
 *     responses:
 *       200:
 *         description: List of users with role details
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin only
 */

/**
 * @swagger
 * /api/roles/users/{userId}/role:
 *   put:
 *     summary: Update user role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     description: Update a user's role (admin only).
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [user, admin]
 *     responses:
 *       200:
 *         description: Role updated successfully
 *       400:
 *         description: Invalid role or cannot change last admin
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin only
 */

/**
 * @swagger
 * /api/roles/users/{userId}/appliances:
 *   get:
 *     summary: Get user appliance permissions
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     description: Get appliance permissions for a specific user.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User appliance permissions
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin only
 */

/**
 * @swagger
 * /api/roles/users/{userId}/appliances/{applianceId}:
 *   put:
 *     summary: Update appliance permission
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     description: Update appliance permissions for a user.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *       - in: path
 *         name: applianceId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Appliance ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               canView:
 *                 type: boolean
 *               canEdit:
 *                 type: boolean
 *               canDelete:
 *                 type: boolean
 *               canControl:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Permissions updated successfully
 *       404:
 *         description: User or appliance not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin only
 */

/**
 * @swagger
 * /api/roles/appliances/visibility:
 *   get:
 *     summary: Get appliance visibility
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     description: Get visibility settings for all appliances.
 *     responses:
 *       200:
 *         description: Appliance visibility settings
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin only
 */

/**
 * @swagger
 * /api/roles/appliances/{applianceId}/visibility:
 *   put:
 *     summary: Update appliance visibility
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     description: Update visibility settings for an appliance.
 *     parameters:
 *       - in: path
 *         name: applianceId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Appliance ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isPublic:
 *                 type: boolean
 *                 description: Whether appliance is visible to all users
 *               visibleToRoles:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Specific roles that can see this appliance
 *     responses:
 *       200:
 *         description: Visibility updated successfully
 *       404:
 *         description: Appliance not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin only
 */

/**
 * @swagger
 * /api/roles/stats:
 *   get:
 *     summary: Get role statistics
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     description: Get statistics about roles and permissions.
 *     responses:
 *       200:
 *         description: Role statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalUsers:
 *                   type: integer
 *                 roleDistribution:
 *                   type: object
 *                 permissionStats:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin only
 */

/**
 * @swagger
 * /api/sse:
 *   get:
 *     summary: Subscribe to server-sent events
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Subscribe to real-time updates via Server-Sent Events (SSE).
 *       
 *       **Event Types**:
 *       - `appliance`: Appliance created/updated/deleted
 *       - `status`: Status check results
 *       - `service`: Service status changes
 *       - `setting`: Setting updates
 *       - `category`: Category changes
 *       - `ssh`: SSH connection updates
 *       - `backup`: Backup/restore progress
 *       
 *       **JavaScript Example**:
 *       ```javascript
 *       const eventSource = new EventSource(
 *         `http://localhost:9080/api/sse?token=${token}`
 *       );
 *       
 *       eventSource.onmessage = (event) => {
 *         const data = JSON.parse(event.data);
 *         console.log('Update:', data);
 *       };
 *       
 *       eventSource.onerror = (error) => {
 *         console.error('SSE Error:', error);
 *         eventSource.close();
 *       };
 *       ```
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: JWT authentication token
 *     responses:
 *       200:
 *         description: SSE stream established
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               example: |
 *                 data: {"type": "appliance", "action": "created", "data": {...}}
 *                 
 *                 data: {"type": "status", "applianceId": 1, "status": "online"}
 *       401:
 *         description: Unauthorized - Invalid token
 */

module.exports = {};
