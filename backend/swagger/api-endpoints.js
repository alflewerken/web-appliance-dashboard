/**
 * @swagger
 * tags:
 *   - name: Authentication
 *     description: User authentication endpoints
 *   - name: Appliances
 *     description: Appliance management endpoints
 *   - name: Categories
 *     description: Category management endpoints
 *   - name: Services
 *     description: System service management
 *   - name: Settings
 *     description: System settings management
 *   - name: SSH
 *     description: SSH key management
 *   - name: Backup
 *     description: Backup and restore operations
 *   - name: Audit
 *     description: Audit log endpoints
 *   - name: Status
 *     description: Status check endpoints
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authenticate user and get JWT token
 *     tags: [Authentication]
 *     description: |
 *       Login with username and password to receive a JWT token for authenticated requests.
 *       
 *       **Rate Limiting**: 20 requests per 15 minutes per IP address
 *       
 *       **Example Usage**:
 *       ```bash
 *       curl -X POST http://localhost:3001/api/auth/login \
 *         -H "Content-Type: application/json" \
 *         -d '{"username":"admin","password":"password123"}'
 *       ```
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *           examples:
 *             admin:
 *               summary: Admin login
 *               value:
 *                 username: admin
 *                 password: password123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *             example:
 *               token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *               user:
 *                 id: 1
 *                 username: admin
 *       400:
 *         description: Bad request - missing credentials
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Too many login attempts
 *         headers:
 *           RateLimit-Limit:
 *             description: Request limit per window
 *             schema:
 *               type: integer
 *           RateLimit-Remaining:
 *             description: Remaining requests in window
 *             schema:
 *               type: integer
 *           RateLimit-Reset:
 *             description: Time when the rate limit resets
 *             schema:
 *               type: integer
 */

/**
 * @swagger
 * /api/appliances:
 *   get:
 *     summary: Get all appliances
 *     tags: [Appliances]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Retrieve all configured appliances with their complete details.
 *       
 *       **Example Usage**:
 *       ```bash
 *       curl -X GET http://localhost:3001/api/appliances \
 *         -H "Authorization: Bearer YOUR_JWT_TOKEN"
 *       ```
 *     responses:
 *       200:
 *         description: List of all appliances
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Appliance'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/appliances:
 *   post:
 *     summary: Create a new appliance
 *     tags: [Appliances]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Create a new appliance with the provided configuration.
 *       
 *       **Example Usage**:
 *       ```javascript
 *       const response = await fetch('http://localhost:3001/api/appliances', {
 *         method: 'POST',
 *         headers: {
 *           'Authorization': `Bearer ${token}`,
 *           'Content-Type': 'application/json'
 *         },
 *         body: JSON.stringify({
 *           name: 'New Server',
 *           url: 'http://192.168.1.101:8080',
 *           icon: 'Server',
 *           category: 'development'
 *         })
 *       });
 *       ```
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApplianceCreateRequest'
 *           examples:
 *             complete:
 *               $ref: '#/components/examples/ApplianceExample'
 *             minimal:
 *               $ref: '#/components/examples/ApplianceMinimalExample'
 *     responses:
 *       201:
 *         description: Appliance created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Appliance'
 *       400:
 *         description: Bad request - Invalid data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/appliances/{id}:
 *   put:
 *     summary: Update an appliance
 *     tags: [Appliances]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Update an existing appliance. Only provided fields will be updated.
 *       
 *       **Python Example**:
 *       ```python
 *       import requests
 *       
 *       response = requests.put(
 *           f'http://localhost:3001/api/appliances/{appliance_id}',
 *           headers={'Authorization': f'Bearer {token}'},
 *           json={'name': 'Updated Name', 'description': 'New description'}
 *       )
 *       ```
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The appliance ID
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Updated Server Name"
 *               url:
 *                 type: string
 *                 example: "http://new-url.com"
 *               description:
 *                 type: string
 *                 example: "Updated description"
 *               icon:
 *                 type: string
 *                 example: "Database"
 *               color:
 *                 type: string
 *                 example: "#FF0000"
 *               category:
 *                 type: string
 *                 example: "productivity"
 *     responses:
 *       200:
 *         description: Appliance updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Appliance'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Appliance not found
 */

