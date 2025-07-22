const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Web Appliance Dashboard API',
      version: '1.0.4',
      description: `
# Web Appliance Dashboard API

A comprehensive API for managing web appliances, services, and system configurations.

## Authentication
All endpoints (except \`/api/auth/login\`) require JWT authentication. Include the token in the Authorization header:
\`\`\`
Authorization: Bearer YOUR_JWT_TOKEN
\`\`\`

## Quick Start
1. Login to get a JWT token
2. Use the token for authenticated requests
3. Check the examples for each endpoint below

## Rate Limiting
- Login endpoint: 20 requests per 15 minutes per IP
- Other endpoints: No rate limiting by default

## Example Code
Check the enhanced documentation at \`/backend/swagger/enhanced-api-docs.md\` for complete examples in curl, Python, and JavaScript.
      `,
      contact: {
        name: 'alflewerken',
        url: 'https://github.com/alflewerken/web-appliance-dashboard',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://192.168.178.70:9080',
        description: 'Production server',
      },
      {
        url: 'http://localhost:9080',
        description: 'Development server (via nginx)',
      },
      {
        url: '',
        description: 'Relative URL (current host)',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter the JWT token obtained from /api/auth/login',
        },
      },
      schemas: {
        Appliance: {
          type: 'object',
          required: ['name', 'url'],
          properties: {
            id: {
              type: 'integer',
              description: 'The appliance ID',
              example: 1,
            },
            name: {
              type: 'string',
              description: 'The appliance name',
              example: 'My Server',
            },
            url: {
              type: 'string',
              description: 'The appliance URL',
              example: 'http://192.168.1.100:8080',
            },
            description: {
              type: 'string',
              description: 'The appliance description',
              example: 'Main production server',
            },
            icon: {
              type: 'string',
              description: 'Icon name for the appliance',
              example: 'Server',
            },
            color: {
              type: 'string',
              description: 'Color code for the appliance',
              example: '#007AFF',
            },
            category: {
              type: 'string',
              description: 'Category of the appliance',
              example: 'productivity',
            },
            isFavorite: {
              type: 'boolean',
              description: 'Whether the appliance is marked as favorite',
              example: false,
            },
            startCommand: {
              type: 'string',
              description: 'Command to start the appliance',
              example: 'systemctl start myservice',
            },
            stopCommand: {
              type: 'string',
              description: 'Command to stop the appliance',
              example: 'systemctl stop myservice',
            },
            statusCommand: {
              type: 'string',
              description: 'Command to check appliance status',
              example: 'systemctl status myservice',
            },
            autoStart: {
              type: 'boolean',
              description: 'Whether to auto-start the appliance',
              example: false,
            },
            sshConnection: {
              type: 'string',
              description: 'SSH connection string',
              example: 'user@192.168.1.100',
            },
            transparency: {
              type: 'number',
              description: 'UI transparency level',
              example: 0.85,
            },
            blurAmount: {
              type: 'integer',
              description: 'UI blur amount',
              example: 10,
            },
            openModeMini: {
              type: 'string',
              description: 'Open mode for mini view',
              example: 'new_tab',
            },
            openModeMobile: {
              type: 'string',
              description: 'Open mode for mobile view',
              example: 'new_tab',
            },
            openModeDesktop: {
              type: 'string',
              description: 'Open mode for desktop view',
              example: 'new_tab',
            },
            remoteDesktopEnabled: {
              type: 'boolean',
              description: 'Whether remote desktop is enabled',
              example: false,
            },
            remoteProtocol: {
              type: 'string',
              description: 'Remote desktop protocol',
              example: 'vnc',
            },
            remoteHost: {
              type: 'string',
              description: 'Remote desktop host',
              example: '192.168.1.100',
            },
            remotePort: {
              type: 'integer',
              description: 'Remote desktop port',
              example: 5900,
            },
            remoteUsername: {
              type: 'string',
              description: 'Remote desktop username',
              example: 'admin',
            },
          },
        },
        ApplianceCreateRequest: {
          type: 'object',
          required: ['name', 'url'],
          properties: {
            name: {
              type: 'string',
              description: 'The appliance name',
              example: 'New Server',
            },
            url: {
              type: 'string',
              description: 'The appliance URL',
              example: 'http://192.168.1.101:8080',
            },
            description: {
              type: 'string',
              description: 'The appliance description',
              example: 'Development server',
            },
            icon: {
              type: 'string',
              description: 'Icon name for the appliance',
              example: 'Server',
            },
            color: {
              type: 'string',
              description: 'Color code for the appliance',
              example: '#FF5733',
            },
            category: {
              type: 'string',
              description: 'Category of the appliance',
              example: 'development',
            },
          },
          example: {
            name: 'New Server',
            url: 'http://192.168.1.101:8080',
            description: 'Development server',
            icon: 'Server',
            color: '#FF5733',
            category: 'development',
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
              example: 'Failed to fetch appliances',
            },
            details: {
              type: 'string',
              description: 'Additional error details (development only)',
              example: 'Database connection failed',
            },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: {
              type: 'string',
              description: 'Username',
              example: 'admin',
            },
            password: {
              type: 'string',
              description: 'Password',
              example: 'password123',
            },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              description: 'JWT authentication token',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
            user: {
              type: 'object',
              properties: {
                id: {
                  type: 'integer',
                  example: 1,
                },
                username: {
                  type: 'string',
                  example: 'admin',
                },
              },
            },
          },
        },
        Category: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'The category ID',
              example: 1,
            },
            name: {
              type: 'string',
              description: 'The category identifier',
              example: 'productivity',
            },
            display_name: {
              type: 'string',
              description: 'The display name',
              example: 'Productivity',
            },
            icon: {
              type: 'string',
              description: 'Icon name',
              example: 'Briefcase',
            },
            color: {
              type: 'string',
              description: 'Color code',
              example: '#007AFF',
            },
            order_index: {
              type: 'integer',
              description: 'Display order',
              example: 0,
            },
            is_system: {
              type: 'boolean',
              description: 'Whether this is a system category',
              example: true,
            },
            applianceCount: {
              type: 'integer',
              description: 'Number of appliances in this category',
              example: 5,
            },
          },
        },
        Service: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'The service ID',
              example: 1,
            },
            name: {
              type: 'string',
              description: 'Service name',
              example: 'nginx',
            },
            displayName: {
              type: 'string',
              description: 'Display name',
              example: 'Nginx Web Server',
            },
            status: {
              type: 'string',
              enum: ['running', 'stopped', 'unknown'],
              description: 'Service status',
              example: 'running',
            },
            isEnabled: {
              type: 'boolean',
              description: 'Whether service is enabled',
              example: true,
            },
          },
        },
        Setting: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description: 'Setting key',
              example: 'ssh_enabled',
            },
            value: {
              type: 'string',
              description: 'Setting value',
              example: 'true',
            },
          },
        },
        SettingUpdateRequest: {
          type: 'object',
          required: ['value'],
          properties: {
            value: {
              type: 'string',
              description: 'New setting value',
              example: 'false',
            },
          },
        },
        SSHKey: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'SSH key ID',
              example: 1,
            },
            name: {
              type: 'string',
              description: 'Key name',
              example: 'Production Server Key',
            },
            publicKey: {
              type: 'string',
              description: 'Public key content',
              example: 'ssh-rsa AAAAB3NzaC1yc2...',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
              example: '2024-01-01T00:00:00Z',
            },
          },
        },
        SSHKeyGenerateRequest: {
          type: 'object',
          required: ['name'],
          properties: {
            name: {
              type: 'string',
              description: 'Key name',
              example: 'New SSH Key',
            },
            passphrase: {
              type: 'string',
              description: 'Optional passphrase for the key',
              example: '',
            },
          },
        },
        SSHKeyGenerateResponse: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 2,
            },
            name: {
              type: 'string',
              example: 'New SSH Key',
            },
            publicKey: {
              type: 'string',
              example: 'ssh-rsa AAAAB3NzaC1yc2...',
            },
            privateKey: {
              type: 'string',
              description: 'Private key (only returned once during generation)',
              example: '-----BEGIN OPENSSH PRIVATE KEY-----\n...',
            },
          },
        },
        AuditLog: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Audit log ID',
              example: 1,
            },
            userId: {
              type: 'integer',
              description: 'User ID who performed the action',
              example: 1,
            },
            username: {
              type: 'string',
              description: 'Username who performed the action',
              example: 'admin',
            },
            action: {
              type: 'string',
              description: 'Action performed',
              example: 'appliance_created',
            },
            resourceType: {
              type: 'string',
              description: 'Type of resource affected',
              example: 'appliance',
            },
            resourceId: {
              type: 'integer',
              description: 'ID of affected resource',
              example: 42,
            },
            details: {
              type: 'object',
              description: 'Additional action details',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'When the action occurred',
              example: '2024-01-01T00:00:00Z',
            },
          },
        },
        StatusCheckRequest: {
          type: 'object',
          required: ['applianceIds'],
          properties: {
            applianceIds: {
              type: 'array',
              items: {
                type: 'integer',
              },
              description: 'Array of appliance IDs to check',
              example: [1, 2, 3],
            },
          },
        },
        StatusCheckResponse: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['online', 'offline', 'error'],
                example: 'online',
              },
              responseTime: {
                type: 'integer',
                description: 'Response time in milliseconds',
                example: 145,
              },
              error: {
                type: 'string',
                description: 'Error message if status check failed',
                example: 'Connection refused',
              },
              lastChecked: {
                type: 'string',
                format: 'date-time',
                example: '2024-01-01T00:00:00Z',
              },
            },
          },
        },
      },
      examples: {
        LoginExample: {
          summary: 'Login example',
          value: {
            username: 'admin',
            password: 'password123',
          },
        },
        ApplianceExample: {
          summary: 'Complete appliance example',
          value: {
            name: 'Production Server',
            url: 'https://prod.example.com',
            description: 'Main production web server',
            icon: 'Server',
            color: '#007AFF',
            category: 'productivity',
            statusCommand: 'systemctl status nginx',
            sshConnection: 'deploy@prod.example.com',
            autoStart: true,
          },
        },
        ApplianceMinimalExample: {
          summary: 'Minimal appliance example',
          value: {
            name: 'Test Server',
            url: 'http://localhost:8080',
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./routes/*.js', './routes/debug/*.js', './swagger/api-endpoints.js', './swagger/enhanced-swagger-docs.js'], // Path to the API routes
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = {
  swaggerUi,
  swaggerSpec,
};
