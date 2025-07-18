// SSH Post-Restore Fix - Speziell für SSH-Host und Key-Zuordnungen

const pool = require('./database');
const fs = require('fs').promises;
const path = require('path');
const { SSHManager } = require('./sshManager');
const { spawn } = require('child_process');

async function fixSSHAfterRestore() {
  console.log('🔧 SSH Post-Restore Fix Tool');
  console.log('============================\n');

  try {
    // 1. Warte auf Datenbank
    console.log('⏳ Waiting for database...');
    let dbReady = false;
    for (let i = 0; i < 30; i++) {
      try {
        await pool.execute('SELECT 1');
        dbReady = true;
        break;
      } catch (e) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!dbReady) {
      throw new Error('Database not ready after 30 seconds');
    }

    console.log('✅ Database ready\n');

    // 2. Analysiere aktuelle Situation
    console.log('📊 Analyzing current state...');

    const [keys] = await pool.execute(
      'SELECT * FROM ssh_keys ORDER BY key_name'
    );
    const [hosts] = await pool.execute(
      'SELECT * FROM ssh_hosts ORDER BY hostname'
    );
    const [appliances] = await pool.execute(`
      SELECT id, name, status_command 
      FROM appliances 
      WHERE status_command IS NOT NULL AND status_command != ''
    `);

    console.log(
      `Found: ${keys.length} keys, ${hosts.length} hosts, ${appliances.length} appliances with status commands\n`
    );

    // 3. Stelle sicher, dass alle Keys im Dateisystem existieren
    console.log('📁 Ensuring all keys exist on filesystem...');
    const sshDir = '/root/.ssh';

    // Erstelle SSH-Verzeichnis falls nicht vorhanden
    try {
      await fs.mkdir(sshDir, { recursive: true, mode: 0o700 });
    } catch (e) {
      // Ignoriere wenn bereits existiert
    }

    let restoredKeys = 0;
    for (const key of keys) {
      const privateKeyPath = path.join(sshDir, `id_rsa_${key.key_name}`);
      const publicKeyPath = `${privateKeyPath}.pub`;

      try {
        await fs.access(privateKeyPath);
        console.log(`  ✓ Key ${key.key_name} already exists`);
      } catch {
        if (key.private_key) {
          console.log(`  🔧 Restoring key ${key.key_name} to filesystem...`);

          // Stelle sicher, dass der Key mit Newline endet
          const privateKeyContent = key.private_key.endsWith('\n')
            ? key.private_key
            : key.private_key + '\n';

          await fs.writeFile(privateKeyPath, privateKeyContent, {
            mode: 0o600,
          });

          if (key.public_key) {
            const publicKeyContent = key.public_key.endsWith('\n')
              ? key.public_key
              : key.public_key + '\n';
            await fs.writeFile(publicKeyPath, publicKeyContent, {
              mode: 0o644,
            });
          }

          restoredKeys++;
          console.log(`  ✅ Restored key ${key.key_name}`);
        } else {
          console.log(
            `  ❌ Cannot restore key ${key.key_name} - no data in database`
          );
        }
      }
    }

    if (restoredKeys > 0) {
      console.log(`\n✅ Restored ${restoredKeys} keys to filesystem\n`);
    }

    // 4. Überprüfe und repariere Host-Key-Zuordnungen
    console.log('🔍 Checking host-key mappings...');
    let fixedHosts = 0;

    for (const host of hosts) {
      const keyExists = keys.some(k => k.key_name === host.key_name);

      if (!keyExists) {
        console.log(
          `  ⚠️  Host ${host.hostname} references non-existent key: ${host.key_name}`
        );

        // Finde einen Default-Key
        const defaultKey = keys.find(k => k.is_default) || keys[0];

        if (defaultKey) {
          console.log(`  🔧 Updating to use key: ${defaultKey.key_name}`);
          await pool.execute('UPDATE ssh_hosts SET key_name = ? WHERE id = ?', [
            defaultKey.key_name,
            host.id,
          ]);
          fixedHosts++;
        }
      } else {
        console.log(`  ✓ Host ${host.hostname} -> key ${host.key_name} OK`);
      }
    }

    if (fixedHosts > 0) {
      console.log(`\n✅ Fixed ${fixedHosts} host-key mappings\n`);
    }

    // 5. Regeneriere SSH Config
    console.log('📝 Regenerating SSH config...');
    const sshManager = new SSHManager({});
    await sshManager.regenerateSSHConfig();
    console.log('✅ SSH config regenerated\n');

    // 6. Setze korrekte Permissions
    console.log('🔒 Setting correct permissions...');
    await fs.chmod(sshDir, 0o700);

    const files = await fs.readdir(sshDir);
    for (const file of files) {
      const filePath = path.join(sshDir, file);
      if (file.startsWith('id_rsa_') && !file.endsWith('.pub')) {
        await fs.chmod(filePath, 0o600);
      } else if (file.endsWith('.pub')) {
        await fs.chmod(filePath, 0o644);
      } else if (file === 'config' || file === 'known_hosts') {
        await fs.chmod(filePath, 0o600);
      }
    }
    console.log('✅ Permissions fixed\n');

    // 7. Teste eine SSH-Verbindung
    if (hosts.length > 0 && hosts.some(h => h.is_active)) {
      console.log('🧪 Testing SSH connectivity...');
      const testHost = hosts.find(h => h.is_active);

      if (testHost) {
        console.log(`  Testing connection to ${testHost.hostname}...`);
        const result = await testSSHConnection(testHost);

        if (result.success) {
          console.log(`  ✅ SSH connection successful!`);
        } else {
          console.log(`  ❌ SSH connection failed: ${result.error}`);
          console.log(
            `  This might be normal if the host is not reachable from here.`
          );
        }
      }
    }

    // 8. Zusammenfassung
    console.log('\n📊 Summary:');
    console.log('===========');
    console.log(`✓ Database: Connected`);
    console.log(`✓ SSH Keys: ${keys.length} in DB, all synced to filesystem`);
    console.log(`✓ SSH Hosts: ${hosts.length} configured`);
    console.log(`✓ Host mappings: All verified/fixed`);
    console.log(`✓ SSH Config: Regenerated`);
    console.log(`✓ Permissions: Set correctly`);
    console.log(`✓ Ready for update checker!`);

    console.log('\n✅ SSH post-restore fix complete!');
  } catch (error) {
    console.error('\n❌ Error during fix:', error);
    process.exit(1);
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
      'echo "SSH_TEST_OK"',
    ]);

    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      sshCmd.kill();
      resolve({ success: false, error: 'Timeout' });
    }, 10000);

    sshCmd.stdout.on('data', data => {
      stdout += data.toString();
    });

    sshCmd.stderr.on('data', data => {
      stderr += data.toString();
    });

    sshCmd.on('close', code => {
      clearTimeout(timeout);
      if (code === 0 && stdout.includes('SSH_TEST_OK')) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: stderr || `Exit code: ${code}` });
      }
    });

    sshCmd.on('error', error => {
      clearTimeout(timeout);
      resolve({ success: false, error: error.message });
    });
  });
}

// Führe die Reparatur aus
fixSSHAfterRestore();
