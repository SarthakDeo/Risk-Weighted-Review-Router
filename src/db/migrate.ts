import fs from 'node:fs';
import path from 'node:path';
import { pool } from './connection.js';

const migrationDir = path.resolve(process.cwd(), 'src/db/migrations');

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function applyMigration(filePath: string) {
  const sql = fs.readFileSync(filePath, 'utf8');
  await pool.query(sql);
  const fileName = path.basename(filePath);
  await pool.query('INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [fileName]);
}

async function rollbackLatest() {
  const result = await pool.query<{ name: string }>('SELECT name FROM schema_migrations ORDER BY id DESC LIMIT 1');
  if (!result.rows.length) {
    console.log('No migrations to roll back.');
    return;
  }
  const fileName = result.rows[0].name;
  const migrationPath = path.join(migrationDir, fileName);
  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Migration file not found: ${migrationPath}`);
  }
  const sql = fs.readFileSync(migrationPath, 'utf8');
  const downSql = sql.replace(/CREATE TABLE/gim, 'DROP TABLE IF EXISTS');
  await pool.query(downSql);
  await pool.query('DELETE FROM schema_migrations WHERE name = $1', [fileName]);
  console.log(`Rolled back ${fileName}`);
}

async function main() {
  await ensureMigrationsTable();
  const command = process.argv[2] ?? 'up';
  const files = fs.readdirSync(migrationDir).filter((f) => f.endsWith('.sql')).sort();
  if (command === 'down') {
    await rollbackLatest();
    return;
  }

  for (const file of files) {
    const migrationName = file;
    const existing = await pool.query('SELECT 1 FROM schema_migrations WHERE name = $1', [migrationName]);
    if (existing.rows.length > 0) continue;
    await applyMigration(path.join(migrationDir, file));
    console.log(`Applied ${migrationName}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
