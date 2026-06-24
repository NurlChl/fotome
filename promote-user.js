/* eslint-disable */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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

const originalUri = 'mongodb+srv://nurulcholil2373_db_user:%40Topsellbelanja2026@fotome.pxiivmb.mongodb.net/?appName=fotome';

resolveMongodbSrv(originalUri)
  .then(async (resolvedUri) => {
    await mongoose.connect(resolvedUri);
    console.log('✅ Connection successful!');

    const db = mongoose.connection.db;
    const targetEmail = process.argv[2];
    const password = process.argv[3];

    if (!targetEmail) {
      console.log('Usage: node promote-user.js <email> [optional_new_password]');
      console.log('\nListing all users in database:');
      const users = await db.collection('users').find().toArray();
      users.forEach(u => {
        console.log(`- Email: ${u.email}, Name: ${u.name}, Role: ${u.role}, Verified: ${u.isVerified}`);
      });
      process.exit(0);
    }

    const emailClean = targetEmail.toLowerCase().trim();
    const existingUser = await db.collection('users').findOne({ email: emailClean });

    const updateFields = { 
      role: 'superadmin',
      isVerified: true,
      adminPermissions: {
        manageUsers: true,
        manageEvents: true,
        managePayouts: true
      }
    };

    if (password) {
      console.log('Hashing new password...');
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(password, salt);
      updateFields.passwordHash = passwordHash;
    }

    if (existingUser) {
      console.log(`Promoting existing user ${emailClean} to superadmin...`);
      await db.collection('users').updateOne(
        { email: emailClean },
        { $set: updateFields }
      );
      console.log(`=== SUCCESS ===`);
      console.log(`User ${emailClean} is now superadmin.`);
      if (password) {
        console.log(`Password has been set to: ${password}`);
      }
    } else {
      console.log(`User ${emailClean} not found. Creating a new superadmin account...`);
      if (!password) {
        console.error('❌ Error: Password is required to create a new user!');
        process.exit(1);
      }
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(password, salt);
      
      const newUser = {
        email: emailClean,
        name: 'FotoMe Superadmin',
        passwordHash: passwordHash,
        role: 'superadmin',
        isVerified: true,
        isBanned: false,
        adminPermissions: {
          manageUsers: true,
          manageEvents: true,
          managePayouts: true
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.collection('users').insertOne(newUser);
      console.log(`=== SUCCESS ===`);
      console.log(`Created new superadmin:`);
      console.log(`- Email: ${emailClean}`);
      console.log(`- Password: ${password}`);
    }

    process.exit(0);
  })
  .catch(err => {
    console.error('Connection failed:', err);
    process.exit(1);
  });
