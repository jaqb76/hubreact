const express = require('express');
const ldap = require('ldapjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const base64 = require('base-64');

dotenv.config();

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

let ldapClient = ldap.createClient({
  url: `${process.env.LDAP_URL}`,
  timeout: Number(process.env.LDAP_TIMEOUT) * 1000,
  connectTimeout: Number(process.env.LDAP_TIMEOUT) * 1000,
  tlsOptions: {
    rejectUnauthorized: false
  },
  binaryAttributes: ['thumbnailPhoto']
});

function reconnectLDAP() {
  ldapClient.unbind((err) => {
    if (err) {
      console.error('Error unbinding LDAP client:', err);
    }
    ldapClient = ldap.createClient({
      url: `${process.env.LDAP_URL}`,
      timeout: Number(process.env.LDAP_TIMEOUT) * 1000,
      connectTimeout: Number(process.env.LDAP_TIMEOUT) * 1000,
      tlsOptions: {
        rejectUnauthorized: false
      },
      binaryAttributes: ['thumbnailPhoto']
    });
    ldapClient.on('error', (err) => {
      console.error('LDAP connection error:', err);
    });
    ldapClient.on('connect', () => {
      console.log('LDAP client connected');
    });
  });
}

ldapClient.on('error', (err) => {
  console.error('LDAP connection error:', err);
  reconnectLDAP();
});

ldapClient.on('connect', () => {
  console.log('LDAP client connected');
});

ldapClient.on('connectTimeout', (err) => {
  console.error('LDAP client connection timeout:', err);
  reconnectLDAP();
});

ldapClient.on('timeout', (err) => {
  console.error('LDAP client timeout:', err);
  reconnectLDAP();
});

const authenticateJWT = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (token) {
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        console.error('JWT verification failed:', err);
        return res.sendStatus(403);
      }
      req.user = user;
      next();
    });
  } else {
    console.error('No token provided');
    res.sendStatus(401);
  }
};

const sanitizeString = (str) => {
  return str ? str.replace(/\0/g, '') : str;
};

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  console.log(`Received login request for username: ${username}`);
  console.log('Environment variables loaded:');
  console.log('LDAP_URL:', process.env.LDAP_URL);
  console.log('LDAP_BASE_DN:', process.env.LDAP_BASE_DN);
  console.log('LDAP_USERNAME is set:', !!process.env.LDAP_USERNAME);
  console.log('LDAP_PASSWORD is set:', !!process.env.LDAP_PASSWORD);

  ldapClient.bind(process.env.LDAP_USERNAME, process.env.LDAP_PASSWORD, (err) => {
    if (err) {
      console.error('LDAP bind failed:', err);
      return res.status(500).send('LDAP bind failed');
    }
    console.log('LDAP service account bind successful');
    console.log('Search options:', JSON.stringify({
      scope: searchOptions.scope,
      filter: searchOptions.filter,
      attributes: searchOptions.attributes
    }));
    const escapedUsername = ldap.escapeLDAPFilterValue(username);
    const searchOptions = {
      scope: 'sub',
      filter: `(&(objectClass=user)(sAMAccountName=${escapedUsername}))`,
      attributes: [ 'displayName', 'mail', 'thumbnailPhoto', 'sAMAccountName', 'memberOf']
    };

    ldapClient.search(process.env.LDAP_BASE_DN, searchOptions, (err, searchRes) => {
      if (err) {
        console.error('LDAP search failed:', err);
        return res.status(500).send('LDAP search failed');
      }
      console.log('Starting search with base DN:', process.env.LDAP_BASE_DN);
      console.log('Search filter:', searchOptions.filter);
      let userEntryFound = false;
      let userEntry = null;
      searchRes.on('searchEntry', (entry) => {
        userEntryFound = true;
        console.log('Found entry DNs:', entry.object.dn);
        userEntry = entry;
      });

      searchRes.on('end', async (result) => {
        console.log('Search ended, entries found:', userEntryFound);
        console.log('Search result status:', result.status);
        if (!userEntry) {
          console.log('User not found in LDAP:', username);
          return res.status(401).send('User not found');
        }

        ldapClient.bind(userEntry.object.dn, password, async (err) => {
          if (err) {
            console.log('Invalid credentials for user:', username);
            return res.status(401).send('Invalid credentials');
          }

          console.log('LDAP authentication successful for user:', username);
          const token = jwt.sign({ username }, process.env.JWT_SECRET, {
            expiresIn: '1h',
          });
          const displayName = sanitizeString(userEntry.attributes.find(attr => attr.type === 'displayName')?.vals[0]);
          const email = sanitizeString(userEntry.attributes.find(attr => attr.type === 'mail')?.vals[0]);
          const memberOf = userEntry.attributes.find(attr => attr.type === 'memberOf')?.vals || [];
          const thumbnailPhoto = userEntry.attributes.find(attr => attr.type === 'thumbnailPhoto');
          const photo = thumbnailPhoto ? thumbnailPhoto.buffers[0] : null;

          const client = await pool.connect();
          try {
            await client.query(
              'INSERT INTO users (username, display_name, email, member_of, token, thumbnail_photo) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (username) DO UPDATE SET display_name = $2, email = $3, member_of = $4, token = $5, thumbnail_photo = $6',
              [username, displayName, email, memberOf.join(';'), token, photo ? photo.toString('base64') : null]
            );
            console.log('User saved to database');
          } catch (err) {
            console.error('Error saving user to database:', err);
          } finally {
            client.release();
          }

          res.json({ token });
        });
      });

      searchRes.on('error', (err) => {
        console.error('LDAP search error:', err);
        return res.status(500).send('LDAP search error');
      });
    });
  });
});

router.get('/profile', authenticateJWT, async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT username, display_name, email, member_of, thumbnail_photo FROM users WHERE username = $1', [req.user.username]);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      user.member_of = user.member_of ? user.member_of.split(';') : [];
      user.thumbnail_photo = user.thumbnail_photo ? user.thumbnail_photo : null;
      res.json({
        displayName: user.display_name,
        email: user.email,
        memberOf: user.member_of,
        thumbnailPhoto: user.thumbnail_photo
      });
    } else {
      console.error('User not found in database:', req.user.username);
      res.sendStatus(404);
    }
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.sendStatus(500);
  } finally {
    client.release();
  }
});

module.exports = router;
