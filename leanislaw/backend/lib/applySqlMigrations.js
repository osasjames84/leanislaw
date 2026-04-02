import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultMigrationsDir = path.join(__dirname, "..", "migrations");

/**
 * Runs backend/migrations/*.sql in sorted order. Intended to be idempotent (IF NOT EXISTS, etc.).
 * @param {{ databaseUrl?: string, migrationsDir?: string, verbose?: boolean }} [options]
 */
export async function applySqlMigrations(options = {}) {
    const databaseUrl = options.databaseUrl || process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error("applySqlMigrations: set databaseUrl or DATABASE_URL");
    }
    const migrationsDir = options.migrationsDir || defaultMigrationsDir;
    const verbose = Boolean(options.verbose);

    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
    const client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
    try {
        for (const file of files) {
            const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
            await client.query(sql);
            if (verbose) console.log("[migrate]", file);
        }
    } finally {
        await client.end();
    }
}