/**
 * @swagger
 * /api/appliances/{id}:
 *   delete:
 *     summary: Delete an appliance
 *     tags: [Appliances]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Delete an appliance by ID.
 *       
 *       **Example Usage**:
 *       ```bash
 *       curl -X DELETE http://localhost:3001/api/appliances/1 \
 *         -H "Authorization: Bearer YOUR_JWT_TOKEN"
 *       ```
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The appliance ID to delete
 *         example: 1
 *     responses:
 *       200:
 *         description: Appliance deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Appliance deleted successfully"
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Appliance not found
 */

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Get all categories with appliance counts
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Retrieve all categories including system and custom categories, with count of appliances in each.
 *       
 *       **Example Response**:
 *       ```json
 *       [
 *         {
 *           "id": 1,
 *           "name": "productivity",
 *           "display_name": "Productivity",
 *           "icon": "Briefcase",
 *           "color": "#007AFF",
 *           "order_index": 0,
 *           "is_system": true,
 *           "applianceCount": 5
 *         }
 *       ]
 *       ```
 *     responses:
 *       200:
 *         description: List of all categories
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Category'
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/services:
 *   get:
 *     summary: Get all system services
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Retrieve all configured system services with their current status.
 *       
 *       **JavaScript Example**:
 *       ```javascript
 *       const response = await fetch('http://localhost:3001/api/services', {
 *         headers: { 'Authorization': `Bearer ${token}` }
 *       });
 *       const services = await response.json();
 *       ```
 *     responses:
 *       200:
 *         description: List of all services
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Service'
 */

/**
 * @swagger
 * /api/services/{name}/{action}:
 *   post:
 *     summary: Control a system service
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Start, stop, or restart a system service.
 *       
 *       **Example Usage**:
 *       ```bash
 *       # Start nginx
 *       curl -X POST http://localhost:3001/api/services/nginx/start \
 *         -H "Authorization: Bearer YOUR_JWT_TOKEN"
 *       
 *       # Stop nginx
 *       curl -X POST http://localhost:3001/api/services/nginx/stop \
 *         -H "Authorization: Bearer YOUR_JWT_TOKEN"
 *       
 *       # Restart nginx
 *       curl -X POST http://localhost:3001/api/services/nginx/restart \
 *         -H "Authorization: Bearer YOUR_JWT_TOKEN"
 *       ```
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Service name
 *         example: nginx
 *       - in: path
 *         name: action
 *         required: true
 *         schema:
 *           type: string
 *           enum: [start, stop, restart]
 *         description: Action to perform
 *         example: restart
 *     responses:
 *       200:
 *         description: Service action completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Service nginx restarted successfully"
 *                 status:
 *                   type: string
 *                   example: "running"
 *       400:
 *         description: Invalid action
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Service not found
 *       500:
 *         description: Failed to perform action
 */

/**
 * @swagger
 * /api/settings:
 *   get:
 *     summary: Get all system settings
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Retrieve all system settings as key-value pairs.
 *       
 *       **Python Example**:
 *       ```python
 *       import requests
 *       
 *       response = requests.get(
 *           'http://localhost:3001/api/settings',
 *           headers={'Authorization': f'Bearer {token}'}
 *       )
 *       settings = response.json()
 *       settings_dict = {s['key']: s['value'] for s in settings}
 *       ```
 *     responses:
 *       200:
 *         description: List of all settings
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Setting'
 *             example:
 *               - key: "ssh_enabled"
 *                 value: "true"
 *               - key: "terminal_enabled"
 *                 value: "true"
 *               - key: "default_theme"
 *                 value: "dark"
 */

