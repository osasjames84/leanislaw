/**
 * Coach <-> client tasks & habits.
 *
 *  Coach (requireCoach + roster ownership):
 *    GET    /clients/:id           list a client's tasks (+ completion summary)
 *    POST   /clients/:id           create { title, description, kind, due_date }
 *    DELETE /:taskId               remove a task
 *
 *  Client (requireAuth, own rows):
 *    GET    /my                    my active tasks (+ today's completion)
 *    POST   /my/:taskId/toggle     toggle completion for a date (default today)
 */

import express from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireCoach } from './coaching.js';
import { clientTasks, taskCompletions, coachClients } from '../schema.js';
import { and, desc, eq, gte, inArray } from 'drizzle-orm';

const router = express.Router();
const uid = (req) => Number(req.userId);
const today = () => new Date().toISOString().slice(0, 10);

async function ownsClient(coach, clientId) {
    const rows = await db.select({ id: coachClients.id }).from(coachClients)
        .where(and(eq(coachClients.coach_id, coach), eq(coachClients.client_id, clientId))).limit(1);
    return rows.length > 0;
}

/* ----------------------------- coach ----------------------------- */

router.get('/clients/:id', requireAuth, requireCoach, async (req, res) => {
    try {
        const me = uid(req); const clientId = Number(req.params.id);
        if (!(await ownsClient(me, clientId))) return res.status(404).json({ error: 'Client not on your roster.' });
        const tasks = await db.select().from(clientTasks)
            .where(and(eq(clientTasks.coach_id, me), eq(clientTasks.client_id, clientId)))
            .orderBy(desc(clientTasks.active), desc(clientTasks.id));
        const ids = tasks.map((t) => t.id);
        const since = new Date(); since.setDate(since.getDate() - 7);
        const comps = ids.length ? await db.select().from(taskCompletions)
            .where(and(inArray(taskCompletions.task_id, ids), gte(taskCompletions.date, since.toISOString().slice(0, 10)))) : [];
        const byTask = new Map();
        for (const c of comps) byTask.set(c.task_id, (byTask.get(c.task_id) || 0) + 1);
        res.json(tasks.map((t) => ({ ...t, last7_completions: byTask.get(t.id) || 0 })));
    } catch (err) { console.error('GET /tasks/clients/:id:', err); res.status(500).json({ error: err.message }); }
});

router.post('/clients/:id', requireAuth, requireCoach, async (req, res) => {
    try {
        const me = uid(req); const clientId = Number(req.params.id);
        if (!(await ownsClient(me, clientId))) return res.status(404).json({ error: 'Client not on your roster.' });
        const title = String(req.body?.title || '').trim().slice(0, 200);
        if (!title) return res.status(400).json({ error: 'A task title is required.' });
        const kind = req.body?.kind === 'habit' ? 'habit' : 'task';
        const [row] = await db.insert(clientTasks).values({
            coach_id: me, client_id: clientId, title,
            description: req.body?.description ? String(req.body.description).slice(0, 1000) : null,
            kind, due_date: kind === 'task' ? (req.body?.due_date || null) : null,
        }).returning();
        res.status(201).json(row);
    } catch (err) { console.error('POST /tasks/clients/:id:', err); res.status(500).json({ error: err.message }); }
});

router.delete('/:taskId', requireAuth, requireCoach, async (req, res) => {
    try {
        await db.delete(clientTasks).where(and(eq(clientTasks.id, Number(req.params.taskId)), eq(clientTasks.coach_id, uid(req))));
        res.json({ ok: true });
    } catch (err) { console.error('DELETE /tasks/:taskId:', err); res.status(500).json({ error: err.message }); }
});

/* ----------------------------- client ----------------------------- */

router.get('/my', requireAuth, async (req, res) => {
    try {
        const me = uid(req); const day = req.query?.date || today();
        const tasks = await db.select().from(clientTasks)
            .where(and(eq(clientTasks.client_id, me), eq(clientTasks.active, true)))
            .orderBy(desc(clientTasks.id));
        const ids = tasks.map((t) => t.id);
        const doneToday = ids.length ? await db.select({ task_id: taskCompletions.task_id })
            .from(taskCompletions).where(and(inArray(taskCompletions.task_id, ids), eq(taskCompletions.date, day))) : [];
        const doneSet = new Set(doneToday.map((d) => d.task_id));
        res.json(tasks.map((t) => ({ id: t.id, title: t.title, description: t.description, kind: t.kind, due_date: t.due_date, done_today: doneSet.has(t.id) })));
    } catch (err) { console.error('GET /tasks/my:', err); res.status(500).json({ error: err.message }); }
});

router.post('/my/:taskId/toggle', requireAuth, async (req, res) => {
    try {
        const me = uid(req); const taskId = Number(req.params.taskId); const day = req.body?.date || today();
        const [task] = await db.select({ id: clientTasks.id }).from(clientTasks)
            .where(and(eq(clientTasks.id, taskId), eq(clientTasks.client_id, me))).limit(1);
        if (!task) return res.status(404).json({ error: 'Task not found.' });
        const [existing] = await db.select({ id: taskCompletions.id }).from(taskCompletions)
            .where(and(eq(taskCompletions.task_id, taskId), eq(taskCompletions.date, day))).limit(1);
        if (existing) {
            await db.delete(taskCompletions).where(eq(taskCompletions.id, existing.id));
            return res.json({ done: false });
        }
        await db.insert(taskCompletions).values({ task_id: taskId, client_id: me, date: day })
            .onConflictDoNothing({ target: [taskCompletions.task_id, taskCompletions.date] });
        res.json({ done: true });
    } catch (err) { console.error('POST /tasks/my/:taskId/toggle:', err); res.status(500).json({ error: err.message }); }
});

export default router;
