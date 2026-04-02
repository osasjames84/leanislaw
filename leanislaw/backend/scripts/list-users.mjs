/**
 * List users from the DB in DATABASE_URL (local or Railway).
 * Omits password hashes and other sensitive token columns.
 *
 * Usage (from repo leanislaw/):
 *   node backend/scripts/list-users.mjs
 *   node backend/scripts/list-users.mjs --json
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const asJson = process.argv.includes("--json");
const url = process.env.DATABASE_URL;
if (!url) {
    console.error("DATABASE_URL is not set. Add it to backend/.env or export it.");
    process.exit(1);
}

function sslOption(connectionString) {
    try {
        const normalized = connectionString.replace(/^postgresql:\/\//i, "https://");
        const host = new URL(normalized).hostname;
        if (host === "localhost" || host === "127.0.0.1") return undefined;
        return { rejectUnauthorized: false };
    } catch {
        return { rejectUnauthorized: false };
    }
}

const SENSITIVE = new Set([
    "password_hash",
    "email_verification_token",
    "password_reset_code_hash",
]);

const client = new pg.Client({ connectionString: url, ssl: sslOption(url) });
await client.connect();

const { rows: colRows } = await client.query(`
  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'users'
  ORDER BY ordinal_position
`);

const columns = colRows.map((r) => r.column_name).filter((c) => !SENSITIVE.has(c));

if (columns.length === 0) {
    console.error('No public.users table or no columns found.');
    await client.end();
    process.exit(1);
}

const selectSql = `SELECT ${columns.join(", ")} FROM users ORDER BY id`;
const { rows } = await client.query(selectSql);

if (asJson) {
    console.log(JSON.stringify(rows, null, 2));
} else {
    for (const u of rows) {
        const name = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
        const extra = columns
            .filter((c) => !["id", "first_name", "last_name", "email"].includes(c))
            .map((c) => `${c}=${u[c]}`)
            .join("\t");
        console.log(`#${u.id}\t${name}\t${u.email ?? ""}\t${extra}`);
    }
}

console.error(`\nTotal: ${rows.length} users`);
await client.end();
