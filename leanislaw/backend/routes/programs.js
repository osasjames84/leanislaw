/**
 * Coach <-> client workout programs.
 *
 *  Coach side (requireCoach + roster ownership):
 *    GET    /clients/:clientId/workouts?week=   list assigned workouts
 *    POST   /clients/:clientId/workouts         assign a workout
 *    PATCH  /workouts/:id                        edit an assigned workout
 *    DELETE /workouts/:id                        remove an assigned workout
 *
 *  Client side (requireAuth, own rows only):
 *    GET    /my/workouts?week=                   this week's plan
 *    POST   /my/workouts/:id/complete           mark done (optional session link)
 *    POST   /my/workouts/:id/skip               mark skipped
 *
 * The weekly report's training adherence uses the count of assigned workouts for
 * the week as the denominator when any exist (see buildBundle.js).
 */

import express from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireCoach } from './coaching.js';
import { assignedWorkouts, coachClients, users, workoutSessions } from '../schema.js';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { resolveWeek } from '../lib/weeklyReport/weekRange.js';

const router = express.Router();

function uid(req) {
    return Number(req.userId);
}

async function ownsClient(coach, clientId) {
    const rows = await db
        .select({ id: coachClients.id })
        .from(coachClients)
        .where(and(eq(coachClients.coach_id, coach), eq(coachClients.client_id, clientId)))
        .limit(1);
    return rows.length > 0;
}

/** Normalize a posted exercises array into the stored shape. */
function cleanExercises(input) {
    if (!Array.isArray(input)) return [];
    return input
        .map((e) => ({
            exercise_id: Number.isFinite(Number(e?.exercise_id)) ? Number(e.exercise_id) : null,
            name: String(e?.name || '').slice(0, 120),
            body_part: e?.body_part ? String(e.body_part).slice(0, 40) : null,
            sets: e?.sets != null && e.sets !== '' ? Number(e.sets) : null,
            reps: e?.reps != null && e.reps !== '' ? String(e.reps).slice(0, 24) : null,
            weight: e?.weight != null && e.weight !== '' ? String(e.weight).slice(0, 24) : null,
            notes: e?.notes ? String(e.notes).slice(0, 240) : null,
        }))
        .filter((e) => e.name);
}

function shapeWorkout(r) {
    return {
        id: r.id,
        title: r.title,
        notes: r.notes,
        scheduled_date: r.scheduled_date,
        exercises: typeof r.exercises === 'string' ? JSON.parse(r.exercises) : r.exercises || [],
        status: r.status,
        completed_at: r.completed_at,
        completed_session_id: r.completed_session_id,
    };
}

/* ----------------------------- coach side ----------------------------- */

