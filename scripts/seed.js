const bcrypt = require('bcryptjs');
const { pool, migrationPool, ensureDatabaseSchema } = require('../src/db');

async function seed() {
  if (!pool) {
    throw new Error('Defina DATABASE_URL antes de criar o usuário inicial.');
  }

  const username = process.env.DEMO_USERNAME || 'root';
  const password = process.env.DEMO_PASSWORD || 'administrator';
  const displayName = 'Administrador';
  const passwordHash = await bcrypt.hash(password, 12);

  await ensureDatabaseSchema();
  await pool.query(
    `INSERT INTO users (username, display_name, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (username) DO UPDATE
     SET display_name = EXCLUDED.display_name, password_hash = EXCLUDED.password_hash`,
    [username, displayName, passwordHash]
  );
  console.log(`Usuário ${username} criado/atualizado.`);
}

seed()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all([...new Set([pool, migrationPool].filter(Boolean))].map((connection) => connection.end()));
  });