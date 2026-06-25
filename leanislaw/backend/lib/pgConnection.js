import pg from 'pg';

const REMOTE_SSL_HOST_SUFFIXES = ['.rlwy.net', '.railway.app', '.neon.tech', '.supabase.co'];

function truthyEnv(name) {
    const v = process.env[name];
    return v === '1' || /^true$/i.test(String(v || ''));
}

function buildUrlFromParts() {
    const host = process.env.DB_HOST || '127.0.0.1';
    const port = process.env.DB_PORT || '5432';
    const name = process.env.DB_NAME;
    const user = process.env.DB_USER;
    const password = process.env.DB_PASSWORD;
    if (!user || !name) return null;
    const auth = password
        ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}`
        : encodeURIComponent(user);
    return `postgres://${auth}@${host}:${port}/${name}`;
}

/** Effective connection string for this process (local override, DATABASE_URL, or DB_*). */
export function resolveDatabaseUrl() {
    if (truthyEnv('USE_LOCAL_DB')) {
        return process.env.DATABASE_URL_LOCAL || buildUrlFromParts() || process.env.DATABASE_URL;
    }
    return process.env.DATABASE_URL || buildUrlFromParts();
}

export function needsSsl(connectionString) {
    if (process.env.PG_SSL === '0' || /^false$/i.test(String(process.env.PG_SSL || ''))) {
        return false;
    }
    if (truthyEnv('PG_SSL')) return true;
    try {
        const host = new URL(connectionString.replace(/^postgresql:/, 'postgres:')).hostname;
        if (host === 'localhost' || host === '127.0.0.1') return false;
        if (REMOTE_SSL_HOST_SUFFIXES.some((s) => host.endsWith(s))) return true;
        return host !== '127.0.0.1';
    } catch {
        return false;
    }
}

/** Pool/client options for node-postgres (adds SSL for hosted Postgres). */
export function getPgPoolConfig(connectionString = resolveDatabaseUrl()) {
    if (!connectionString) {
        throw new Error(
            'DATABASE_URL is required (or set USE_LOCAL_DB=1 with DB_USER, DB_NAME, DB_HOST in backend/.env)',
        );
    }
    const config = { connectionString };
    if (needsSsl(connectionString)) {
        config.ssl = { rejectUnauthorized: false };
    }
    return config;
}

export async function verifyPgConnection(connectionString = resolveDatabaseUrl()) {
    const client = new pg.Client(getPgPoolConfig(connectionString));
    await client.connect();
    try {
        await client.query('SELECT 1');
    } finally {
        await client.end();
    }
}

export function dbConnectionHint(err) {
    const msg = String(err?.message || err);
    if (/ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND/i.test(msg)) {
        const usingRemote = !truthyEnv('USE_LOCAL_DB') && /rlwy\.net|railway/i.test(process.env.DATABASE_URL || '');
        if (usingRemote) {
            return 'Remote Postgres unreachable. For local dev, set USE_LOCAL_DB=1 in backend/.env (uses DB_HOST / DB_*).';
        }
    }
    return null;
}
