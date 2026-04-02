/**
 * Applies backend/migrations/*.sql in filename order (001, 002, …).
 * Safe to re-run when statements use IF NOT EXISTS.
 * Usage: from repo root, `npm run migrate` (loads backend/.env).
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { applySqlMigrations } from "../lib/applySqlMigrations.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, "..");
dotenv.config({ path: path.join(backendRoot, ".env") });

if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set (use backend/.env)");
    process.exit(1);
}

await applySqlMigrations({ verbose: true });
console.log("Done.");
