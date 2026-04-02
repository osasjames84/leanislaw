/**
 * Clears steps on all daily_logs rows, then sets Osamudiame James to 15,389 steps
 * for UTC today (so the default 30-day leaderboard window includes it).
 *
 * Matching: email osasjames84@gmail.com OR (first_name, last_name) = Osamudiame / James.
 *
 * Usage: from leanislaw/, `npm run db:reset-steps-seed-osas`
 * Uses DATABASE_URL from backend/.env
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const TARGET_STEPS = 15_389;
const url = process.env.DATABASE_URL;
if (!url) {
    console.error("DATABASE_URL missing");
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

const client = new pg.Client({ connectionString: url, ssl: sslOption(url) });
let exitCode = 0;
await client.connect();

try {
    const { rowCount: cleared } = await client.query(`
    UPDATE daily_logs SET steps = NULL WHERE steps IS NOT NULL
  `);
    console.log("Cleared steps on daily_logs rows affected:", cleared);

    const { rows } = await client.query(
        `
    SELECT id FROM users
    WHERE lower(email) = lower($1)
       OR (lower(first_name) = lower($2) AND lower(last_name) = lower($3))
    ORDER BY id
    LIMIT 1
  `,
        ["osasjames84@gmail.com", "osamudiame", "james"],
    );

    if (rows.length === 0) {
        console.error("No user matched Osamudiame James (email or name).");
        exitCode = 1;
    } else {
        const userId = Number(rows[0].id);
        const todayUtc = new Date().toISOString().slice(0, 10);

        await client.query(
            `
    INSERT INTO daily_logs (user_id, date, steps)
    VALUES ($1, $2::date, $3)
    ON CONFLICT (user_id, date)
    DO UPDATE SET steps = EXCLUDED.steps
  `,
            [userId, todayUtc, TARGET_STEPS],
        );

        console.log(`Set user id=${userId} steps=${TARGET_STEPS} on date=${todayUtc} (UTC).`);
    }
} finally {
    await client.end();
}

process.exit(exitCode);
