// Quick fix script to mark unreachable services as offline

const pool = require('../utils/database');

async function markUnreachableServicesOffline() {
  try {
    console.log('🔧 Marking unreachable services as offline...\n');

    // Get all services with status commands
    const [services] = await pool.execute(
      `SELECT id, name, status_command, ssh_connection, service_status 
       FROM appliances 
       WHERE status_command IS NOT NULL AND status_command != ""`
    );

    console.log(`Found ${services.length} services with status commands\n`);

    // Known unreachable hosts (all except mac)
    const unreachableHosts = [
      'pve',
      'docker',
      'root@192.168.178.92',
      'root@192.168.178.28',
      'root@192.168.178.77',
      'alf@192.168.178.3',
      'alf@192.168.178.65',
      'alf@192.168.178.100',
      'alf@192.168.178.81',
    ];

    let updatedCount = 0;

    for (const service of services) {
      // Check if service uses an unreachable host
      const isUnreachable = unreachableHosts.some(
        host =>
          service.status_command.includes(host) ||
          (service.ssh_connection &&
            service.ssh_connection.includes(host.split('@')[1]))
      );

      if (isUnreachable && service.service_status !== 'error') {
        console.log(
          `📍 ${service.name}: ${service.service_status} → error (host unreachable)`
        );

        await pool.execute(
          'UPDATE appliances SET service_status = ?, last_status_check = NOW() WHERE id = ?',
          ['error', service.id]
        );

        updatedCount++;
      } else if (!isUnreachable) {
        console.log(`✅ ${service.name}: Keeping status (uses reachable host)`);
      }
    }

    console.log(
      `\n✅ Updated ${updatedCount} services to error status (unreachable)`
    );

    // Show current status summary
    const [summary] = await pool.execute(
      `SELECT service_status, COUNT(*) as count 
       FROM appliances 
       WHERE status_command IS NOT NULL 
       GROUP BY service_status`
    );

    console.log('\n📊 Current service status summary:');
    summary.forEach(row => {
      console.log(`   ${row.service_status}: ${row.count} services`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the fix
markUnreachableServicesOffline();
