// Deep SSH Debug Script - Detaillierte Analyse nach Restore

const pool = require('./database');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const { executeSSHCommand } = require('./ssh');

async function deepDebug() {
  console.log('🔍 SSH Deep Debug Tool - Post-Restore Analysis');
  console.log('==============================================\n');

  try {
    // 1. Environment Check
    console.log('📋 ENVIRONMENT CHECK:');
    console.log('---------------------');
    console.log('Current user:', process.env.USER || 'unknown');
    console.log('Home directory:', process.env.HOME || 'unknown');
    console.log('Working directory:', process.cwd());
    console.log('Node version:', process.version);
    console.log('SSH directory:', '/root/.ssh');

    // 2. Database Connection Test
    console.log('\n📊 DATABASE CHECK:');
    console.log('------------------');
    try {
      const [testResult] = await pool.execute('SELECT 1 as test');
      console.log('✅ Database connection: OK');

      // Get database details
      const [dbInfo] = await pool.execute(`
        SELECT 
          (SELECT COUNT(*) FROM ssh_keys) as key_count,
          (SELECT COUNT(*) FROM ssh_hosts) as host_count,
          (SELECT COUNT(*) FROM appliances WHERE status_command IS NOT NULL) as apps_with_status
      `);
      console.log('Database contents:', dbInfo[0]);
    } catch (dbError) {
      console.error('❌ Database connection failed:', dbError.message);
      return;
    }

    // 3. SSH Keys Analysis
    console.log('\n🔑 SSH KEYS ANALYSIS:');
    console.log('---------------------');
    const [keys] = await pool.execute(
      'SELECT * FROM ssh_keys ORDER BY key_name'
    );

    for (const key of keys) {
      console.log(`\nKey: ${key.key_name}`);
      console.log(`  - Type: ${key.key_type}`);
      console.log(`  - Size: ${key.key_size}`);
      console.log(`  - Default: ${key.is_default}`);
      console.log(
        `  - Has private key in DB: ${key.private_key ? 'Yes (' + key.private_key.length + ' chars)' : 'No'}`
      );
      console.log(
        `  - Has public key in DB: ${key.public_key ? 'Yes (' + key.public_key.length + ' chars)' : 'No'}`
      );

      // Check filesystem
      const privateKeyPath = `/root/.ssh/id_rsa_${key.key_name}`;
      const publicKeyPath = `${privateKeyPath}.pub`;

      try {
        const privateStat = await fs.stat(privateKeyPath);
        console.log(
          `  - Private key on FS: Yes (${privateStat.size} bytes, mode: ${(privateStat.mode & parseInt('777', 8)).toString(8)})`
        );

        // Read first line to check format
        const privateContent = await fs.readFile(privateKeyPath, 'utf8');
        const firstLine = privateContent.split('\\n')[0];
        console.log(`  - Private key format: ${firstLine.substring(0, 30)}...`);
      } catch (error) {
        console.log(`  - Private key on FS: No (${error.code})`);
      }

      try {
        const publicStat = await fs.stat(publicKeyPath);
        console.log(`  - Public key on FS: Yes (${publicStat.size} bytes)`);
      } catch (error) {
        console.log(`  - Public key on FS: No (${error.code})`);
      }
    }

    // 4. SSH Hosts Analysis
    console.log('\n🖥️  SSH HOSTS ANALYSIS:');
    console.log('----------------------');
    const [hosts] = await pool.execute(
      'SELECT * FROM ssh_hosts WHERE is_active = TRUE ORDER BY hostname'
    );

    for (const host of hosts) {
      console.log(`\nHost: ${host.hostname}`);
      console.log(`  - Address: ${host.username}@${host.host}:${host.port}`);
      console.log(`  - Key name: ${host.key_name}`);
      console.log(`  - Last tested: ${host.last_tested || 'Never'}`);
      console.log(`  - Test status: ${host.test_status || 'Unknown'}`);

      // Check if key exists
      const keyExists = keys.some(k => k.key_name === host.key_name);
      if (!keyExists) {
        console.log(`  - ⚠️  WARNING: References non-existent key!`);
      }
    }

    // 5. SSH Config File
    console.log('\n📄 SSH CONFIG FILE:');
    console.log('-------------------');
    try {
      const configContent = await fs.readFile('/root/.ssh/config', 'utf8');
      console.log('Config file exists, size:', configContent.length, 'bytes');
      console.log('First 500 chars:');
      console.log(configContent.substring(0, 500));
      console.log('...\n');

      // Count host entries
      const hostEntries = configContent.match(/^Host /gm);
      console.log('Total Host entries:', hostEntries ? hostEntries.length : 0);
    } catch (error) {
      console.log('❌ Config file missing or unreadable:', error.message);
    }

    // 6. Test Status Commands
    console.log('\n🔧 TESTING STATUS COMMANDS:');
    console.log('---------------------------');
    const [appliances] = await pool.execute(`
      SELECT id, name, status_command 
      FROM appliances 
      WHERE status_command IS NOT NULL 
      LIMIT 3
    `);

    for (const app of appliances) {
      console.log(`\nTesting: ${app.name}`);
      console.log(`Command: ${app.status_command}`);

      try {
        // Test with our SSH execution function
        console.log('Executing with executeSSHCommand...');
        const result = await executeSSHCommand(app.status_command, 10000);
        console.log('✅ Success!');
        console.log('STDOUT:', result.stdout.substring(0, 100));
        console.log('STDERR:', result.stderr.substring(0, 100));
      } catch (error) {
        console.log('❌ Failed:', error.message);
        if (error.stderr) {
          console.log('STDERR:', error.stderr);
        }
      }
    }

    // 7. Direct SSH Test
    console.log('\n🧪 DIRECT SSH CONNECTION TEST:');
    console.log('------------------------------');
    if (hosts.length > 0) {
      const testHost = hosts[0];
      console.log(`Testing direct SSH to ${testHost.hostname}...`);

      const keyPath = `/root/.ssh/id_rsa_${testHost.key_name}`;
      const sshArgs = [
        '-v', // Verbose for debugging
        '-i',
        keyPath,
        '-o',
        'StrictHostKeyChecking=no',
        '-o',
        'UserKnownHostsFile=/dev/null',
        '-o',
        'ConnectTimeout=10',
        '-p',
        testHost.port.toString(),
        `${testHost.username}@${testHost.host}`,
        'echo "SSH_TEST_SUCCESS"',
      ];

      console.log('SSH command:', 'ssh', sshArgs.join(' '));

      await new Promise(resolve => {
        const sshProcess = spawn('ssh', sshArgs);

        sshProcess.stdout.on('data', data => {
          console.log('STDOUT:', data.toString());
        });

        sshProcess.stderr.on('data', data => {
          console.log('STDERR:', data.toString());
        });

        sshProcess.on('close', code => {
          console.log('SSH process exited with code:', code);
          resolve();
        });
      });
    }

    // 8. Check SSH Tools
    console.log('\n🔨 SSH TOOLS CHECK:');
    console.log('-------------------');
    const tools = ['ssh', 'ssh-keygen', 'ssh-copy-id', 'sshpass'];
    for (const tool of tools) {
      try {
        const whichResult = await new Promise((resolve, reject) => {
          const proc = spawn('which', [tool]);
          let output = '';
          proc.stdout.on('data', data => (output += data));
          proc.on('close', code => {
            if (code === 0) resolve(output.trim());
            else reject(new Error('Not found'));
          });
        });
        console.log(`✅ ${tool}: ${whichResult}`);
      } catch {
        console.log(`❌ ${tool}: Not found`);
      }
    }

    // 9. File Permissions
    console.log('\n🔒 FILE PERMISSIONS CHECK:');
    console.log('--------------------------');
    const sshDir = '/root/.ssh';
    try {
      const dirStat = await fs.stat(sshDir);
      console.log(
        `SSH directory: ${(dirStat.mode & parseInt('777', 8)).toString(8)}`
      );

      const files = await fs.readdir(sshDir);
      for (const file of files) {
        const filePath = path.join(sshDir, file);
        const stat = await fs.stat(filePath);
        const mode = (stat.mode & parseInt('777', 8)).toString(8);
        console.log(`  ${file}: ${mode}`);
      }
    } catch (error) {
      console.log('❌ Cannot check permissions:', error.message);
    }

    console.log('\n✅ Deep debug complete!');
  } catch (error) {
    console.error('\n❌ Fatal error during debug:', error);
  } finally {
    await pool.end();
  }
}

// Run the debug
deepDebug();
