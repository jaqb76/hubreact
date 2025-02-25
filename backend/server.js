const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createTables } = require('./migrations/createTables');

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const ldapAuthRouter = require('./routes/ldapAuth');
const inventoryRouter = require('./routes/inventory');

app.use('/auth', ldapAuthRouter);
app.use('/inventory', inventoryRouter);

app.listen(5000, async () => {
  try {
    await createTables();
    console.log('Tables created successfully');
  } catch (err) {
    console.error('Error creating tables:', err);
  }
  console.log('Server is running on port 5000');
});
