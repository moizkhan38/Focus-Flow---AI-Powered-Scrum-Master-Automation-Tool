import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL
  || 'postgresql://postgres:moizdanishmand25@localhost:5432/focusflow';

export const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const ms = Date.now() - start;
    if (ms > 200) console.log(`[DB] slow query (${ms}ms): ${text.slice(0, 80)}`);
    return res;
  } catch (err) {
    console.error(`[DB] query failed: ${err.message}\n  SQL: ${text.slice(0, 120)}`);
    throw err;
  }
}

export async function ping() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
