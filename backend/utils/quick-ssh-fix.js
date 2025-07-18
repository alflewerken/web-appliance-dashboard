// Quick SSH Fix Script - Repairs SSH configuration issues

const pool = require('./utils/database');
const fs = require('fs').promises;
const path = require('path');
const { SSHManager } = require('./utils/sshManager');

async function quickSSHFix() {
  console.log('🔧 Quick SSH Fix Tool');
  console.log('====================\n');

  try {
    // 1. Wait for database
    console.log('⏳ Checking database connection...');
    let dbReady = false;
    for (let i = 0; i < 10; i++) {
      try {
        await pool.execute('SELECT 1');
        dbReady = true;
        break;
      } catch (e) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!dbReady) {
      throw new Error('Database not ready');
    }
    console.log('✅ Database connected\n');

    // 2. Check SSH directory
    const sshDir = '/root/.ssh';
    console.log('📁 Checking SSH directory...');

    try {
      await fs.mkdir(sshDir, { recursive: true, mode: 0o700 });
      console.log('✅ SSH directory exists\n');
    } catch (error) {
      console.error('❌ Could not create SSH directory:', error);
    }

    // 3. Sync keys from database to filesystem
    console.log('🔑 Syncing SSH keys from database...');
    const sshManager = new SSHManager({});

    try {
      const syncedCount = await sshManager.syncKeysToFilesystem();
      console.log(`✅ Synced ${syncedCount} SSH keys\n`);
    } catch (error) {
      console.error('❌ Error syncing keys:', error.message);
    }

    // 4. Regenerate SSH config
    console.log('📝 Regenerating SSH config...');
    try {
      await sshManager.regenerateSSHConfig();
      console.log('✅ SSH config regenerated\n');
    } catch (error) {
      console.error('❌ Error regenerating config:', error.message);
    }

    // 5. Fix permissions
    console.log('🔒 Fixing permissions...');
    try {
      await fs.chmod(sshDir, 0o700);

      const files = await fs.readdir(sshDir);
      for (const file of files) {
        const filePath = path.join(sshDir, file);
        if (file.startsWith('id_rsa_') && !file.endsWith('.pub')) {
          await fs.chmod(filePath, 0o600);
        } else if (file.endsWith('.pub')) {
          await fs.chmod(filePath, 0o644);
        } else if (file === 'config') {
          await fs.chmod(filePath, 0o600);
        }
      }
      console.log('✅ Permissions fixed\n');
    } catch (error) {
      console.error('❌ Error fixing permissions:', error.message);
    }

    // 6. Verify SSH keys
    console.log('🔍 Verifying SSH setup...');
    const [keys] = await pool.execute('SELECT * FROM ssh_keys');
    const [hosts] = await pool.execute(
      'SELECT * FROM ssh_hosts WHERE is_active = TRUE'
    );

    console.log(
      `📊 Found ${keys.length} keys and ${hosts.length} active hosts`
    );

    // Check each key exists on filesystem
    let allKeysPresent = true;
    for (const key of keys) {
      const keyPath = path.join(sshDir, `id_rsa_${key.key_name}`);
      try {
        await fs.access(keyPath);
        console.log(`  ✅ Key ${key.key_name} exists`);
      } catch {
        console.log(`  ❌ Key ${key.key_name} missing`);
        allKeysPresent = false;
      }
    }

    // 7. Summary
    console.log('\n📊 Summary:');
    console.log('===========');
    console.log(`✓ Database: Connected`);
    console.log(`✓ SSH Keys: ${keys.length} in DB`);
    console.log(`✓ SSH Hosts: ${hosts.length} active`);
    console.log(
      `✓ Keys on filesystem: ${allKeysPresent ? 'All present' : 'Some missing'}`
    );
    console.log(`✓ SSH Config: Regenerated`);
    console.log(`✓ Permissions: Fixed`);

    console.log('\n✅ SSH quick fix complete!');

    if (!allKeysPresent) {
      console.log(
        '\n⚠️  Some keys are still missing. Run ssh-post-restore-fix.js for full restoration.'
      );
    }
  } catch (error) {
    console.error('\n❌ Error during quick fix:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the fix
quickSSHFix();
