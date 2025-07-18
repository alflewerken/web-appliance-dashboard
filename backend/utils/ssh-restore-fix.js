// SSH Restore Fix Script - Diagnose and fix SSH key issues after restore

const pool = require('./database');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

async function diagnoseAndFix() {
  console.log('🔍 SSH Restore Diagnostic & Fix Tool');
  console.log('=====================================\n');

  try {
    // 1. Check SSH Keys in database
    console.log('📊 Checking SSH Keys in database...');
    const [keys] = await pool.execute(
      'SELECT * FROM ssh_keys ORDER BY key_name'
    );
    console.log(`Found ${keys.length} SSH keys in database:`);
    keys.forEach(key => {
      console.log(
        `  - ${key.key_name} (${key.key_type}, ${key.key_size} bits, default: ${key.is_default})`
      );
    });

    // 2. Check SSH Hosts in database
    console.log('\n📊 Checking SSH Hosts in database...');
    const [hosts] = await pool.execute(
      'SELECT * FROM ssh_hosts ORDER BY hostname'
    );
    console.log(`Found ${hosts.length} SSH hosts in database:`);
    hosts.forEach(host => {
      console.log(
        `  - ${host.hostname} (${host.username}@${host.host}:${host.port}, key: ${host.key_name}, active: ${host.is_active})`
      );
    });

    // 3. Check filesystem keys
    console.log('\n📁 Checking SSH keys on filesystem...');
    const sshDir = '/root/.ssh';
    try {
      const files = await fs.readdir(sshDir);
      const keyFiles = files.filter(
        f => f.startsWith('id_rsa_') && !f.endsWith('.pub')
      );
      console.log(`Found ${keyFiles.length} private keys on filesystem:`);
      for (const file of keyFiles) {
        const keyName = file.replace('id_rsa_', '');
        const stats = await fs.stat(path.join(sshDir, file));
        console.log(
          `  - ${keyName} (${stats.size} bytes, perms: ${(stats.mode & parseInt('777', 8)).toString(8)})`
        );
      }
    } catch (error) {
      console.error('❌ Error reading SSH directory:', error.message);
    }

    // 4. Check for mismatches
    console.log('\n🔍 Checking for mismatches...');
    const issues = [];

    // Check if hosts reference non-existent keys
    for (const host of hosts) {
      const keyExists = keys.some(k => k.key_name === host.key_name);
      if (!keyExists) {
        issues.push(
          `Host "${host.hostname}" references non-existent key "${host.key_name}"`
        );
      }
    }

    // Check if keys exist in DB but not on filesystem
    for (const key of keys) {
      const keyPath = path.join(sshDir, `id_rsa_${key.key_name}`);
      try {
        await fs.access(keyPath);
      } catch {
        issues.push(`Key "${key.key_name}" exists in DB but not on filesystem`);
      }
    }

    if (issues.length > 0) {
      console.log('❌ Found issues:');
      issues.forEach(issue => console.log(`  - ${issue}`));
    } else {
      console.log('✅ No mismatches found');
    }

    // 5. Fix issues
    if (issues.length > 0) {
      console.log('\n🔧 Attempting to fix issues...');

      // Restore keys from DB to filesystem
      for (const key of keys) {
        const keyPath = path.join(sshDir, `id_rsa_${key.key_name}`);
        const pubKeyPath = `${keyPath}.pub`;

        try {
          await fs.access(keyPath);
          console.log(`  ✓ Key "${key.key_name}" already exists on filesystem`);
        } catch {
          if (key.private_key) {
            console.log(
              `  🔧 Restoring key "${key.key_name}" to filesystem...`
            );
            await fs.writeFile(keyPath, key.private_key, { mode: 0o600 });
            if (key.public_key) {
              await fs.writeFile(pubKeyPath, key.public_key, { mode: 0o644 });
            }
            console.log(`  ✅ Restored key "${key.key_name}"`);
          } else {
            console.log(
              `  ❌ Cannot restore key "${key.key_name}" - no private key data in DB`
            );
          }
        }
      }

      // Update hosts with missing keys to use default key
      const defaultKey = keys.find(k => k.is_default);
      if (defaultKey) {
        for (const host of hosts) {
          const keyExists = keys.some(k => k.key_name === host.key_name);
          if (!keyExists) {
            console.log(
              `  🔧 Updating host "${host.hostname}" to use default key "${defaultKey.key_name}"...`
            );
            await pool.execute(
              'UPDATE ssh_hosts SET key_name = ? WHERE id = ?',
              [defaultKey.key_name, host.id]
            );
            console.log(`  ✅ Updated host "${host.hostname}"`);
          }
        }
      }
    }

    // 6. Regenerate SSH config
    console.log('\n🔧 Regenerating SSH config...');
    const { regenerateSSHConfig } = require('../utils/sshManager');
    await regenerateSSHConfig();
    console.log('✅ SSH config regenerated');

    // 7. Test SSH connections
    console.log('\n🧪 Testing SSH connections...');
    for (const host of hosts.filter(h => h.is_active)) {
      console.log(`\n  Testing ${host.hostname}...`);
      const result = await testSSHConnection(host);
      if (result.success) {
        console.log(`  ✅ Connection successful`);
      } else {
        console.log(`  ❌ Connection failed: ${result.error}`);
      }
    }

    console.log('\n✅ Diagnostic and fix complete!');
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  } finally {
    await pool.end();
  }
}

async function testSSHConnection(host) {
  return new Promise(resolve => {
    const keyPath = `/root/.ssh/id_rsa_${host.key_name}`;
    const sshCmd = spawn('ssh', [
      '-i',
      keyPath,
      '-o',
      'StrictHostKeyChecking=no',
      '-o',
      'UserKnownHostsFile=/dev/null',
      '-o',
      'ConnectTimeout=5',
      '-o',
      'BatchMode=yes',
      '-p',
      host.port.toString(),
      `${host.username}@${host.host}`,
      'echo "Connection successful"',
    ]);

    let stdout = '';
    let stderr = '';

    sshCmd.stdout.on('data', data => {
      stdout += data.toString();
    });

    sshCmd.stderr.on('data', data => {
      stderr += data.toString();
    });

    sshCmd.on('close', code => {
      if (code === 0 && stdout.includes('Connection successful')) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: stderr || `Exit code: ${code}` });
      }
    });

    sshCmd.on('error', error => {
      resolve({ success: false, error: error.message });
    });
  });
}

// Run the diagnostic
diagnoseAndFix();