/**
 * @swagger
 * /api/settings/{key}:
 *   put:
 *     summary: Update a system setting
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Update a specific system setting value.
 *       
 *       **Available Settings**:
 *       - `ssh_enabled`: Enable/disable SSH functionality
 *       - `terminal_enabled`: Enable/disable terminal access
 *       - `default_theme`: Set default UI theme
 *       
 *       **Example Usage**:
 *       ```javascript
 *       await fetch('http://localhost:3001/api/settings/ssh_enabled', {
 *         method: 'PUT',
 *         headers: {
 *           'Authorization': `Bearer ${token}`,
 *           'Content-Type': 'application/json'
 *         },
 *         body: JSON.stringify({ value: 'false' })
 *       });
 *       ```
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: Setting key to update
 *         example: ssh_enabled
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SettingUpdateRequest'
 *     responses:
 *       200:
 *         description: Setting updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Setting'
 *       400:
 *         description: Invalid value
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Setting not found
 */

/**
 * @swagger
 * /api/ssh/keys:
 *   get:
 *     summary: Get all SSH keys
 *     tags: [SSH]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Retrieve all stored SSH public keys.
 *       
 *       **Note**: Private keys are never returned by this endpoint.
 *     responses:
 *       200:
 *         description: List of SSH keys
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SSHKey'
 */

/**
 * @swagger
 * /api/ssh/keys/generate:
 *   post:
 *     summary: Generate a new SSH key pair
 *     tags: [SSH]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Generate a new SSH key pair. The private key is returned only once during generation.
 *       
 *       **Important**: Save the private key securely as it cannot be retrieved again.
 *       
 *       **Python Example**:
 *       ```python
 *       import requests
 *       
 *       response = requests.post(
 *           'http://localhost:3001/api/ssh/keys/generate',
 *           headers={'Authorization': f'Bearer {token}'},
 *           json={'name': 'Production Key', 'passphrase': ''}
 *       )
 *       
 *       key_data = response.json()
 *       # Save private key securely
 *       with open('production_key.pem', 'w') as f:
 *           f.write(key_data['privateKey'])
 *       ```
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SSHKeyGenerateRequest'
 *     responses:
 *       201:
 *         description: SSH key pair generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SSHKeyGenerateResponse'
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/backup:
 *   post:
 *     summary: Create a system backup
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Create a complete system backup including:
 *       - All appliance configurations
 *       - Categories
 *       - Settings
 *       - SSH keys (public only)
 *       - Background images
 *       
 *       **Example Usage**:
 *       ```bash
 *       curl -X POST http://localhost:3001/api/backup \
 *         -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 *         -o backup-$(date +%Y%m%d-%H%M%S).tar.gz
 *       ```
 *     responses:
 *       200:
 *         description: Backup file created
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *         headers:
 *           Content-Disposition:
 *             description: Attachment filename
 *             schema:
 *               type: string
 *               example: attachment; filename="backup-20240101-120000.tar.gz"
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Backup creation failed
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
 *       **Warning**: This will overwrite existing data.
 *       
 *       **JavaScript Example**:
 *       ```javascript
 *       const formData = new FormData();
 *       formData.append('backup', backupFile);
 *       
 *       const response = await fetch('http://localhost:3001/api/restore', {
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
 *                 description: Backup tar.gz file
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
 *                 stats:
 *                   type: object
 *                   properties:
 *                     appliances:
 *                       type: integer
 *                       example: 15
 *                     categories:
 *                       type: integer
 *                       example: 5
 *                     settings:
 *                       type: integer
 *                       example: 10
 *       400:
 *         description: Invalid backup file
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Restore failed
 */

/**
 * @swagger
 * /api/audit-logs:
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
 *       - `setting_updated`: Setting change
 *       - `backup_created`: Backup creation
 *       - `restore_completed`: System restore
 *       
 *       **Example Usage**:
 *       ```python
 *       import requests
 *       
 *       params = {
 *           'limit': 50,
 *           'offset': 0,
 *           'action': 'appliance_created'
 *       }
 *       
 *       response = requests.get(
 *           'http://localhost:3001/api/audit-logs',
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
 * /api/status-check:
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
 *       const response = await fetch('http://localhost:3001/api/status-check', {
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
 *       
 *       **JavaScript Example**:
 *       ```javascript
 *       const eventSource = new EventSource(
 *         `http://localhost:3001/api/sse?token=${token}`
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
