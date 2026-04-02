import express from 'express';
import { db } from '../db.js';
import { exerciseLog, exercises, workoutSessions } from '../schema.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

function uid(req) {
    const id = Number(req.userId);
    return Number.isFinite(id) ? id : null;
}

async function sessionOwnedByUser(sessionId, userId) {
    if (!Number.isFinite(sessionId) || !Number.isFinite(userId)) return false;
    const rows = await db
        .select({ id: workoutSessions.id })
        .from(workoutSessions)
        .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.user_id, userId)))
        .limit(1);
    return rows.length > 0;
}

async function logOwnedByUser(logId, userId) {
    const logRows = await db.select().from(exerciseLog).where(eq(exerciseLog.id, logId)).limit(1);
    const log = logRows[0];
    if (!log) return null;
    const ok = await sessionOwnedByUser(log.workoutSessionsId, userId);
    return ok ? log : null;
}

router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = uid(req);
        const wid = Number(req.query.workout_sessions_id);
        if (!Number.isFinite(wid)) {
            return res.status(400).json({ error: 'workout_sessions_id required' });
        }
        const ok = await sessionOwnedByUser(wid, userId);
        if (!ok) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const logs = await db
            .select({
                id: exerciseLog.id,
                exercise_id: exerciseLog.exercise_id,
                sets: exerciseLog.sets,
                name: exercises.name,
            })
            .from(exerciseLog)
            .leftJoin(exercises, eq(exerciseLog.exercise_id, exercises.id))
            .where(eq(exerciseLog.workoutSessionsId, wid));

        res.json(
            logs.map((log) => ({
                ...log,
                sets: Array.isArray(log.sets) ? log.sets : [],
            }))
        );
    } catch (err) {
        console.error("SQL Error:", err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id', requireAuth, async (req, res) => {
    try {
        const userId = uid(req);
        const exerciseLogId = Number(req.params.id);
        const log = await logOwnedByUser(exerciseLogId, userId);
        if (!log) {
            return res.status(404).send({ error: "Not found" });
        }
        res.json(log);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', requireAuth, async (req, res) => {
    try {
        const userId = uid(req);
        const { workout_sessions_id, exercise_id } = req.body;
        const sid = Number(workout_sessions_id);
        const eid = Number(exercise_id);
        if (!Number.isFinite(eid)) {
            return res.status(400).json({ error: 'Invalid exercise_id' });
        }
        const ok = await sessionOwnedByUser(sid, userId);
        if (!ok) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const existing = await db
            .select({
                id: exerciseLog.id,
                exercise_id: exerciseLog.exercise_id,
                sets: exerciseLog.sets,
                name: exercises.name,
            })
            .from(exerciseLog)
            .leftJoin(exercises, eq(exerciseLog.exercise_id, exercises.id))
            .where(and(eq(exerciseLog.workoutSessionsId, sid), eq(exerciseLog.exercise_id, eid)))
            .limit(1);

        if (existing.length > 0) {
            const log = existing[0];
            return res.status(200).json({
                ...log,
                sets: Array.isArray(log.sets) ? log.sets : [],
            });
        }

        const [newLog] = await db
            .insert(exerciseLog)
            .values({
                workoutSessionsId: sid,
                exercise_id: eid,
                sets: [],
            })
            .returning();

        res.status(201).json(newLog);
    } catch (err) {
        console.error("Insert Error:", err);
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', requireAuth, async (req, res) => {
    try {
        const userId = uid(req);
        const logId = Number(req.params.id);
        const log = await logOwnedByUser(logId, userId);
        if (!log) {
            return res.status(404).json({ error: 'Not found' });
        }

        const { sets } = req.body;
        const updatedLog = await db
            .update(exerciseLog)
            .set({
                sets: sets || [],
            })
            .where(eq(exerciseLog.id, logId))
            .returning();

        res.json(updatedLog[0]);
    } catch (err) {
        console.error("PUT Error:", err);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const userId = uid(req);
        const logId = Number(req.params.id);
        const log = await logOwnedByUser(logId, userId);
        if (!log) {
            return res.status(404).json({ error: 'Not found' });
        }

        const deletedLog = await db.delete(exerciseLog).where(eq(exerciseLog.id, logId)).returning();

        res.json({ message: "Deleted", log: deletedLog[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
