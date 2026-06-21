import express from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireCoach } from './coaching.js';
import {
    coachClients,
    clientSafeguarding,
    weeklyReports,
    weeklyDashboards,
    users,
    bodyMetrics,
    workoutSessions,
    exerciseLog,
    exercises,
    assignedWorkouts,
    clientTasks,
    taskCompletions,
    foodLogEntries,
    weeklyCheckins,
    progressPhotos,
    clientProfile,
} from '../schema.js';
import { and, asc, desc, eq, gte, inArray } from 'drizzle-orm';
import { normalizeUsername } from '../lib/username.js';
import { resolveWeek } from '../lib/weeklyReport/weekRange.js';
import { generateWeeklyReports } from '../lib/weeklyReport/generate.js';
import { computeProgression } from '../lib/weeklyReport/progression.js';
import { generateAiOverview } from '../lib/weeklyReport/aiOverview.js';

const router = express.Router();
const STATUS_ORDER = { needs_attention: 0, watch: 1, on_track: 2 };

/** Per-exercise week-over-week progression for a client (shared by endpoints). */
async function loadClientProgression(clientId, weeksBack = 8) {
    const weeks = Math.min(26, Math.max(2, Number(weeksBack) || 8));
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - weeks * 7);

    const sessions = await db
        .select({ id: workoutSessions.id, date: workoutSessions.date })
        .from(workoutSessions)
        .where(and(eq(workoutSessions.user_id, clientId), gte(workoutSessions.date, cutoff)));
    if (!sessions.length) return [];

    const dateById = new Map(sessions.map((s) => [s.id, s.date]));
    const logs = await db
        .select({
            workoutSessionsId: exerciseLog.workoutSessionsId,
            sets: exerciseLog.sets,
            reps: exerciseLog.reps,
            weight: exerciseLog.weight,
            exercise: exercises.name,
            body_part: exercises.body_part,
        })
        .from(exerciseLog)
        .leftJoin(exercises, eq(exerciseLog.exercise_id, exercises.id))
        .where(inArray(exerciseLog.workoutSessionsId, [...dateById.keys()]));

    const rows = logs.map((l) => ({
        exercise: l.exercise || 'Exercise',
        body_part: l.body_part,
        date: dateById.get(l.workoutSessionsId),
        sets: typeof l.sets === 'string' ? JSON.parse(l.sets) : l.sets,
        reps: l.reps,
        weight: l.weight,
    }));
    return computeProgression(rows);
}

