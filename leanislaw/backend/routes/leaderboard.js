import express from 'express';
import { db } from '../db.js';
import { users, workoutSessions } from '../schema.js';
import { requireAuth } from '../middleware/auth.js';
import { and, count, desc, eq, sql } from 'drizzle-orm';

const router = express.Router();

function uid(req) {
    return Number(req.userId);
}

const notTemplate = sql`(${workoutSessions.is_template} is not true)`;

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
