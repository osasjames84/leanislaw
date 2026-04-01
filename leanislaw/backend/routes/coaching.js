import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../db.js';
import { users } from '../schema.js';
import { eq } from 'drizzle-orm';

const router = express.Router();

async function loadUserRole(userId) {
    const rows = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
    return rows[0]?.role ?? null;
}

/** Coach-only routes */
export async function requireCoach(req, res, next) {
    try {
        const role = await loadUserRole(req.userId);
        if (role !== 'coach') {
            return res.status(403).json({ error: 'Coach access only' });
        }
        next();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// GET /api/v1/coaching/status — coaching tier + role for UI
router.get('/status', requireAuth, async (req, res) => {
    try {
        const rows = await db
            .select({
                role: users.role,
                premium_coaching_active: users.premium_coaching_active,
            })
            .from(users)
            .where(eq(users.id, req.userId))
            .limit(1);
        if (!rows.length) return res.status(404).json({ error: 'User not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/coaching/panel — placeholder coach dashboard data
router.get('/panel', requireAuth, requireCoach, async (_req, res) => {
    res.json({
        headline: 'Coach dashboard',
        clients_preview: [],
        message: 'Client roster and messaging will connect here after payments go live.',
    });
});

/**
 * Dev / staging: unlock premium without Stripe. Production: set ALLOW_COACHING_DEV_UNLOCK=true only if you need it.
 * Real payments: implement POST /webhooks/stripe and set premium_coaching_active from checkout.session.completed.
 */
router.post('/dev/unlock-premium', requireAuth, async (req, res) => {
    const allowed =
        process.env.NODE_ENV !== 'production' || process.env.ALLOW_COACHING_DEV_UNLOCK === 'true';
    if (!allowed) {
        return res.status(403).json({ error: 'Dev unlock disabled in production' });
    }
    try {
        await db
            .update(users)
            .set({ premium_coaching_active: true })
            .where(eq(users.id, req.userId));
        const rows = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
        if (!rows.length) return res.status(404).json({ error: 'User not found' });
        const { password_hash, ...safe } = rows[0];
        res.json({ ok: true, user: safe });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
