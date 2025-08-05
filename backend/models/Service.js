const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Service = sequelize.define('Service', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    type: {
        type: DataTypes.STRING,
        allowNull: false
    },
    ip_address: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isIP: true
        }
    },
    port: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
            min: 1,
            max: 65535
        }
    },
    use_https: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    status: {
        type: DataTypes.ENUM('active', 'inactive', 'maintenance'),
        defaultValue: 'active'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    // SSH Connection Fields (existing)
    ssh_host: {
        type: DataTypes.STRING,
        allowNull: true
    },
    ssh_port: {
        type: DataTypes.INTEGER,
        defaultValue: 22
    },
    ssh_username: {
        type: DataTypes.STRING,
        allowNull: true
    },
    ssh_password: {
        type: DataTypes.STRING,
        allowNull: true
    },
    ssh_private_key: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    // VNC Fields (existing)
    vnc_port: {
        type: DataTypes.INTEGER,
        defaultValue: 5900
    },
    vnc_password: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // RDP Fields (existing)
    rdp_port: {
        type: DataTypes.INTEGER,
        defaultValue: 3389
    },
    rdp_username: {
        type: DataTypes.STRING,
        allowNull: true
    },
    rdp_password: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'services',
    timestamps: true,
    underscored: true
});

// Instance methods for transparent proxy
Service.prototype.getProxyUrl = function(path = '') {
    const port = this.port || 80;
    return `/api/proxy/${this.ip_address}:${port}/${path}`;
};

Service.prototype.getWebSocketUrl = function(path = '') {
    const port = this.port || 80;
    return `/api/wsProxy/${this.ip_address}:${port}/${path}`;
};

// Helper methods remain the same
Service.prototype.hasSSHAccess = function() {
    return !!(this.ssh_host && this.ssh_username);
};

Service.prototype.hasVNCAccess = function() {
    return !!this.vnc_port;
};

Service.prototype.hasRDPAccess = function() {
    return !!(this.rdp_port && this.rdp_username);
};

module.exports = Service;