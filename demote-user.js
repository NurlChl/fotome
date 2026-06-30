/* eslint-disable */
const mongoose = require('mongoose');

async function resolveMongodbSrv(uri) {
  if (!uri.startsWith('mongodb+srv://')) {
    return uri;
  }
  try {
    const parsed = new URL(uri);
    const hostname = parsed.hostname;
    
    console.log('Resolving DNS for:', hostname);
    const [srvRes, txtRes] = await Promise.all([
      fetch('https://cloudflare-dns.com/dns-query?name=_mongodb._tcp.' + hostname + '&type=SRV', {
        headers: { 'Accept': 'application/dns-json' }
      }).then(r => r.json()),
      fetch('https://cloudflare-dns.com/dns-query?name=' + hostname + '&type=TXT', {
        headers: { 'Accept': 'application/dns-json' }
      }).then(r => r.json())
    ]);

    if (!srvRes.Answer || srvRes.Answer.length === 0) {
      console.warn('No SRV records found, using original URI');
      return uri;
    }

    const hosts = srvRes.Answer.map(ans => {
      const parts = ans.data.trim().split(/\s+/);
      const port = parts[2] || '27017';
      const target = parts[3].replace(/\.$/, '');
      return target + ':' + port;
    }).join(',');

    const txtOptions = {};
    if (txtRes.Answer && txtRes.Answer.length > 0) {
      txtRes.Answer.forEach(ans => {
        const rawData = ans.data.replace(/^"|"$/g, '');
        const params = new URLSearchParams(rawData);
        for (const [key, val] of params.entries()) {
          txtOptions[key] = val;
        }
      });
    }

    const mergedParams = new URLSearchParams(parsed.search);
    for (const [key, val] of Object.entries(txtOptions)) {
      if (!mergedParams.has(key)) {
        mergedParams.set(key, val);
      }
    }
    mergedParams.set('ssl', 'true');

    const auth = parsed.username ? (parsed.username + ':' + parsed.password + '@') : '';
    const pathname = parsed.pathname || '/';
    const newUri = 'mongodb://' + auth + hosts + pathname + '?' + mergedParams.toString();
    return newUri;
  } catch (err) {
    console.warn('Error resolving MongoDB SRV dynamically:', err);
    return uri;
  }
}

function loadEnv() {
  const fs = require('fs');
  const path = require('path');
  let envContent = '';
  try {
    envContent = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
  } catch (e) {
    try {
      envContent = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
    } catch (e2) {}
  }
  if (envContent) {
    envContent.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const parts = trimmed.split('=');
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
      if (key && val && !process.env[key]) {
        process.env[key] = val;
      }
    });
  }
}

loadEnv();
const originalUri = process.env.MONGODB_URI || process.env.MONGODB_URL;
if (!originalUri) {
  console.error('❌ Error: MONGODB_URI or MONGODB_URL environment variable is required in .env.local, .env, or environment variables');
  process.exit(1);
}

resolveMongodbSrv(originalUri)
  .then(async (resolvedUri) => {
    await mongoose.connect(resolvedUri);
    console.log('✅ Connection successful!');

    const db = mongoose.connection.db;
    const targetEmail = process.argv[2];

    if (!targetEmail) {
      console.log('Usage: node demote-user.js <email>');
      process.exit(0);
    }

    const emailClean = targetEmail.toLowerCase().trim();
    const existingUser = await db.collection('users').findOne({ email: emailClean });

    if (!existingUser) {
      console.error(`❌ Error: User with email ${emailClean} not found.`);
      process.exit(1);
    }

    console.log(`Demoting user ${emailClean} to regular user role...`);
    await db.collection('users').updateOne(
      { email: emailClean },
      { 
        $set: { 
          role: 'user',
          adminPermissions: {
            manageUsers: false,
            manageEvents: false,
            managePayouts: false,
            manageLogs: false
          }
        } 
      }
    );

    console.log(`=== SUCCESS ===`);
    console.log(`User ${emailClean} is now a regular user.`);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Connection error:', err);
    process.exit(1);
  });
