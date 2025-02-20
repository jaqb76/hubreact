const debug = require('debug')('app:auth');
const express = require('express');
const cors = require('cors');
const ldap = require('ldapjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// LDAP client setup with SSL
const ldapClient = ldap.createClient({
  url: process.env.LDAP_URL,
  tlsOptions: {
    rejectUnauthorized: false // Ustaw na true w produkcji jeśli certyfikat jest zaufany
  }
});

// Bind using service account DN
ldapClient.bind(process.env.LDAP_SERVICE_DN, process.env.LDAP_SERVICE_PASSWORD, (err) => {
  if (err) {
    console.error('Service account bind failed:', err);
    process.exit(1);
  }
  console.log('Service account bound successfully');
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.sendStatus(403);
    }
    req.user = user;
    next();
  });
};

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  console.log('Próba logowania dla użytkownika:', username);

  try {
    console.log('Próba połączenia z LDAP...');
    await new Promise((resolve, reject) => {
      ldapClient.bind(`uid=${username},${process.env.LDAP_BASE_DN}`, password, (err) => {
        if (err) {
          console.error('Błąd bindowania LDAP:', err.message, err.code);
          reject(err);
        } else {
          console.log('Bindowanie LDAP udane');
          resolve();
        }
      });
    });

    // Search for user details
    const searchOptions = {
      scope: 'sub',
      filter: `(uid=${username})`,
      attributes: ['displayName', 'mail', 'thumbnailPhoto']
    };

    ldapClient.search(process.env.LDAP_BASE_DN, searchOptions, (err, searchRes) => {
      if (err) {
        return res.status(500).json({ error: 'LDAP search failed' });
      }

      let userData = {};

      searchRes.on('searchEntry', (entry) => {
        userData = {
          username,
          displayName: entry.object.displayName,
          email: entry.object.mail,
          thumbnail_photo: entry.object.thumbnailPhoto
        };
      });

      // Search for user details
    const searchOptions = {
      scope: 'sub',
      filter: `(uid=${username})`,
      attributes: ['displayName', 'mail', 'thumbnailPhoto']
    };

    console.log('Rozpoczynam wyszukiwanie LDAP z opcjami:', JSON.stringify(searchOptions));

    ldapClient.search(process.env.LDAP_BASE_DN, searchOptions, (err, searchRes) => {
      if (err) {
        console.error('Błąd wyszukiwania LDAP:', err);
        return res.status(500).json({ error: 'LDAP search failed', details: err.message });
      }

      let userData = {};

      searchRes.on('searchEntry', (entry) => {
        console.log('Znaleziono wpis LDAP:', entry.object);
        userData = {
          username,
          displayName: entry.object.displayName,
          email: entry.object.mail,
          thumbnail_photo: entry.object.thumbnailPhoto
        };
      });

      searchRes.on('error', (err) => {
        console.error('Błąd podczas wyszukiwania:', err);
      });

      searchRes.on('end', async (result) => {
        console.log('Zakończono wyszukiwanie LDAP z wynikiem:', result);
        if (!userData.username) {
          console.error('Nie znaleziono użytkownika w LDAP');
          return res.status(404).json({ error: 'User not found in LDAP' });
        }

        // Save or update user in PostgreSQL
        const query = `
          INSERT INTO users (username, display_name, email, thumbnail_photo)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (username) 
          DO UPDATE SET 
            display_name = EXCLUDED.display_name,
            email = EXCLUDED.email,
            thumbnail_photo = EXCLUDED.thumbnail_photo
          RETURNING *;
        `;

        try {
          console.log('Próba zapisu do bazy PostgreSQL');
          const dbResult = await pool.query(query, [
            userData.username,
            userData.displayName,
            userData.email,
            userData.thumbnail_photo
          ]);
          console.log('Zapisano do bazy PostgreSQL:', dbResult.rows[0]);

          const token = jwt.sign(userData, process.env.JWT_SECRET, { expiresIn: '24h' });
          res.json({ user: userData, token });
        } catch (error) {
          console.error('Błąd bazy danych:', error);
          res.status(500).json({ error: 'Database error', details: error.message });
        }
      });
    });
  } catch (error) {
    console.error('Błąd autentykacji LDAP:', error);
    res.status(401).json({ 
      error: 'Authentication failed', 
      details: error.message,
      code: error.code 
    });
  }
});
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Dodaj obsługę błędów
app.use((err, req, res, next) => {
  console.error('Nieobsłużony błąd:', err);
  res.status(500).json({ 
    error: 'Internal server error', 
    details: err.message 
  });
});
// Protected route example
app.get('/api/profile', authenticateToken, (req, res) => {
  res.json(req.user);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
