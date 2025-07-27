/**
 * Migration: Add proxy-specific fields to services table
 */

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('Services', 'url', {
            type: Sequelize.STRING,
            allowNull: true,
            comment: 'Full URL for HTTP/HTTPS services'
        });
        
        await queryInterface.addColumn('Services', 'hostname', {
            type: Sequelize.STRING,
            allowNull: true,
            comment: 'Hostname for proxy connections'
        });
        
        await queryInterface.addColumn('Services', 'username', {
            type: Sequelize.STRING,
            allowNull: true,
            comment: 'Username for service authentication'
        });
        
        await queryInterface.addColumn('Services', 'password', {
            type: Sequelize.STRING,
            allowNull: true,
            comment: 'Password for service authentication (encrypted)'
        });
        
        await queryInterface.addColumn('Services', 'privateKey', {
            type: Sequelize.TEXT,
            allowNull: true,
            comment: 'Private key for SSH authentication'
        });
        
        await queryInterface.addColumn('Services', 'passphrase', {
            type: Sequelize.STRING,
            allowNull: true,
            comment: 'Passphrase for private key'
        });
        
        await queryInterface.addColumn('Services', 'protocol', {
            type: Sequelize.STRING,
            allowNull: true,
            comment: 'Protocol type (vnc, rdp, etc.)'
        });
        
        await queryInterface.addColumn('Services', 'targetHost', {
            type: Sequelize.STRING,
            allowNull: true,
            comment: 'Target host for VNC/RDP connections'
        });
        
        await queryInterface.addColumn('Services', 'targetPort', {
            type: Sequelize.INTEGER,
            allowNull: true,
            comment: 'Target port for VNC/RDP connections'
        });
        
        await queryInterface.addColumn('Services', 'targetUsername', {
            type: Sequelize.STRING,
            allowNull: true,
            comment: 'Username for VNC/RDP target'
        });
        
        await queryInterface.addColumn('Services', 'targetPassword', {
            type: Sequelize.STRING,
            allowNull: true,
            comment: 'Password for VNC/RDP target (encrypted)'
        });
        
        await queryInterface.addColumn('Services', 'proxySettings', {
            type: Sequelize.JSON,
            allowNull: true,
            defaultValue: {},
            comment: 'Additional proxy-specific settings'
        });
        
        // Index für Performance
        await queryInterface.addIndex('Services', ['type']);
        await queryInterface.addIndex('Services', ['status']);
    },
    
    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('Services', 'url');
        await queryInterface.removeColumn('Services', 'hostname');
        await queryInterface.removeColumn('Services', 'username');
        await queryInterface.removeColumn('Services', 'password');
        await queryInterface.removeColumn('Services', 'privateKey');
        await queryInterface.removeColumn('Services', 'passphrase');
        await queryInterface.removeColumn('Services', 'protocol');
        await queryInterface.removeColumn('Services', 'targetHost');
        await queryInterface.removeColumn('Services', 'targetPort');
        await queryInterface.removeColumn('Services', 'targetUsername');
        await queryInterface.removeColumn('Services', 'targetPassword');
        await queryInterface.removeColumn('Services', 'proxySettings');
        
        await queryInterface.removeIndex('Services', ['type']);
        await queryInterface.removeIndex('Services', ['status']);
    }
};