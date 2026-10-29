// Loads server/.env for the database integration tests (npm run test:db).
const fs = require('fs');
const path = require('path');
const { parseEnv } = require('util');

const file = path.join(__dirname, '..', '.env');
if (fs.existsSync(file)) {
  for (const [key, value] of Object.entries(parseEnv(fs.readFileSync(file, 'utf8')))) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
