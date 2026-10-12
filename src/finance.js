const { pool } = require('./db');

async function runMonthlyCleanup() {
  if (!pool) return 0;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(47381209)');
    const { rows: [period] } = await client.query(`
      SELECT date_trunc('month', CURRENT_DATE)::date::text AS current_month,
             EXTRACT(DAY FROM CURRENT_DATE)::int AS day_of_month
    `);
    const { rows: [maintenance] } = await client.query(
      'SELECT last_cleared_month::text FROM app_maintenance WHERE id = 1 FOR UPDATE'
    );

    if (period.day_of_month < 5 || maintenance.last_cleared_month >= period.current_month) {
      await client.query('COMMIT');
      return 0;
    }

    const { rowCount } = await client.query('DELETE FROM financial_entries');
    await client.query(
      'UPDATE app_maintenance SET last_cleared_month = $1::date WHERE id = 1',
      [period.current_month]
    );
    await client.query('COMMIT');
    return rowCount;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function listEntries({ userId, status, from, to }) {
  await runMonthlyCleanup();
  const entryConditions = `
    user_id = $1 AND ($2::text = 'all' OR status = $2)
    AND ($3::date IS NULL OR COALESCE(received_at, due_date) >= $3::date)
    AND ($4::date IS NULL OR COALESCE(received_at, due_date) <= $4::date)
  `;
  const periodConditions = `
    user_id = $1
    AND ($2::date IS NULL OR COALESCE(received_at, due_date) >= $2::date)
    AND ($3::date IS NULL OR COALESCE(received_at, due_date) <= $3::date)
  `;
  const [entries, totals] = await Promise.all([
    pool.query(
      `SELECT id, description, amount::text AS amount, status,
              due_date::text AS due_date, received_at::text AS received_at
       FROM financial_entries
       WHERE ${entryConditions}
       ORDER BY COALESCE(received_at, due_date) DESC, created_at DESC`,
      [userId, status, from || null, to || null]
    ),
    pool.query(
      `SELECT COALESCE(SUM(amount) FILTER (WHERE status = 'received'), 0)::text AS received,
              COALESCE(SUM(amount) FILTER (WHERE status = 'planned'), 0)::text AS planned,
              COUNT(*)::int AS count
       FROM financial_entries
            WHERE ${periodConditions}`,
                [userId, from || null, to || null]
    )
  ]);

  return { entries: entries.rows, totals: totals.rows[0] };
}

async function createEntry({ userId, description, amount, status, date }) {
  const receivedAt = status === 'received' ? date : null;
  const { rows: [entry] } = await pool.query(
    `INSERT INTO financial_entries
       (user_id, description, amount, status, due_date, received_at)
     VALUES ($1, $2, $3, $4, $5::date, $6::date)
     RETURNING id, description, amount::text AS amount, status,
               due_date::text AS due_date, received_at::text AS received_at`,
    [userId, description, amount, status, date, receivedAt]
  );
  return entry;
}

async function confirmEntry({ userId, entryId }) {
  const { rows: [entry] } = await pool.query(
    `UPDATE financial_entries
     SET status = 'received', received_at = CURRENT_DATE
     WHERE id = $1 AND user_id = $2 AND status = 'planned'
     RETURNING id, description, amount::text AS amount, status,
               due_date::text AS due_date, received_at::text AS received_at`,
    [entryId, userId]
  );
  return entry || null;
}

async function deleteEntry({ userId, entryId }) {
  const { rowCount } = await pool.query(
    'DELETE FROM financial_entries WHERE id = $1 AND user_id = $2',
    [entryId, userId]
  );
  return rowCount > 0;
}

module.exports = { runMonthlyCleanup, listEntries, createEntry, confirmEntry, deleteEntry };