#!/usr/bin/env node

const snmp = require('net-snmp');

// Configuration for the Macbook
const config = {
  ip: '192.168.178.29',
  port: 161,
  community: 'public',
  version: 2
};

console.log('Testing specific interfaces on', config.ip);
console.log('='.repeat(60));

const session = snmp.createSession(config.ip, config.community, {
  timeout: 5000,
  retries: 1
});

// Test specific interface indices
const testIndices = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// OIDs for interface information
function getOids(index) {
  return [
    `1.3.6.1.2.1.2.2.1.2.${index}`,  // ifDescr
    `1.3.6.1.2.1.2.2.1.8.${index}`,  // ifOperStatus
    `1.3.6.1.2.1.2.2.1.10.${index}`, // ifInOctets
    `1.3.6.1.2.1.2.2.1.16.${index}`, // ifOutOctets
    `1.3.6.1.2.1.2.2.1.5.${index}`   // ifSpeed
  ];
}

async function testInterface(index) {
  return new Promise((resolve) => {
    const oids = getOids(index);
    
    session.get(oids, (error, varbinds) => {
      if (error) {
        console.log(`Interface ${index}: ERROR - ${error.message}`);
        resolve(null);
      } else {
        const result = {
          index: index,
          description: null,
          status: null,
          inBytes: null,
          outBytes: null,
          speed: null
        };
        
        varbinds.forEach((vb, i) => {
          if (!snmp.isVarbindError(vb)) {
            switch(i) {
              case 0: result.description = vb.value ? vb.value.toString() : 'N/A'; break;
              case 1: result.status = vb.value === 1 ? 'UP' : 'DOWN'; break;
              case 2: result.inBytes = vb.value || 0; break;
              case 3: result.outBytes = vb.value || 0; break;
              case 4: result.speed = vb.value || 0; break;
            }
          }
        });
        
        if (result.description && result.description !== 'N/A') {
          console.log(`\nInterface ${index}: ${result.description}`);
          console.log(`  Status: ${result.status}`);
          console.log(`  In/Out: ${result.inBytes}/${result.outBytes} bytes`);
          console.log(`  Speed: ${result.speed} bps`);
          
          // Identify interface type
          const desc = result.description.toLowerCase();
          if (desc.includes('en0')) {
            console.log(`  --> This is WLAN/WiFi (en0)`);
          } else if (desc.includes('en5')) {
            console.log(`  --> This is Ethernet (en5)`);
          } else if (desc.includes('en4')) {
            console.log(`  --> This is Thunderbolt Bridge (en4)`);
          }
          
          resolve(result);
        } else {
          resolve(null);
        }
      }
    });
  });
}

async function scanInterfaces() {
  console.log('\nTesting interfaces 1-10...\n');
  
  const results = [];
  for (const index of testIndices) {
    const result = await testInterface(index);
    if (result) {
      results.push(result);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY:');
  console.log('='.repeat(60));
  
  const activeInterfaces = results.filter(r => r && r.status === 'UP' && (r.inBytes > 0 || r.outBytes > 0));
  
  if (activeInterfaces.length > 0) {
    console.log('\nActive interfaces found:');
    activeInterfaces.forEach(iface => {
      console.log(`  - Index ${iface.index}: ${iface.description}`);
    });
    
    console.log('\nRecommended configuration:');
    activeInterfaces.forEach(iface => {
      const name = iface.description.includes('en0') ? 'WLAN (en0)' :
                   iface.description.includes('en5') ? 'Ethernet (en5)' :
                   iface.description.includes('en4') ? 'Thunderbolt (en4)' :
                   iface.description;
      console.log(`  network.interface.${iface.index} = "${name}"`);
    });
  } else {
    console.log('\nNo active interfaces found!');
  }
  
  session.close();
  console.log('\nScan complete.');
}

// Run the scan
scanInterfaces().catch(err => {
  console.error('Fatal error:', err);
  session.close();
});
