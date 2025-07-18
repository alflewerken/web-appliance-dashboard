const pool = require('../backend/utils/database');

async function checkAuditLogs() {
  try {
    // Check if there are any audit logs
    const [logs] = await pool.execute(
      'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10'
    );
    
    console.log('=== Recent Audit Logs ===');
    console.log('Total found:', logs.length);
    
    logs.forEach(log => {
      console.log('\n--- Log Entry ---');
      console.log('ID:', log.id);
      console.log('Action:', log.action);
      console.log('Resource Type:', log.resource_type);
      console.log('Resource ID:', log.resource_id);
      console.log('User ID:', log.user_id);
      console.log('Created:', log.created_at);
      console.log('Details:', log.details);
    });
    
    // Check specifically for appliance-related logs
    const [applianceLogs] = await pool.execute(
      `SELECT * FROM audit_logs 
       WHERE action IN ('appliance_create', 'appliance_update', 'appliance_delete', 
                        'service_created', 'service_updated', 'service_deleted')
       ORDER BY created_at DESC LIMIT 10`
    );
    
    console.log('\n=== Appliance-Related Logs ===');
    console.log('Total found:', applianceLogs.length);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAuditLogs();
