const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { Pool } = require('pg');

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 })
  : null;

const migrationPool = process.env.DATABASE_URL_UNPOOLED
  ? new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED, max: 1 })
  : pool;

async function ensureDatabaseSchema() {
  if (!migrationPool) throw new Error('DATABASE_URL não está configurada.');
  const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  await migrationPool.query(schema);
}

module.exports = { pool, migrationPool, ensureDatabaseSchema };