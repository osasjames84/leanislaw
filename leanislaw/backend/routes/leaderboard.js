import express from 'express';
import { db } from '../db.js';
import { users, workoutSessions, daily_logs } from '../schema.js';
import { requireAuth } from '../middleware/auth.js';
import { and, count, desc, eq, gte, sql } from 'drizzle-orm';
import { resolveAvatarUrl } from '../lib/userAvatar.js';

const router = express.Router();

function uid(req) {
    return Number(req.userId);
}

function displayNameFromUser(firstName, lastName) {
    const lastInitial = lastName ? `${String(lastName).charAt(0)}.` : '';
    return `${firstName} ${lastInitial}`.trim();
}

/** Pin this name (first / last / email) to rank #1 for display order; scores stay real. */
const TOP_PIN = (process.env.LEADERBOARD_TOP_NAME || 'osamudiame').toLowerCase().trim();

// PFP for the pinned user (served from frontend `public/leaderboard/chad.png` by default).
const CHAD_AVATAR_URL = process.env.LEADERBOARD_CHAD_AVATAR_URL || '/leaderboard/chad.png';

function userMatchesTopPin(u, needle) {
    if (!needle) return false;
    const fn = String(u.firstName || '').toLowerCase();
    const ln = String(u.lastName || '').toLowerCase();
    const em = String(u.email || '').toLowerCase();
    const local = em.includes('@') ? em.split('@')[0] : em;
    return (
        fn.includes(needle) ||
        ln.includes(needle) ||
        em.includes(needle) ||
        local.includes(needle)
    );
}

const notTemplate = sql`(${workoutSessions.is_template} is not true)`;

/**
 * Global steps leaderboard: all signed-up users ranked by sum of daily_logs.steps over windowDays (default 30).
 */
router.get('/global', requireAuth, async (req, res) => {
    try {
        const userId = uid(req);
        const windowDays = Math.min(366, Math.max(1, Number(req.query.window) || 30));

        const start = new Date();
        start.setUTCDate(start.getUTCDate() - windowDays);
        const startDateStr = start.toISOString().slice(0, 10);

        const allUsers = await db
            .select({
                id: users.id,
                firstName: users.first_name,
                lastName: users.last_name,
                email: users.email,
            })
            .from(users);

        const scoreByUser = new Map();
        const sums = await db
            .select({
                userId: daily_logs.userId,
                total: sql`coalesce(sum(${daily_logs.steps}), 0)`.mapWith(Number),
            })
            .from(daily_logs)
            .where(and(gte(daily_logs.date, startDateStr), sql`${daily_logs.userId} is not null`))
            .groupBy(daily_logs.userId);

        for (const row of sums) {
            if (row.userId != null) scoreByUser.set(row.userId, Number(row.total));
        }

        const scored = allUsers.map((u) => {
            const isChadPinned = TOP_PIN ? userMatchesTopPin(u, TOP_PIN) : false;
            return {
            userId: u.id,
            displayName: displayNameFromUser(u.firstName, u.lastName),
            score: scoreByUser.get(u.id) ?? 0,
            avatarUrl: isChadPinned ? CHAD_AVATAR_URL : resolveAvatarUrl({ id: u.id }),
            isYou: u.id === userId,
            };
        });

        scored.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.userId - b.userId;
        });

        const pinUser = TOP_PIN ? allUsers.find((u) => userMatchesTopPin(u, TOP_PIN)) : null;
        if (pinUser) {
            const idx = scored.findIndex((s) => s.userId === pinUser.id);
            if (idx > 0) {
                const [row] = scored.splice(idx, 1);
                scored.unshift(row);
            }
        }

        const ranked = scored.map((e, i) => ({
            rank: i + 1,
            userId: e.userId,
            displayName: e.displayName,
            score: e.score,
            avatarUrl: e.avatarUrl,
            isYou: e.isYou,
        }));

        const me = ranked.find((e) => e.userId === userId) ?? null;
        // Show everyone who has signed up (not just top N).
        const entries = ranked;

        res.json({
            metric: 'steps',
            windowDays,
            region: 'global',
            totalRanked: ranked.length,
            entries,
            me,
        });
    } catch (err) {
        console.error('leaderboard global error:', err);
        res.status(500).json({ error: err.message });
    }
});

/** Top lifters by completed (non-template) workout count. Names are abbreviated for privacy. */
router.get('/workouts', requireAuth, async (req, res) => {
    try {
        const userId = uid(req);

        const [mine] = await db
            .select({ workoutCount: count() })
            .from(workoutSessions)
            .where(and(eq(workoutSessions.user_id, userId), notTemplate));

        const myWorkoutCount = Number(mine?.workoutCount ?? 0);

        const allGrouped = await db
            .select({
                uid: workoutSessions.user_id,
                c: count(workoutSessions.id),
            })
            .from(workoutSessions)
            .where(notTemplate)
            .groupBy(workoutSessions.user_id);

        const myRank =
            myWorkoutCount > 0 ? allGrouped.filter((g) => Number(g.c) > myWorkoutCount).length + 1 : null;

        const rows = await db
            .select({
                userId: users.id,
                firstName: users.first_name,
                lastName: users.last_name,
                workoutCount: count(workoutSessions.id),
            })
            .from(workoutSessions)
            .innerJoin(users, eq(workoutSessions.user_id, users.id))
            .where(notTemplate)
            .groupBy(users.id, users.first_name, users.last_name)
            .orderBy(desc(count(workoutSessions.id)))
            .limit(50);

        const entries = rows.map((r, i) => {
            const lastInitial = r.lastName ? `${String(r.lastName).charAt(0)}.` : '';
            const displayName = `${r.firstName} ${lastInitial}`.trim();
            return {
                rank: i + 1,
                userId: r.userId,
                displayName,
                workoutCount: Number(r.workoutCount),
                isYou: r.userId === userId,
            };
        });

        res.json({
            entries,
            myWorkoutCount,
            myRank,
        });
    } catch (err) {
        console.error('leaderboard error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