function coachId(req) {
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

// GET /api/v1/reports/clients — the coach's roster (link + hide-numbers flag).
router.get('/clients', requireAuth, requireCoach, async (req, res) => {
    try {
        const rows = await db
            .select({
                client_id: coachClients.client_id,
                weekly_training_target: coachClients.weekly_training_target,
                status: coachClients.status,
                first_name: users.first_name,
                last_name: users.last_name,
                username: users.username,
            })
            .from(coachClients)
            .innerJoin(users, eq(users.id, coachClients.client_id))
            .where(eq(coachClients.coach_id, coachId(req)))
            .orderBy(asc(users.first_name));

        const sg = await db.select().from(clientSafeguarding);
        const hideById = new Map(sg.map((s) => [s.client_id, s.hide_raw_numbers]));

        res.json(
            rows.map((r) => ({
                client_id: r.client_id,
                name: `${r.first_name} ${r.last_name}`.trim(),
                username: r.username,
                weekly_training_target: r.weekly_training_target,
                status: r.status,
                hide_raw_numbers: hideById.get(r.client_id) ?? false,
            }))
        );
    } catch (err) {
        console.error('GET /reports/clients:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/reports/clients/overview — the All Clients table (Everfit-style):
// last activity, 7d/30d training %, 7d tasks %, category, status + filter counts.
router.get('/clients/overview', requireAuth, requireCoach, async (req, res) => {
    try {
        const me = coachId(req);
        const roster = await db
            .select({
                client_id: coachClients.client_id,
                weekly_training_target: coachClients.weekly_training_target,
                link_status: coachClients.status,
                first_name: users.first_name,
                last_name: users.last_name,
                username: users.username,
            })
            .from(coachClients)
            .innerJoin(users, eq(users.id, coachClients.client_id))
            .where(eq(coachClients.coach_id, me))
            .orderBy(asc(users.first_name));
        if (!roster.length) {
            return res.json({ clients: [], counts: { all: 0, connected: 0, pending: 0, offline: 0, need_programming: 0, archived: 0 } });
        }
        const ids = roster.map((r) => r.client_id);
        const now = new Date();
        const d7 = new Date(now); d7.setDate(d7.getDate() - 7);
        const d30 = new Date(now); d30.setDate(d30.getDate() - 30);
        const s7 = d7.toISOString().slice(0, 10);
        const s30 = d30.toISOString().slice(0, 10);

        // Bulk pulls, aggregated in JS.
        const [sessions, assigned, tasks, comps, foods, weights, checkins, photos, profiles] = await Promise.all([
            db.select({ user_id: workoutSessions.user_id, date: workoutSessions.date, endTime: workoutSessions.endTime }).from(workoutSessions).where(and(inArray(workoutSessions.user_id, ids), gte(workoutSessions.date, d30))),
            db.select({ client_id: assignedWorkouts.client_id, scheduled_date: assignedWorkouts.scheduled_date, status: assignedWorkouts.status }).from(assignedWorkouts).where(and(inArray(assignedWorkouts.client_id, ids), gte(assignedWorkouts.scheduled_date, s30))),
            db.select({ client_id: clientTasks.client_id, kind: clientTasks.kind }).from(clientTasks).where(and(inArray(clientTasks.client_id, ids), eq(clientTasks.active, true))),
            db.select({ client_id: taskCompletions.client_id, date: taskCompletions.date }).from(taskCompletions).where(and(inArray(taskCompletions.client_id, ids), gte(taskCompletions.date, s7))),
            db.select({ user_id: foodLogEntries.user_id, date: foodLogEntries.date }).from(foodLogEntries).where(and(inArray(foodLogEntries.user_id, ids), gte(foodLogEntries.date, s30))),
            db.select({ user_id: bodyMetrics.user_id, date: bodyMetrics.date }).from(bodyMetrics).where(and(inArray(bodyMetrics.user_id, ids), gte(bodyMetrics.date, s30))),
            db.select({ client_id: weeklyCheckins.client_id, date: weeklyCheckins.week_start }).from(weeklyCheckins).where(and(inArray(weeklyCheckins.client_id, ids), gte(weeklyCheckins.week_start, s30))),
            db.select({ client_id: progressPhotos.client_id, date: progressPhotos.date }).from(progressPhotos).where(and(inArray(progressPhotos.client_id, ids), gte(progressPhotos.date, s30))),
            db.select({ client_id: clientProfile.client_id, package: clientProfile.package }).from(clientProfile).where(inArray(clientProfile.client_id, ids)),
        ]);

        const lastAct = new Map();
        const bump = (id, dateLike) => {
            if (!dateLike) return;
            const t = new Date(dateLike).getTime();
            if (!Number.isFinite(t)) return;
            if (!lastAct.has(id) || t > lastAct.get(id)) lastAct.set(id, t);
        };
        for (const s of sessions) bump(s.user_id, s.endTime || s.date);
        for (const f of foods) bump(f.user_id, f.date);
        for (const w of weights) bump(w.user_id, w.date);
        for (const c of checkins) bump(c.client_id, c.date);
        for (const p of photos) bump(p.client_id, p.date);
        for (const c of comps) bump(c.client_id, c.date);

        // training adherence from assigned plan when present, else sessions vs target.
        const planAgg = new Map(); // id -> {a7,c7,a30,c30}
        for (const a of assigned) {
            const e = planAgg.get(a.client_id) || { a7: 0, c7: 0, a30: 0, c30: 0 };
            const inDate = a.scheduled_date;
            if (inDate >= s30) { e.a30 += 1; if (a.status === 'completed') e.c30 += 1; }
            if (inDate >= s7) { e.a7 += 1; if (a.status === 'completed') e.c7 += 1; }
            planAgg.set(a.client_id, e);
        }
        const sess7 = new Map(); const sess30 = new Map();
        for (const s of sessions) {
            const dt = new Date(s.endTime || s.date);
            const done = s.endTime != null;
            if (dt >= d30) sess30.set(s.user_id, (sess30.get(s.user_id) || 0) + 1);
            if (dt >= d7) sess7.set(s.user_id, (sess7.get(s.user_id) || 0) + 1);
            void done;
        }
        const habitCount = new Map();
        for (const t of tasks) if (t.kind === 'habit') habitCount.set(t.client_id, (habitCount.get(t.client_id) || 0) + 1);
        const comp7 = new Map();
        for (const c of comps) comp7.set(c.client_id, (comp7.get(c.client_id) || 0) + 1);
        const pkgById = new Map(profiles.map((p) => [p.client_id, p.package]));

        const pct = (num, den) => (den > 0 ? Math.round((num / den) * 100) : null);
        const ONLINE_MS = 48 * 3600 * 1000;

        const clients = roster.map((r) => {
            const id = r.client_id;
            const plan = planAgg.get(id);
            const target = r.weekly_training_target || 0;
            const t7 = plan && plan.a7 > 0 ? pct(plan.c7, plan.a7) : (target > 0 ? Math.min(100, pct(sess7.get(id) || 0, target)) : null);
            const t30 = plan && plan.a30 > 0 ? pct(plan.c30, plan.a30) : (target > 0 ? Math.min(100, pct(sess30.get(id) || 0, target * 4)) : null);
            const habits = habitCount.get(id) || 0;
            const tasks7 = habits > 0 ? Math.min(100, pct(comp7.get(id) || 0, habits * 7)) : null;
            const la = lastAct.get(id) || null;
            const online = la != null && (now.getTime() - la) < ONLINE_MS;
            const noProgram = !plan || plan.a30 === 0;
            return {
                client_id: id,
                name: `${r.first_name} ${r.last_name}`.trim(),
                username: r.username,
                last_activity: la ? new Date(la).toISOString() : null,
                last_7d_training: t7,
                last_30d_training: t30,
                last_7d_tasks: tasks7,
                category: pkgById.get(id) || 'Online',
                status: r.link_status === 'inactive' ? 'Archived' : 'Connected',
                online,
                need_programming: noProgram,
            };
        });

        const counts = {
            all: clients.length,
            connected: clients.filter((c) => c.status === 'Connected').length,
            pending: 0,
            offline: clients.filter((c) => !c.online && c.status === 'Connected').length,
            need_programming: clients.filter((c) => c.need_programming).length,
            archived: clients.filter((c) => c.status === 'Archived').length,
        };
        res.json({ clients, counts });
    } catch (err) {
        console.error('GET /reports/clients/overview:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/reports/clients { client_id | username, weekly_training_target? }
router.post('/clients', requireAuth, requireCoach, async (req, res) => {
    try {
        const me = coachId(req);
        let clientId = Number(req.body?.client_id);
        const uname = req.body?.username;
        if ((!Number.isInteger(clientId) || clientId < 1) && uname) {
            const norm = normalizeUsername(String(uname).replace(/^@/, ''));
            if (!norm) return res.status(400).json({ error: 'Invalid username.' });
            const [u] = await db
                .select({ id: users.id })
                .from(users)
                .where(eq(users.username, norm))
                .limit(1);
            if (!u) return res.status(404).json({ error: 'No user with that username.' });
            clientId = u.id;
        }
        if (!Number.isInteger(clientId) || clientId < 1) {
            return res.status(400).json({ error: 'Send client_id (number) or username.' });
        }
        if (clientId === me) return res.status(400).json({ error: 'You cannot coach yourself.' });

        const [u] = await db.select({ id: users.id }).from(users).where(eq(users.id, clientId)).limit(1);
        if (!u) return res.status(404).json({ error: 'No user with that id.' });

        const target = Number(req.body?.weekly_training_target);
        const weekly = Number.isFinite(target) && target >= 0 && target <= 14 ? Math.round(target) : 4;

        await db
            .insert(coachClients)
            .values({ coach_id: me, client_id: clientId, weekly_training_target: weekly })
            .onConflictDoUpdate({
                target: [coachClients.coach_id, coachClients.client_id],
                set: { weekly_training_target: weekly, status: 'active' },
            });
        res.status(201).json({ ok: true, client_id: clientId, weekly_training_target: weekly });
    } catch (err) {
        console.error('POST /reports/clients:', err);
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/v1/reports/clients/:clientId { weekly_training_target?, status? }
router.patch('/clients/:clientId', requireAuth, requireCoach, async (req, res) => {
    try {
        const me = coachId(req);
        const clientId = Number(req.params.clientId);
        if (!(await ownsClient(me, clientId))) {
            return res.status(404).json({ error: 'Client not on your roster.' });
        }
        const patch = {};
        if (req.body?.weekly_training_target !== undefined) {
            const t = Number(req.body.weekly_training_target);
            if (!Number.isFinite(t) || t < 0 || t > 14) {
                return res.status(400).json({ error: 'weekly_training_target must be 0–14.' });
            }
            patch.weekly_training_target = Math.round(t);
        }
        if (req.body?.status !== undefined) {
            const s = String(req.body.status);
            if (!['active', 'inactive'].includes(s)) {
                return res.status(400).json({ error: 'status must be active or inactive.' });
            }
            patch.status = s;
        }
        if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nothing to update.' });
        await db
            .update(coachClients)
            .set(patch)
            .where(and(eq(coachClients.coach_id, me), eq(coachClients.client_id, clientId)));
        res.json({ ok: true, ...patch });
    } catch (err) {
        console.error('PATCH /reports/clients:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/v1/reports/clients/:clientId
router.delete('/clients/:clientId', requireAuth, requireCoach, async (req, res) => {
    try {
        const me = coachId(req);
        const clientId = Number(req.params.clientId);
        await db
            .delete(coachClients)
            .where(and(eq(coachClients.coach_id, me), eq(coachClients.client_id, clientId)));
        res.json({ ok: true });
    } catch (err) {
        console.error('DELETE /reports/clients:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET/PUT safeguarding — coach controls hide-raw-numbers + support region per client.
router.get('/clients/:clientId/safeguarding', requireAuth, requireCoach, async (req, res) => {
    try {
        const me = coachId(req);
        const clientId = Number(req.params.clientId);
        if (!(await ownsClient(me, clientId))) {
            return res.status(404).json({ error: 'Client not on your roster.' });
        }
        const [row] = await db
            .select()
            .from(clientSafeguarding)
            .where(eq(clientSafeguarding.client_id, clientId))
            .limit(1);
        res.json(
            row || {
                client_id: clientId,
                hide_raw_numbers: false,
                screen_completed: false,
                support_region: 'UK',
                par_q: null,
            }
        );
    } catch (err) {
        console.error('GET safeguarding:', err);
        res.status(500).json({ error: err.message });
    }
});

router.put('/clients/:clientId/safeguarding', requireAuth, requireCoach, async (req, res) => {
    try {
        const me = coachId(req);
        const clientId = Number(req.params.clientId);
        if (!(await ownsClient(me, clientId))) {
            return res.status(404).json({ error: 'Client not on your roster.' });
        }
        const set = { updated_at: new Date() };
        if (req.body?.hide_raw_numbers !== undefined) {
            set.hide_raw_numbers = Boolean(req.body.hide_raw_numbers);
        }
        if (req.body?.support_region !== undefined) {
            set.support_region = String(req.body.support_region).toUpperCase().slice(0, 8);
        }
        await db
            .insert(clientSafeguarding)
            .values({ client_id: clientId, ...set })
            .onConflictDoUpdate({ target: clientSafeguarding.client_id, set });
        const [row] = await db
            .select()
            .from(clientSafeguarding)
            .where(eq(clientSafeguarding.client_id, clientId))
            .limit(1);
        res.json(row);
    } catch (err) {
        console.error('PUT safeguarding:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/reports/clients/:clientId/report?week= — full model for the profile.
router.get('/clients/:clientId/report', requireAuth, requireCoach, async (req, res) => {
    try {
        const me = coachId(req);
        const clientId = Number(req.params.clientId);
        if (!(await ownsClient(me, clientId))) {
            return res.status(404).json({ error: 'Client not on your roster.' });
        }
        const week = resolveWeek(req.query?.week);
        const [row] = await db
            .select()
            .from(weeklyReports)
            .where(
                and(
                    eq(weeklyReports.client_id, clientId),
                    eq(weeklyReports.coach_id, me),
                    eq(weeklyReports.week_start, week.weekStart)
                )
            )
            .limit(1);
        if (!row) {
            return res.json({ week_start: week.weekStart, week_end: week.weekEnd, has_report: false });
        }
        res.json({
            week_start: row.week_start,
            week_end: week.weekEnd,
            has_report: true,
            report_id: row.id,
            status: row.status,
            flags: row.flags || [],
            has_pdf: Boolean(row.pdf_base64),
            generated_at: row.generated_at,
            model: row.model,
        });
    } catch (err) {
        console.error('GET /reports/clients/:clientId/report:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/reports/clients/:clientId/reports — week history for a client.
router.get('/clients/:clientId/reports', requireAuth, requireCoach, async (req, res) => {
    try {
        const me = coachId(req);
        const clientId = Number(req.params.clientId);
        if (!(await ownsClient(me, clientId))) {
            return res.status(404).json({ error: 'Client not on your roster.' });
        }
        const rows = await db
            .select({
                id: weeklyReports.id,
                week_start: weeklyReports.week_start,
                status: weeklyReports.status,
                pdf_base64: weeklyReports.pdf_base64,
                generated_at: weeklyReports.generated_at,
            })
            .from(weeklyReports)
            .where(and(eq(weeklyReports.client_id, clientId), eq(weeklyReports.coach_id, me)))
            .orderBy(desc(weeklyReports.week_start));
        res.json(
            rows.map((r) => ({
                report_id: r.id,
                week_start: r.week_start,
                status: r.status,
                has_pdf: Boolean(r.pdf_base64),
                generated_at: r.generated_at,
            }))
        );
    } catch (err) {
        console.error('GET /reports/clients/:clientId/reports:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/reports/clients/:clientId/body-metrics?weeks= — weight/body-fat history.
router.get('/clients/:clientId/body-metrics', requireAuth, requireCoach, async (req, res) => {
    try {
        const me = coachId(req);
        const clientId = Number(req.params.clientId);
        if (!(await ownsClient(me, clientId))) {
            return res.status(404).json({ error: 'Client not on your roster.' });
        }
        const weeks = Math.min(52, Math.max(2, Number(req.query.weeks) || 12));
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - weeks * 7);
        const cutoffStr = cutoff.toISOString().slice(0, 10);
        const rows = await db
            .select({ date: bodyMetrics.date, weight_kg: bodyMetrics.weight_kg, body_fat_pct: bodyMetrics.body_fat_pct })
            .from(bodyMetrics)
            .where(and(eq(bodyMetrics.user_id, clientId), gte(bodyMetrics.date, cutoffStr)))
            .orderBy(asc(bodyMetrics.date));
        res.json(
            rows.map((r) => ({
                date: r.date,
                weight: r.weight_kg != null ? Number(r.weight_kg) : null,
                body_fat: r.body_fat_pct != null ? Number(r.body_fat_pct) : null,
            }))
        );
    } catch (err) {
        console.error('GET /reports/clients/:clientId/body-metrics:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/reports/clients/:clientId/progression?weeks= — per-exercise week-over-week.
router.get('/clients/:clientId/progression', requireAuth, requireCoach, async (req, res) => {
    try {
        const me = coachId(req);
        const clientId = Number(req.params.clientId);
        if (!(await ownsClient(me, clientId))) {
            return res.status(404).json({ error: 'Client not on your roster.' });
        }
        res.json(await loadClientProgression(clientId, req.query.weeks));
    } catch (err) {
        console.error('GET /reports/clients/:clientId/progression:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/reports/clients/:clientId/ai-overview?week= — hybrid AI weekly note.
// Deterministic numbers (report model + progression) narrated by Claude.
router.get('/clients/:clientId/ai-overview', requireAuth, requireCoach, async (req, res) => {
    try {
        const me = coachId(req);
        const clientId = Number(req.params.clientId);
        if (!(await ownsClient(me, clientId))) {
            return res.status(404).json({ error: 'Client not on your roster.' });
        }
        const week = resolveWeek(req.query?.week);
        const [row] = await db
            .select({ model: weeklyReports.model, flags: weeklyReports.flags })
            .from(weeklyReports)
            .where(
                and(
                    eq(weeklyReports.client_id, clientId),
                    eq(weeklyReports.coach_id, me),
                    eq(weeklyReports.week_start, week.weekStart)
                )
            )
            .limit(1);
        if (!row) {
            return res.json({ has_report: false, week_start: week.weekStart, week_end: week.weekEnd });
        }
        const progression = await loadClientProgression(clientId, 8);
        const overview = await generateAiOverview({ model: row.model, progression, flags: row.flags || [] });
        res.json({ has_report: true, week_start: week.weekStart, week_end: week.weekEnd, ...overview });
    } catch (err) {
        console.error('GET /reports/clients/:clientId/ai-overview:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/reports/run { week_start? } — generate this coach's weekly reports.
router.post('/run', requireAuth, requireCoach, async (req, res) => {
    try {
        const week = resolveWeek(req.body?.week_start);
        const result = await generateWeeklyReports(coachId(req), week);
        res.json(result);
    } catch (err) {
        console.error('POST /reports/run:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/reports/roster?week= — persisted roster, needs-attention first.
router.get('/roster', requireAuth, requireCoach, async (req, res) => {
    try {
        const week = resolveWeek(req.query?.week);
        const rows = await db
            .select()
            .from(weeklyReports)
            .where(
                and(
                    eq(weeklyReports.coach_id, coachId(req)),
                    eq(weeklyReports.week_start, week.weekStart)
                )
            );

        const clients = rows
            .map((r) => {
                const m = r.model || {};
                return {
                    report_id: r.id,
                    client_id: r.client_id,
                    name: m.name,
                    goal: m.goal,
                    status: r.status,
                    flags: r.flags || [],
                    training_adherence: m.training?.adherence ?? null,
                    log_adherence: m.nutrition?.log_adherence ?? null,
                    weight_trend: m.body?.trend ?? null,
                    has_pdf: Boolean(r.pdf_base64),
                };
            })
            .sort(
                (a, b) =>
                    (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) ||
                    String(a.name).localeCompare(String(b.name))
            );

        const summary = {
            total: clients.length,
            needs_attention: clients.filter((c) => c.status === 'needs_attention').length,
            watch: clients.filter((c) => c.status === 'watch').length,
            on_track: clients.filter((c) => c.status === 'on_track').length,
            generated_at: rows[0]?.generated_at ?? null,
        };

        res.json({ week_start: week.weekStart, week_end: week.weekEnd, summary, clients });
    } catch (err) {
        console.error('GET /reports/roster:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/reports/:id/pdf — stream a client's stored weekly PDF (coach only).
router.get('/:id/pdf', requireAuth, requireCoach, async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id.' });
        const [row] = await db
            .select({
                pdf_base64: weeklyReports.pdf_base64,
                pdf_mime: weeklyReports.pdf_mime,
                model: weeklyReports.model,
                week_start: weeklyReports.week_start,
            })
            .from(weeklyReports)
            .where(and(eq(weeklyReports.id, id), eq(weeklyReports.coach_id, coachId(req))))
            .limit(1);
        if (!row || !row.pdf_base64) return res.status(404).json({ error: 'PDF not found.' });
        const buf = Buffer.from(row.pdf_base64, 'base64');
        const name = `${(row.model?.name || 'client').replace(/[^a-z0-9]+/gi, '-')}-${row.week_start}.pdf`;
        res.setHeader('Content-Type', row.pdf_mime || 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${name}"`);
        res.send(buf);
    } catch (err) {
        console.error('GET /reports/:id/pdf:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/reports/dashboard?week= — the engine's standalone HTML dashboard.
router.get('/dashboard', requireAuth, requireCoach, async (req, res) => {
    try {
        const week = resolveWeek(req.query?.week);
        const [row] = await db
            .select({ html: weeklyDashboards.html })
            .from(weeklyDashboards)
            .where(
                and(
                    eq(weeklyDashboards.coach_id, coachId(req)),
                    eq(weeklyDashboards.week_start, week.weekStart)
                )
            )
            .limit(1);
        if (!row) return res.status(404).send('No dashboard for this week yet. Run reports first.');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(row.html);
    } catch (err) {
        console.error('GET /reports/dashboard:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/reports/cron/run-all — weekly job for every coach (host cron).
// Auth: x-cron-secret header must equal REPORTS_CRON_SECRET.
router.post('/cron/run-all', async (req, res) => {
    const secret = process.env.REPORTS_CRON_SECRET;
    if (!secret || req.headers['x-cron-secret'] !== secret) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    try {
        const week = resolveWeek(req.body?.week_start);
        const coaches = await db
            .selectDistinct({ coach_id: coachClients.coach_id })
            .from(coachClients)
            .where(eq(coachClients.status, 'active'));
        const results = [];
        for (const { coach_id } of coaches) {
            try {
                results.push({ coach_id, ...(await generateWeeklyReports(coach_id, week)) });
            } catch (e) {
                results.push({ coach_id, error: e.message });
            }
        }
        res.json({ week_start: week.weekStart, coaches: results.length, results });
    } catch (err) {
        console.error('POST /reports/cron/run-all:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
