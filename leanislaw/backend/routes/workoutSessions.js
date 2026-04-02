import express from 'express';
import { db } from '../db.js';
import { workoutSessions, exerciseLog, exercises } from '../schema.js';
import { eq, desc, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

function uid(req) {
    const id = Number(req.userId);
    return Number.isFinite(id) ? id : null;
}

/** Drizzle `timestamp` columns call `.toISOString()` on values; JSON bodies use strings — coerce to Date. */
function toPgTimestamp(value, { required = false } = {}) {
    if (value === undefined || value === null) {
        return required ? null : undefined;
    }
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

async function getSessionForUser(sessionId, userId) {
    if (!Number.isFinite(sessionId) || !Number.isFinite(userId)) return null;
    const rows = await db
        .select()
        .from(workoutSessions)
        .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.user_id, userId)))
        .limit(1);
    return rows[0] ?? null;
}

router.get('/test', (req, res) => {
    res.send("If you see this, the route is mounted correctly!");
});

router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = uid(req);
        if (userId == null) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { is_template } = req.query;

        let conditions = eq(workoutSessions.user_id, userId);
        if (is_template !== undefined) {
            conditions = and(conditions, eq(workoutSessions.is_template, is_template === 'true'));
        }

        const sessions = await db
            .select()
            .from(workoutSessions)
            .where(conditions)
            .orderBy(desc(workoutSessions.date));

        res.json(sessions);
    } catch (err) {
        console.error("Backend Crash:", err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/templates', requireAuth, async (req, res) => {
    try {
        const userId = uid(req);
        if (userId == null) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const sessions = await db
            .select()
            .from(workoutSessions)
            .where(and(eq(workoutSessions.user_id, userId), eq(workoutSessions.is_template, true)))
            .orderBy(desc(workoutSessions.date));
        res.json(sessions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id', requireAuth, async (req, res) => {
    try {
        const workoutSessionsId = Number(req.params.id);
        const userId = uid(req);
        if (userId == null) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const row = await getSessionForUser(workoutSessionsId, userId);
        if (!row) {
            return res.status(404).json({ error: 'Not found' });
        }
        res.json(row);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Create a new workout session (user comes from JWT — never trust client user_id)
router.post('/', requireAuth, async (req, res) => {
    try{
         console.log('req.body:', req.body);
         const { name, is_template, notes, date } = req.body;
         const user_id = Number(req.userId);

        if (!name || !Number.isFinite(user_id)) {
            return res.status(400).json({ message: "Missing workout name" });
        }
         const sessionDate = toPgTimestamp(date) ?? new Date();
         const [newWorkoutSession] = await db.insert(workoutSessions)
         .values({
            name,
            is_template: is_template || false,
            user_id,
            notes: notes || "",
            date: sessionDate,
            }).returning();

            if(!newWorkoutSession){
            return res.status(404).json({message: 'Failed to add'});
        }

            res.status(201).json(newWorkoutSession);
      

    } catch(err){
        console.error('Session not created: ', err);
        res.status(500).json({error: err.message});
    }
})

router.patch('/:id', requireAuth, async (req, res) => {
    const workoutSessionsId = Number(req.params.id);
    const userId = uid(req);
    const { name, is_template, notes } = req.body;

    try {
        const owned = await getSessionForUser(workoutSessionsId, userId);
        if (!owned) {
            return res.status(404).send({ message: 'Not found' });
        }

        const patch = {};
        if (name !== undefined) patch.name = name;
        if (is_template !== undefined) patch.is_template = is_template;
        if (notes !== undefined) patch.notes = notes;

        const [updatedSession] = await db
            .update(workoutSessions)
            .set(patch)
            .where(and(eq(workoutSessions.id, workoutSessionsId), eq(workoutSessions.user_id, userId)))
            .returning();

        if (!updatedSession) {
            return res.status(404).send({ message: 'Not found' });
        }

        res.status(201).json({
            message: `Workout session ${updatedSession.name} has been updated`,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const workoutSessionsId = Number(req.params.id);
        const userId = uid(req);
        const [deletedSession] = await db
            .delete(workoutSessions)
            .where(and(eq(workoutSessions.id, workoutSessionsId), eq(workoutSessions.user_id, userId)))
            .returning();

        if (!deletedSession) {
            return res.status(404).json({ message: 'Session not found' });
        }

        res.status(200).json({
            message: `Session ${deletedSession.name} has been deleted`,
            workoutSessions: deletedSession,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/:id/exerciseLogs', requireAuth, async (req, res) => {
    try {
        const sessionId = Number(req.params.id);
        const userId = uid(req);
        const { exercise_id, sets, reps, rpe, weight } = req.body;

        if (!sessionId || !exercise_id) {
            return res.status(400).json({ message: "Missing sessionId or exercise_id" });
        }

        const owned = await getSessionForUser(sessionId, userId);
        if (!owned) {
            return res.status(404).json({ message: 'Session not found' });
        }

        const [newLog] = await db
            .insert(exerciseLog)
            .values({
                workoutSessionsId: sessionId, // Links to the parent session
                exercise_id,
                sets,
                reps,
                rpe,
                weight,
                // createdAt defaults to now() in the DB schema
            })
            .returning();

        if (!newLog) {
            return res.status(404).json({ message: 'Failed to add log' });
        }

        res.status(201).json(newLog);

    } catch (err) {
        console.error('Log creation error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id/exerciseLogs', requireAuth, async (req, res) => {
    try {
        const sessionId = Number(req.params.id);
        const userId = uid(req);
        const owned = await getSessionForUser(sessionId, userId);
        if (!owned) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const logs = await db
            .select({
                id: exerciseLog.id,
                exerciseName: exercises.name,
                sets: exerciseLog.sets,
                reps: exerciseLog.reps,
                rpe: exerciseLog.rpe,
                weight: exerciseLog.weight,
                createdAt: exerciseLog.createdAt,
            })
            .from(exerciseLog)
            .leftJoin(exercises, eq(exerciseLog.exercise_id, exercises.id))
            .where(eq(exerciseLog.workoutSessionsId, sessionId));
const formattedLogs = logs.map(log => ({
            ...log,
            sets: typeof log.sets === 'string' ? JSON.parse(log.sets) : (log.sets || [])
        }));

        res.json(formattedLogs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id/full', requireAuth, async (req, res) => {
    try {
        const sessionId = Number(req.params.id);
        const userId = uid(req);

        const fullSession = await db.query.workoutSessions.findFirst({
            where: eq(workoutSessions.id, sessionId),
            with: {
                exerciseLogs: true,
            },
        });
        if (!fullSession || fullSession.user_id !== userId) {
            return res.status(404).json({ message: 'Workout Session Id not found' });
        }

        res.json(fullSession);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch workout session data' });
    }
});

router.put('/:id', requireAuth, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const userId = uid(req);
        const { is_template, end_time } = req.body;

        const owned = await getSessionForUser(id, userId);
        if (!owned) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const setPayload = {};
        if (is_template !== undefined) setPayload.is_template = is_template;
        if (end_time !== undefined) {
            const endAt = toPgTimestamp(end_time, { required: true });
            if (endAt == null) {
                return res.status(400).json({ error: 'Invalid end_time' });
            }
            setPayload.endTime = endAt;
        }

        if (Object.keys(setPayload).length === 0) {
            return res.json(owned);
        }

        const updatedSession = await db
            .update(workoutSessions)
            .set(setPayload)
            .where(and(eq(workoutSessions.id, id), eq(workoutSessions.user_id, userId)))
            .returning();

        if (updatedSession.length === 0) {
            return res.status(404).json({ error: 'Session not found' });
        }

        res.json(updatedSession[0]);
    } catch (err) {
        console.error("PUT Error:", err);
        res.status(500).json({ error: err.message });
    }
});

export default router;