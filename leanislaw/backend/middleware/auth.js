import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { users } from '../schema.js';
import { eq } from 'drizzle-orm';

// JWT secret MUST come from the environment. A hardcoded fallback lets anyone
// reading the source forge tokens for any user — so in production we refuse to
// start without it, and in dev we use an ephemeral random secret (tokens reset
// on restart) rather than a well-known string.
function resolveJwtSecret() {
    const fromEnv = process.env.JWT_SECRET;
    if (fromEnv && fromEnv.length >= 16) return fromEnv;
    if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET is not set (or too short). Refusing to start in production.');
    }
    console.warn('[auth] JWT_SECRET not set — using an ephemeral dev secret (tokens reset on restart).');
    return `dev-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}
const JWT_SECRET = resolveJwtSecret();

export async function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    let payload;
    try {
        const token = header.slice(7);
        payload = jwt.verify(token, JWT_SECRET);
    } catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const userId = Number(payload.sub);
    try {
        // Some Railway databases lag behind the current app schema (e.g. missing `email_verified`).
        // To keep the app usable, fall back to "allow" when the column doesn't exist.
        let rows;
        try {
            rows = await db
                .select({ email_verified: users.email_verified })
                .from(users)
                .where(eq(users.id, userId))
                .limit(1);
        } catch (e) {
            rows = await db
                .select({ id: users.id })
                .from(users)
                .where(eq(users.id, userId))
                .limit(1);
        }

        if (rows.length === 0) return res.status(401).json({ error: 'Unauthorized' });

        const emailVerified = rows[0].email_verified;
        if (typeof emailVerified === "boolean" && !emailVerified) {
            return res.status(403).json({
                error: 'Verify your email before using the app.',
                code: 'EMAIL_NOT_VERIFIED',
            });
        }
        req.userId = userId;
        req.userEmail = payload.email;
        next();
    } catch (e) {
        console.error('requireAuth db error:', e);
        res.status(500).json({ error: 'Internal error' });
    }
}

export { JWT_SECRET };