router.get('/clients/:clientId/workouts', requireAuth, requireCoach, async (req, res) => {
    try {
        const me = uid(req);
        const clientId = Number(req.params.clientId);
        if (!(await ownsClient(me, clientId))) {
            return res.status(404).json({ error: 'Client not on your roster.' });
        }
        const conds = [eq(assignedWorkouts.client_id, clientId), eq(assignedWorkouts.coach_id, me)];
        if (req.query?.week) {
            const week = resolveWeek(req.query.week);
            conds.push(gte(assignedWorkouts.scheduled_date, week.weekStart));
            conds.push(lte(assignedWorkouts.scheduled_date, week.weekEnd));
        }
        const rows = await db
            .select()
            .from(assignedWorkouts)
            .where(and(...conds))
            .orderBy(asc(assignedWorkouts.scheduled_date), asc(assignedWorkouts.id));
        res.json(rows.map(shapeWorkout));
    } catch (err) {
        console.error('GET /programs/clients/:clientId/workouts:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/clients/:clientId/workouts', requireAuth, requireCoach, async (req, res) => {
    try {
        const me = uid(req);
        const clientId = Number(req.params.clientId);
        if (!(await ownsClient(me, clientId))) {
            return res.status(404).json({ error: 'Client not on your roster.' });
        }
        const title = String(req.body?.title || '').trim().slice(0, 120);
        if (!title) return res.status(400).json({ error: 'A workout title is required.' });
        const [row] = await db
            .insert(assignedWorkouts)
            .values({
                coach_id: me,
                client_id: clientId,
                title,
                notes: req.body?.notes ? String(req.body.notes).slice(0, 2000) : null,
                scheduled_date: req.body?.scheduled_date || null,
                exercises: cleanExercises(req.body?.exercises),
            })
            .returning();
        res.status(201).json(shapeWorkout(row));
    } catch (err) {
        console.error('POST /programs/clients/:clientId/workouts:', err);
        res.status(500).json({ error: err.message });
    }
});

router.patch('/workouts/:id', requireAuth, requireCoach, async (req, res) => {
    try {
        const me = uid(req);
        const id = Number(req.params.id);
        const [existing] = await db
            .select({ id: assignedWorkouts.id })
            .from(assignedWorkouts)
            .where(and(eq(assignedWorkouts.id, id), eq(assignedWorkouts.coach_id, me)))
            .limit(1);
        if (!existing) return res.status(404).json({ error: 'Workout not found.' });

        const set = {};
        if (req.body?.title !== undefined) set.title = String(req.body.title).trim().slice(0, 120);
        if (req.body?.notes !== undefined) set.notes = req.body.notes ? String(req.body.notes).slice(0, 2000) : null;
        if (req.body?.scheduled_date !== undefined) set.scheduled_date = req.body.scheduled_date || null;
        if (req.body?.exercises !== undefined) set.exercises = cleanExercises(req.body.exercises);
        if (req.body?.status !== undefined && ['assigned', 'completed', 'skipped'].includes(req.body.status)) {
            set.status = req.body.status;
        }
        if (!Object.keys(set).length) return res.status(400).json({ error: 'Nothing to update.' });

        const [row] = await db.update(assignedWorkouts).set(set).where(eq(assignedWorkouts.id, id)).returning();
        res.json(shapeWorkout(row));
    } catch (err) {
        console.error('PATCH /programs/workouts/:id:', err);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/workouts/:id', requireAuth, requireCoach, async (req, res) => {
    try {
        const me = uid(req);
        const id = Number(req.params.id);
        await db.delete(assignedWorkouts).where(and(eq(assignedWorkouts.id, id), eq(assignedWorkouts.coach_id, me)));
        res.json({ ok: true });
    } catch (err) {
        console.error('DELETE /programs/workouts/:id:', err);
        res.status(500).json({ error: err.message });
    }
});

/* ----------------------------- client side ----------------------------- */

router.get('/my/workouts', requireAuth, async (req, res) => {
    try {
        const clientId = uid(req);
        const conds = [eq(assignedWorkouts.client_id, clientId)];
        if (req.query?.week) {
            const week = resolveWeek(req.query.week);
            conds.push(gte(assignedWorkouts.scheduled_date, week.weekStart));
            conds.push(lte(assignedWorkouts.scheduled_date, week.weekEnd));
        }
        const rows = await db
            .select()
            .from(assignedWorkouts)
            .where(and(...conds))
            .orderBy(asc(assignedWorkouts.scheduled_date), asc(assignedWorkouts.id));

        // Coach name for a friendly header.
        const [coach] = rows.length
            ? await db
                  .select({ first_name: users.first_name, last_name: users.last_name })
                  .from(users)
                  .where(eq(users.id, rows[0].coach_id))
                  .limit(1)
            : [];
        res.json({
            coach: coach ? `${coach.first_name} ${coach.last_name}`.trim() : null,
            workouts: rows.map(shapeWorkout),
        });
    } catch (err) {
        console.error('GET /programs/my/workouts:', err);
        res.status(500).json({ error: err.message });
    }
});

async function setMyWorkoutStatus(req, res, status) {
    const clientId = uid(req);
    const id = Number(req.params.id);
    const [existing] = await db
        .select({ id: assignedWorkouts.id })
        .from(assignedWorkouts)
        .where(and(eq(assignedWorkouts.id, id), eq(assignedWorkouts.client_id, clientId)))
        .limit(1);
    if (!existing) return res.status(404).json({ error: 'Workout not found.' });

    const set = { status };
    set.completed_at = status === 'completed' ? new Date() : null;
    if (status === 'completed' && req.body?.session_id) {
        const sid = Number(req.body.session_id);
        const [sess] = await db
            .select({ id: workoutSessions.id })
            .from(workoutSessions)
            .where(and(eq(workoutSessions.id, sid), eq(workoutSessions.user_id, clientId)))
            .limit(1);
        if (sess) set.completed_session_id = sid;
    }
    const [row] = await db.update(assignedWorkouts).set(set).where(eq(assignedWorkouts.id, id)).returning();
    res.json(shapeWorkout(row));
}

router.post('/my/workouts/:id/complete', requireAuth, (req, res) => setMyWorkoutStatus(req, res, 'completed'));
router.post('/my/workouts/:id/skip', requireAuth, (req, res) => setMyWorkoutStatus(req, res, 'skipped'));

// GET /api/v1/programs/my/summary — does this client have a coach + how much is
// outstanding. Powers the client app's coaching entry point + badge.
router.get('/my/summary', requireAuth, async (req, res) => {
    try {
        const me = uid(req);
        const [link] = await db
            .select({ coach_id: coachClients.coach_id })
            .from(coachClients)
            .where(eq(coachClients.client_id, me))
            .limit(1);
        if (!link) return res.json({ has_coach: false, todo: 0 });
        const [coach] = await db
            .select({ first_name: users.first_name, last_name: users.last_name })
            .from(users)
            .where(eq(users.id, link.coach_id))
            .limit(1);
        const open = await db
            .select({ status: assignedWorkouts.status })
            .from(assignedWorkouts)
            .where(and(eq(assignedWorkouts.client_id, me), eq(assignedWorkouts.status, 'assigned')));
        res.json({
            has_coach: true,
            coach_name: coach ? `${coach.first_name} ${coach.last_name}`.trim() : null,
            todo: open.length,
        });
    } catch (err) {
        console.error('GET /programs/my/summary:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
