/**
 * Applies backend/migrations/*.sql in filename order (001, 002, …).
 * Safe to re-run when statements use IF NOT EXISTS.
 * Usage: from repo root, `npm run migrate` (loads backend/.env).
 */
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, "..");
dotenv.config({ path: path.join(backendRoot, ".env") });

const url = process.env.DATABASE_URL;
if (!url) {
    console.error("DATABASE_URL is not set (use backend/.env)");
    process.exit(1);
}

const migrationsDir = path.join(backendRoot, "migrations");
const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
    for (const file of files) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
        await client.query(sql);
        console.log("Applied:", file);
    }
    console.log("Done.");
} finally {
    await client.end();
}
