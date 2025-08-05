module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add remote_desktop_type to appliances table
    await queryInterface.addColumn('appliances', 'remote_desktop_type', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'guacamole',
      comment: 'Type of remote desktop: guacamole or rustdesk'
    });

    // Add rustdesk_id to appliances table (for tracking installation)
    await queryInterface.addColumn('appliances', 'rustdesk_id', {
      type: Sequelize.STRING(20),
      allowNull: true,
      comment: 'RustDesk ID after installation'
    });

    // Add rustdesk_installed to appliances table
    await queryInterface.addColumn('appliances', 'rustdesk_installed', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether RustDesk is installed on this appliance'
    });

    // Add rustdesk_installation_date to appliances table
    await queryInterface.addColumn('appliances', 'rustdesk_installation_date', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'When RustDesk was installed'
    });

    // Create index for faster lookups
    await queryInterface.addIndex('appliances', ['rustdesk_id'], {
      name: 'idx_appliances_rustdesk_id',
      where: {
        rustdesk_id: {
          [Sequelize.Op.ne]: null
        }
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('appliances', 'idx_appliances_rustdesk_id');
    await queryInterface.removeColumn('appliances', 'rustdesk_installation_date');
    await queryInterface.removeColumn('appliances', 'rustdesk_installed');
    await queryInterface.removeColumn('appliances', 'rustdesk_id');
    await queryInterface.removeColumn('appliances', 'remote_desktop_type');
  }
};
