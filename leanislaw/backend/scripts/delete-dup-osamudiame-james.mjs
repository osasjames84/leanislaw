/**
 * Delete users named Osamudiame James whose email is NOT osasjames84@gmail.com.
 * Keeps the canonical account; removes workout + daily log data first (FK-safe).
 *
 * Usage: npm run db:delete-dup-osamudiame
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const CANONICAL_EMAIL = "osasjames84@gmail.com";

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
await client.connect();

let exitCode = 0;
try {
    const [canon] = (
        await client.query(`SELECT id, email FROM users WHERE lower(trim(email)) = lower($1) LIMIT 1`, [
            CANONICAL_EMAIL,
        ])
    ).rows;

    if (!canon) {
        console.warn("Warning: no user with email", CANONICAL_EMAIL, "— still removing name duplicates.");
    } else {
        console.log("Keeping canonical user id=%s %s", canon.id, canon.email);
    }

    const { rows: victims } = await client.query(
        `
    SELECT id, email, first_name, last_name
    FROM users
    WHERE lower(trim(first_name)) = 'osamudiame'
      AND lower(trim(last_name)) = 'james'
      AND lower(trim(email)) <> lower($1)
    ORDER BY id
  `,
        [CANONICAL_EMAIL],
    );

    if (victims.length === 0) {
        console.log("No duplicate Osamudiame James rows to delete.");
    } else {
        console.log(
            "Deleting %s user(s):",
            victims.length,
            victims.map((r) => `${r.id} <${r.email}>`).join(", "),
        );

        await client.query("BEGIN");
        try {
            const ids = victims.map((v) => v.id);
            await client.query(
                `
        DELETE FROM exercise_logs
        WHERE workout_sessions_id IN (
          SELECT id FROM workout_sessions WHERE user_id = ANY($1::int[])
        )
      `,
                [ids],
            );
            await client.query(`DELETE FROM workout_sessions WHERE user_id = ANY($1::int[])`, [ids]);
            await client.query(`DELETE FROM daily_logs WHERE user_id = ANY($1::int[])`, [ids]);
            const del = await client.query(`DELETE FROM users WHERE id = ANY($1::int[]) RETURNING id`, [ids]);
            console.log("Deleted user ids:", del.rows.map((r) => r.id).join(", "));
            await client.query("COMMIT");
        } catch (e) {
            await client.query("ROLLBACK");
            throw e;
        }
    }
} catch (e) {
    console.error(e);
    exitCode = 1;
} finally {
    await client.end();
}

process.exit(exitCode);
