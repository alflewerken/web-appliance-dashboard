const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Permission = sequelize.define('Permission', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    service_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'services',
            key: 'id'
        }
    },
    access_level: {
        type: DataTypes.ENUM('read', 'write', 'admin'),
        defaultValue: 'read'
    },
    granted_by: {
        type: DataTypes.INTEGER,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    granted_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'permissions',
    timestamps: true,
    underscored: true,
    indexes: [
        {
            unique: true,
            fields: ['user_id', 'service_id']
        }
    ]
});

// Class methods
Permission.checkUserServiceAccess = async function(userId, serviceId) {
    const permission = await this.findOne({
        where: {
            user_id: userId,
            service_id: serviceId
        }
    });
    return !!permission;
};

Permission.getUserServices = async function(userId) {
    return await this.findAll({
        where: { user_id: userId },
        include: [{
            model: sequelize.models.Service,
            as: 'service'
        }]
    });
};

module.exports = Permission;