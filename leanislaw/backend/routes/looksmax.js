/**
 * Looksmax game loop endpoints (the client's gamified home).
 *   GET /me/journey   score, rank, level/xp, streak, quests, achievements (+ fast coach line)
 *   GET /me/coach     Claude-generated daily coach line (loaded async; can be slower)
 *   GET /leaderboard  top ascenders by score (first name + last initial only)
 */

import express from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { userProgress, users } from '../schema.js';
import { desc, eq, gt } from 'drizzle-orm';
import { buildJourney } from '../lib/looksmax/engine.js';
import { dailyCoachLine } from '../lib/looksmax/aiCoach.js';

const router = express.Router();
const uid = (req) => Number(req.userId);

router.get('/me/journey', requireAuth, async (req, res) => {
    try {
        const journey = await buildJourney(uid(req));
        const coach = await dailyCoachLine(journey); // deterministic unless ANTHROPIC_API_KEY set
        res.json({ ...journey, coach });
    } catch (err) {
        console.error('GET /looksmax/me/journey:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/me/coach', requireAuth, async (req, res) => {
    try {
        const journey = await buildJourney(uid(req));
        res.json(await dailyCoachLine(journey));
    } catch (err) {
        console.error('GET /looksmax/me/coach:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/leaderboard', requireAuth, async (req, res) => {
    try {
        const rows = await db
            .select({
                user_id: userProgress.user_id, score: userProgress.looksmax_score, rank: userProgress.rank,
                level: userProgress.level, streak: userProgress.streak_days,
                first_name: users.first_name, last_name: users.last_name,
            })
            .from(userProgress)
            .innerJoin(users, eq(users.id, userProgress.user_id))
            .where(gt(userProgress.looksmax_score, 0))
            .orderBy(desc(userProgress.looksmax_score))
            .limit(50);
        const me = uid(req);
        res.json(rows.map((r, i) => ({
            position: i + 1,
            is_me: r.user_id === me,
            name: `${r.first_name} ${(r.last_name || '').slice(0, 1)}.`.trim(),
            score: r.score, rank: r.rank, level: r.level, streak: r.streak,
        })));
    } catch (err) {
        console.error('GET /looksmax/leaderboard:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
