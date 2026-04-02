/**
 * Only removes *duplicate Osamudiame* rows (name/email contains LEADERBOARD_TOP_NAME needle).
 * Does not delete unrelated users.
 *
 * Requires: LEANISLAW_OSAMUDIAME_DUPE_PRUNE_CONFIRM=PRUNE_DUPES_ONLY
 *
 *   LEANISLAW_OSAMUDIAME_DUPE_PRUNE_CONFIRM=PRUNE_DUPES_ONLY npm run db:prune-osamudiame-dupes
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const NEEDLE = (process.env.LEADERBOARD_TOP_NAME || "osamudiame").toLowerCase().trim();
const CANONICAL_EMAIL = (process.env.KEEP_SOLO_USER_EMAIL || "osasjames84@gmail.com").trim().toLowerCase();

const url = process.env.DATABASE_URL;
if (!url) {
    console.error("DATABASE_URL missing");
    process.exit(1);
}

if (process.env.LEANISLAW_OSAMUDIAME_DUPE_PRUNE_CONFIRM !== "PRUNE_DUPES_ONLY") {
    console.error("Refusing: set LEANISLAW_OSAMUDIAME_DUPE_PRUNE_CONFIRM=PRUNE_DUPES_ONLY");
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
    const { rows: byEmail } = await client.query(
        `SELECT id, email, first_name, last_name FROM users WHERE lower(trim(email)) = $1 LIMIT 1`,
        [CANONICAL_EMAIL],
    );

    let keep;
    if (byEmail.length > 0) {
        keep = byEmail[0];
    } else {
        const { rows: byPin } = await client.query(
            `
      SELECT id, email, first_name, last_name
      FROM users
      WHERE
        lower(trim(first_name)) LIKE '%' || $1 || '%'
        OR lower(trim(last_name)) LIKE '%' || $1 || '%'
        OR lower(trim(email)) LIKE '%' || $1 || '%'
        OR split_part(lower(trim(email)), '@', 1) LIKE '%' || $1 || '%'
      ORDER BY id
      LIMIT 1
    `,
            [NEEDLE],
        );
        if (byPin.length === 0) {
            console.error("No canonical / pin user to keep. Nothing deleted.");
            exitCode = 1;
            process.exit(exitCode);
        }
        keep = byPin[0];
    }

    console.log("Keeping id=%s <%s>", keep.id, keep.email);

    const { rows: victims } = await client.query(
        `
    SELECT id, email FROM users
    WHERE id <> $1
      AND (
        lower(trim(first_name)) LIKE '%' || $2 || '%'
        OR lower(trim(last_name)) LIKE '%' || $2 || '%'
        OR lower(trim(email)) LIKE '%' || $2 || '%'
        OR split_part(lower(trim(email)), '@', 1) LIKE '%' || $2 || '%'
      )
    ORDER BY id
  `,
        [keep.id, NEEDLE],
    );

    if (victims.length === 0) {
        console.log("No duplicate Osamudiame accounts.");
        process.exit(0);
    }

    console.log("Deleting %s dupes: %s", victims.length, victims.map((v) => `${v.id}<${v.email}>`).join(", "));

    const ids = victims.map((v) => v.id);

    async function safeDelete(sql, params) {
        try {
            await client.query(sql, params);
        } catch (e) {
            if (e.code === "42P01") return;
            throw e;
        }
    }

    await client.query("BEGIN");
    try {
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
        await safeDelete(`DELETE FROM chat_messages WHERE user_id = ANY($1::int[])`, [ids]);
        await safeDelete(`DELETE FROM user_chad_profile WHERE user_id = ANY($1::int[])`, [ids]);
        await client.query(`DELETE FROM food_log_entries WHERE user_id = ANY($1::int[])`, [ids]);
        await client.query(`DELETE FROM strength_snapshots WHERE user_id = ANY($1::int[])`, [ids]);
        await client.query(`DELETE FROM user_strength_profile WHERE user_id = ANY($1::int[])`, [ids]);
        await client.query(`DELETE FROM user_tdee_state WHERE user_id = ANY($1::int[])`, [ids]);
        await client.query(`DELETE FROM user_macro_plan WHERE user_id = ANY($1::int[])`, [ids]);
        await client.query(`DELETE FROM body_metrics WHERE user_id = ANY($1::int[])`, [ids]);
        await client.query(`DELETE FROM daily_tdee_inputs WHERE user_id = ANY($1::int[])`, [ids]);
        await client.query(`DELETE FROM daily_logs WHERE user_id = ANY($1::int[])`, [ids]);
        const del = await client.query(`DELETE FROM users WHERE id = ANY($1::int[]) RETURNING id`, [ids]);
        console.log("Deleted:", del.rows.map((r) => r.id).join(", "));
        await client.query("COMMIT");
    } catch (e) {
        await client.query("ROLLBACK");
        throw e;
    }
} catch (e) {
    console.error(e);
    exitCode = 1;
} finally {
    await client.end();
}

process.exit(exitCode);
