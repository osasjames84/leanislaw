import express from 'express';
import { db } from '../db.js';
import { users } from '../schema.js';
import { eq, ilike, or } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * User lookup routes. All require auth and only ever return PUBLIC-SAFE fields —
 * never password_hash, email, verification/reset tokens, or DOB. (Previously
 * these were unauthenticated and returned full rows, leaking every user's
 * password hash + email.)
 */
const PUBLIC_COLS = {
    id: users.id,
    first_name: users.first_name,
    last_name: users.last_name,
    username: users.username,
    profile_image_url: users.profile_image_url,
    role: users.role,
};

// Account creation is handled by /api/v1/auth/register only. The old open POST
// here allowed anyone to create accounts with an arbitrary role — disabled.
router.post('/', (_req, res) => {
    res.status(410).json({ error: 'Use /api/v1/auth/register to create an account.' });
});

// GET /api/v1/users?search= — directory lookup (auth required, safe fields).
router.get('/', requireAuth, async (req, res) => {
    try {
        const q = req.query?.search ? String(req.query.search).trim() : '';
        let rows;
        if (q) {
            rows = await db.select(PUBLIC_COLS).from(users)
                .where(or(ilike(users.first_name, `%${q}%`), ilike(users.last_name, `%${q}%`), ilike(users.username, `%${q}%`)))
                .limit(25);
        } else {
            rows = await db.select(PUBLIC_COLS).from(users).limit(50);
        }
        res.json(rows);
    } catch (err) {
        console.error('GET /users:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/users/id/:id — single user, safe fields.
router.get('/id/:id', requireAuth, async (req, res) => {
    try {
        const [row] = await db.select(PUBLIC_COLS).from(users).where(eq(users.id, Number(req.params.id))).limit(1);
        if (!row) return res.status(404).json({ error: 'Not found' });
        res.json(row);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// GET /api/v1/users/name/:name — name search, safe fields.
router.get('/name/:name', requireAuth, async (req, res) => {
    try {
        const name = String(req.params.name);
        const rows = await db.select(PUBLIC_COLS).from(users)
            .where(or(ilike(users.first_name, `%${name}%`), ilike(users.last_name, `%${name}%`)))
            .limit(25);
        if (!rows.length) return res.status(404).json({ error: 'Not Found' });
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/users/:id/workouts — own workouts only (no cross-user access).
router.get('/:id/workouts', requireAuth, async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (id !== Number(req.userId)) return res.status(403).json({ error: 'You can only view your own workouts.' });
        const data = await db.query.users.findFirst({ where: eq(users.id, id), with: { workoutSessions: true } });
        if (!data) return res.status(404).json({ message: 'User not found' });
        const { password_hash, email_verification_token, password_reset_code_hash, ...safe } = data;
        void password_hash; void email_verification_token; void password_reset_code_hash;
        res.json(safe);
    } catch (err) {
        console.error('GET /users/:id/workouts:', err);
        res.status(500).json({ error: 'Failed to fetch user data' });
    }
});

export default router;
