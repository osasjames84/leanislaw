/**
 * Re-inserts users that were removed by `solo-keep-lb-osamudiame.mjs`, using the last
 * known snapshot from `list-users` (names, emails, DOB, original ids).
 *
 * IMPORTANT:
 * - Original password hashes are gone. Everyone restored gets the SAME temporary password
 *   from env RESTORE_USERS_TEMP_PASSWORD (default below). Users should change it via
 *   forgot-password or you tell them the temp password once.
 * - Related data (workouts, logs, body metrics, etc.) is NOT restored — only `users` rows.
 *
 * Requires: LEANISLAW_RESTORE_DELETED_USERS_CONFIRM=1
 *
 * Usage:
 *   LEANISLAW_RESTORE_DELETED_USERS_CONFIRM=1 npm run db:restore-deleted-users
 */
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const TEMP_PW =
    process.env.RESTORE_USERS_TEMP_PASSWORD || "LeanIsLaw-restore-temp-change-me-2026!";

const url = process.env.DATABASE_URL;
if (!url) {
    console.error("DATABASE_URL missing");
    process.exit(1);
}

if (process.env.LEANISLAW_RESTORE_DELETED_USERS_CONFIRM !== "1") {
    console.error("Refusing: set LEANISLAW_RESTORE_DELETED_USERS_CONFIRM=1");
    process.exit(1);
}

/** Snapshot from list-users before solo delete (ids 1,3,4,… — not 2). DOBs: absurd years 1001/1111 → 2001 placeholders. */
const ROWS = [
    { id: 1, first_name: "John", last_name: "Doe", email: "john.doe@example.com", dob: "1990-05-15" },
    { id: 3, first_name: "ted", last_name: "bundy", email: "tedbundy@gmail.com", dob: "2001-12-12" },
    { id: 4, first_name: "david", last_name: "james", email: "davidjames@gmail.com", dob: "2001-12-12" },
    { id: 5, first_name: "oooo", last_name: "dddd", email: "dododo@gmail.com", dob: "2001-02-22" },
    { id: 6, first_name: "kkno", last_name: "jjnkin", email: "nno@gmail.com", dob: "2001-11-11" },
    { id: 7, first_name: "John", last_name: "Doe", email: "johndoe@gmail.com", dob: "2007-01-03" },
    { id: 8, first_name: "Lucius", last_name: "Adekoya", email: "luciusadekoya@gmail.com", dob: "2004-06-08" },
    { id: 9, first_name: "Emmanuel", last_name: "Eshebor", email: "emmanueleshebor10@gmail.com", dob: "2006-12-08" },
    { id: 10, first_name: "Martin", last_name: "Yu", email: "liangmartin47@gmail.com", dob: "2007-08-16" },
    { id: 11, first_name: "Osamudiame", last_name: "Jamez", email: "gogogo@gmail.com", dob: "2001-02-22" },
    { id: 12, first_name: "Osamudiame", last_name: "Jamez", email: "lanceylancey64@gmail.com", dob: "2001-02-22" },
    { id: 13, first_name: "Osamudiame", last_name: "Jamez", email: "adejokeladipoe@gmail.com", dob: "2001-07-22" },
    { id: 15, first_name: "ddd", last_name: "ddd", email: "osatojames@gmail.com", dob: "2001-02-21" },
    { id: 16, first_name: "Richmond", last_name: "Udanoh", email: "Nonirich06@gmail.com", dob: "2006-10-30" },
    { id: 17, first_name: "Osas", last_name: "David", email: "sugaseanmagic@gmail.com", dob: "2004-06-24" },
    { id: 18, first_name: "Pareesa", last_name: "Zafar", email: "pareesazafar1@gmail.com", dob: "2006-05-25" },
    { id: 19, first_name: "Jacob", last_name: "Smith", email: "liftedjoshua01@gmail.com", dob: "2004-05-04" },
    { id: 22, first_name: "Lifted", last_name: "Joshua", email: "liftedjoshua@gmail.com", dob: "2004-05-04" },
    { id: 23, first_name: "Dilinna", last_name: "Madueke", email: "maduekedilinna@gmail.com", dob: "2003-07-12" },
];

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

const SALT = 10;
const password_hash = await bcrypt.hash(TEMP_PW, SALT);

const client = new pg.Client({ connectionString: url, ssl: sslOption(url) });
await client.connect();

let exitCode = 0;
try {
    await client.query("BEGIN");
    let inserted = 0;
    for (const r of ROWS) {
        const ex = await client.query(`SELECT 1 FROM users WHERE id = $1 OR lower(trim(email)) = lower($2)`, [
            r.id,
            r.email,
        ]);
        if (ex.rowCount > 0) {
            console.log("Skip (exists):", r.id, r.email);
            continue;
        }
        await client.query(
            `
      INSERT INTO users (
        id, first_name, last_name, email, date_of_birth, password_hash, role,
        tdee_onboarding_done, premium_coaching_active, email_verified, failed_login_count
      ) VALUES (
        $1, $2, $3, $4, $5::date, $6, 'client',
        true, false, true, 0
      )
    `,
            [r.id, r.first_name, r.last_name, r.email, r.dob, password_hash],
        );
        inserted++;
        console.log("Inserted id", r.id, r.email);
    }
    await client.query(`SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT COALESCE(MAX(id), 1) FROM users))`);
    await client.query("COMMIT");
    console.log("\nInserted rows:", inserted);
    console.log("Temporary password for ALL restored accounts:", TEMP_PW);
    console.log("Set RESTORE_USERS_TEMP_PASSWORD before running to choose a different one.");
    const { rows: c } = await client.query(`SELECT count(*)::int AS c FROM users`);
    console.log("users.count now:", c[0].c);
} catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    exitCode = 1;
} finally {
    await client.end();
}

process.exit(exitCode);
