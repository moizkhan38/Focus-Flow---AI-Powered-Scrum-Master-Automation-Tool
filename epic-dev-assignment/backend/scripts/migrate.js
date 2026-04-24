import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function run() {
  const files = (await fs.readdir(MIGRATIONS_DIR)).filter(f => f.endsWith('.sql')).sort();
  console.log(`[Migrate] Found ${files.length} migration file(s)`);

  for (const file of files) {
    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    console.log(`[Migrate] Applying ${file}...`);
    await pool.query(sql);
    console.log(`[Migrate] ✓ ${file}`);
  }
  console.log('[Migrate] Done.');
  await pool.end();
}

run().catch(err => {
  console.error('[Migrate] Failed:', err.message);
  process.exit(1);
});
