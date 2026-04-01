import 'dotenv/config'; 
import pkg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import * as schema from './schema.js';

const { Pool, types } = pkg;
// Keep Postgres DATE as plain YYYY-MM-DD strings. Parsing to JS Date + ISO formatting
// shifts the calendar day in some time zones and breaks date-key maps (e.g. dashboard-trend).
types.setTypeParser(1082, (val) => val);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load .env from the backend directory
dotenv.config({ path: path.resolve(__dirname, '.env') });

if(!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

// Create a pool using ONLY the connection string
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('DB connection error:', err);
  } else {
    console.log('DB connected at:', res.rows[0].now);
  }
});

export const db = drizzle(pool, {schema});
export default pool;