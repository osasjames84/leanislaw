import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { users } from '../schema.js';
import { eq } from 'drizzle-orm';
import { JWT_SECRET, requireAuth } from '../middleware/auth.js';

const router = express.Router();
const SALT_ROUNDS = 10;

function stripPassword(userRow) {
    if (!userRow) return null;
    const { password_hash, ...rest } = userRow;
    return rest;
}

function signToken(user) {
    return jwt.sign(
        { sub: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

// POST /api/v1/auth/register
router.post('/register', async (req, res) => {
    const { first_name, last_name, email, password, date_of_birth, role } = req.body;

    if (!first_name || !last_name || !email || !password || !date_of_birth) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
        const [user] = await db
            .insert(users)
            .values({
                first_name,
                last_name,
                email,
                date_of_birth,
                password_hash,
                role: role === 'coach' ? 'coach' : 'client',
                tdee_onboarding_done: false,
            })
            .returning();

        const safe = stripPassword(user);
        const token = signToken(user);
        res.status(201).json({ token, user: safe });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Email already registered' });
        }
        console.error('Register error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    try {
        const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const user = rows[0];
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const safe = stripPassword(user);
        const token = signToken(user);
        res.json({ token, user: safe });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/auth/tdee-onboarding/complete — mark one-time setup done
router.post('/tdee-onboarding/complete', requireAuth, async (req, res) => {
    try {
        await db
            .update(users)
            .set({ tdee_onboarding_done: true })
            .where(eq(users.id, req.userId));
        const rows = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(stripPassword(rows[0]));
    } catch (err) {
        console.error('tdee-onboarding/complete error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/auth/tdee-onboarding/reset — local/testing only (set ALLOW_TDEE_ONBOARDING_RESET=true)
router.post('/tdee-onboarding/reset', requireAuth, async (req, res) => {
    if (process.env.ALLOW_TDEE_ONBOARDING_RESET !== 'true') {
        return res.status(403).json({ error: 'Not allowed' });
    }
    try {
        await db
            .update(users)
            .set({ tdee_onboarding_done: false })
            .where(eq(users.id, req.userId));
        const rows = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(stripPassword(rows[0]));
    } catch (err) {
        console.error('tdee-onboarding/reset error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/auth/me — current user from JWT
router.get('/me', requireAuth, async (req, res) => {
    try {
        const rows = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(stripPassword(rows[0]));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
