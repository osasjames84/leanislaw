import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { users } from '../schema.js';
import { eq } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'leanislaw-dev-secret-change-in-production';

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
        const rows = await db
            .select({ email_verified: users.email_verified })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (!rows[0].email_verified) {
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
