import pg, { QueryResultRow } from 'pg';

const { Pool } = pg;
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://riskuser:riskpass@localhost:5432/risk_router';

export const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 5,
});

export async function query<T extends QueryResultRow = Record<string, unknown>>(text: string, params: unknown[] = []) {
  const result = await pool.query<T>(text, params);
  return result.rows as T[];
}
