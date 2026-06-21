/**
 * Client profile depth (Everfit-style): goal/notes/injuries + profile card,
 * multi-metric body measurements, progress photos, and an activity/updates feed.
 *
 *  Coach (requireCoach + roster ownership):
 *    GET  /clients/:id/profile        goal/notes/injuries + card + measurements + photos
 *    PUT  /clients/:id/profile        update goal/notes/injuries/phone/location/package
 *    GET  /clients/:id/measurements   measurement history (grouped by metric)
 *    POST /clients/:id/measurements   add a measurement { metric, value, unit?, date? }
 *    GET  /clients/:id/photos         progress photos (data URIs)
 *    GET  /clients/:id/activity       recent activity feed
 *
 *  Client (requireAuth, own rows):
 *    GET  /me/profile                 own goal + measurements + photos
 *    PUT  /me/goal                    set own goal { goal_text, goal_date }
 *    POST /me/measurements            add a measurement
 *    POST /me/photos                  upload { image_base64, image_mime, angle?, note?, date? }
 *    DELETE /me/photos/:id            remove own photo
 */

import express from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireCoach } from './coaching.js';
import {
    clientProfile, bodyMeasurements, progressPhotos, bodyMetrics, weeklyCheckins,
    workoutSessions, formResponses, coachForms, coachClients, users,
} from '../schema.js';
import { and, asc, desc, eq, gte, inArray } from 'drizzle-orm';

const router = express.Router();
const uid = (req) => Number(req.userId);

async function ownsClient(coach, clientId) {
    const rows = await db.select({ id: coachClients.id }).from(coachClients)
        .where(and(eq(coachClients.coach_id, coach), eq(coachClients.client_id, clientId))).limit(1);
    return rows.length > 0;
}

async function loadProfile(clientId) {
    const [row] = await db.select().from(clientProfile).where(eq(clientProfile.client_id, clientId)).limit(1);
    const [u] = await db
        .select({ first_name: users.first_name, last_name: users.last_name, email: users.email, username: users.username, created_at: users.created_at })
        .from(users).where(eq(users.id, clientId)).limit(1);
    const base = row || { client_id: clientId, goal_text: null, goal_date: null, coach_notes: null, injuries: null, phone: null, location: null, package: null };
    return {
        ...base,
        name: u ? `${u.first_name} ${u.last_name}`.trim() : null,
        email: u?.email || null,
        username: u?.username || null,
        member_since: u?.created_at || null,
    };
}

/** Measurements grouped by metric, oldest->newest, for charts + latest value. */
async function measurementsByMetric(clientId) {
    const rows = await db.select().from(bodyMeasurements)
        .where(eq(bodyMeasurements.client_id, clientId))
        .orderBy(asc(bodyMeasurements.date));
    // Fold weight + body-fat from body_metrics so the Metrics list is unified.
    const bm = await db.select().from(bodyMetrics).where(eq(bodyMetrics.user_id, clientId)).orderBy(asc(bodyMetrics.date));
    const out = {};
    const push = (metric, date, value, unit) => {
        if (value == null) return;
        (out[metric] = out[metric] || { metric, unit, points: [] }).points.push({ date, value: Number(value) });
    };
    for (const r of bm) { push('Weight', r.date, r.weight_kg, 'kg'); push('Body fat', r.date, r.body_fat_pct, '%'); }
    for (const r of rows) push(r.metric, r.date, r.value, r.unit);
    return Object.values(out).map((m) => ({
        ...m,
        latest: m.points[m.points.length - 1] || null,
        first: m.points[0] || null,
    }));
}

async function loadPhotos(clientId) {
    const rows = await db.select().from(progressPhotos).where(eq(progressPhotos.client_id, clientId)).orderBy(desc(progressPhotos.date));
    return rows.map((p) => ({
        id: p.id, date: p.date, angle: p.angle, note: p.note,
        image: `data:${p.image_mime || 'image/jpeg'};base64,${p.image_base64}`,
    }));
}

/* ----------------------------- coach ----------------------------- */

router.get('/clients/:id/profile', requireAuth, requireCoach, async (req, res) => {
    try {
        const me = uid(req); const clientId = Number(req.params.id);
        if (!(await ownsClient(me, clientId))) return res.status(404).json({ error: 'Client not on your roster.' });
        const [profile, measurements, photos] = await Promise.all([
            loadProfile(clientId), measurementsByMetric(clientId), loadPhotos(clientId),
        ]);
        res.json({ profile, measurements, photos });
    } catch (err) { console.error('GET /clients/:id/profile:', err); res.status(500).json({ error: err.message }); }
});

router.put('/clients/:id/profile', requireAuth, requireCoach, async (req, res) => {
    try {
        const me = uid(req); const clientId = Number(req.params.id);
        if (!(await ownsClient(me, clientId))) return res.status(404).json({ error: 'Client not on your roster.' });
        const set = { updated_at: new Date() };
        for (const k of ['goal_text', 'coach_notes', 'injuries', 'phone', 'location', 'package']) {
            if (req.body?.[k] !== undefined) set[k] = req.body[k] ? String(req.body[k]).slice(0, 4000) : null;
        }
        if (req.body?.goal_date !== undefined) set.goal_date = req.body.goal_date || null;
        await db.insert(clientProfile).values({ client_id: clientId, ...set })
            .onConflictDoUpdate({ target: clientProfile.client_id, set });
        res.json(await loadProfile(clientId));
    } catch (err) { console.error('PUT /clients/:id/profile:', err); res.status(500).json({ error: err.message }); }
});

router.get('/clients/:id/measurements', requireAuth, requireCoach, async (req, res) => {
    try {
        const me = uid(req); const clientId = Number(req.params.id);
        if (!(await ownsClient(me, clientId))) return res.status(404).json({ error: 'Client not on your roster.' });
        res.json(await measurementsByMetric(clientId));
    } catch (err) { console.error('GET measurements:', err); res.status(500).json({ error: err.message }); }
});

async function addMeasurement(clientId, body, res) {
    const metric = String(body?.metric || '').trim().slice(0, 40);
    const value = Number(body?.value);
    if (!metric || !Number.isFinite(value)) return res.status(400).json({ error: 'metric and numeric value are required.' });
    const date = body?.date || new Date().toISOString().slice(0, 10);
    const unit = body?.unit ? String(body.unit).slice(0, 12) : 'cm';
    await db.insert(bodyMeasurements).values({ client_id: clientId, date, metric, value: String(value), unit })
        .onConflictDoUpdate({ target: [bodyMeasurements.client_id, bodyMeasurements.date, bodyMeasurements.metric], set: { value: String(value), unit } });
    res.status(201).json({ ok: true, metric, value, date });
}

router.post('/clients/:id/measurements', requireAuth, requireCoach, async (req, res) => {
    try {
        const me = uid(req); const clientId = Number(req.params.id);
        if (!(await ownsClient(me, clientId))) return res.status(404).json({ error: 'Client not on your roster.' });
        await addMeasurement(clientId, req.body, res);
    } catch (err) { console.error('POST measurements:', err); res.status(500).json({ error: err.message }); }
});

router.get('/clients/:id/photos', requireAuth, requireCoach, async (req, res) => {
    try {
        const me = uid(req); const clientId = Number(req.params.id);
        if (!(await ownsClient(me, clientId))) return res.status(404).json({ error: 'Client not on your roster.' });
        res.json(await loadPhotos(clientId));
    } catch (err) { console.error('GET photos:', err); res.status(500).json({ error: err.message }); }
});

router.get('/clients/:id/activity', requireAuth, requireCoach, async (req, res) => {
    try {
        const me = uid(req); const clientId = Number(req.params.id);
        if (!(await ownsClient(me, clientId))) return res.status(404).json({ error: 'Client not on your roster.' });
        res.json(await buildActivity(clientId));
    } catch (err) { console.error('GET activity:', err); res.status(500).json({ error: err.message }); }
});

/** Recent client activity aggregated across tables (last ~45 days, top 20). */
async function buildActivity(clientId) {
    const since = new Date(); since.setDate(since.getDate() - 45);
    const sinceStr = since.toISOString().slice(0, 10);
    const items = [];

    const sessions = await db.select({ name: workoutSessions.name, date: workoutSessions.date, endTime: workoutSessions.endTime })
        .from(workoutSessions).where(and(eq(workoutSessions.user_id, clientId), gte(workoutSessions.date, since))).orderBy(desc(workoutSessions.date)).limit(10);
    for (const s of sessions) items.push({ type: 'workout', icon: 'ti-barbell', text: `Logged workout: ${s.name}`, date: (s.endTime || s.date) });

    const checkins = await db.select().from(weeklyCheckins).where(and(eq(weeklyCheckins.client_id, clientId), gte(weeklyCheckins.week_start, sinceStr))).orderBy(desc(weeklyCheckins.week_start)).limit(6);
    for (const c of checkins) items.push({ type: 'checkin', icon: 'ti-clipboard-check', text: `Submitted weekly check-in`, date: c.created_at || c.week_start });

    const weights = await db.select().from(bodyMetrics).where(and(eq(bodyMetrics.user_id, clientId), gte(bodyMetrics.date, sinceStr))).orderBy(desc(bodyMetrics.date)).limit(6);
    for (const w of weights) items.push({ type: 'weight', icon: 'ti-scale', text: `Logged weight ${Number(w.weight_kg)} kg`, date: w.date });

    const photos = await db.select({ date: progressPhotos.date }).from(progressPhotos).where(and(eq(progressPhotos.client_id, clientId), gte(progressPhotos.date, sinceStr))).orderBy(desc(progressPhotos.date)).limit(6);
    for (const p of photos) items.push({ type: 'photo', icon: 'ti-camera', text: `Added a progress photo`, date: p.date });

    const responses = await db.select({ form_id: formResponses.form_id, submitted_at: formResponses.submitted_at })
        .from(formResponses).where(eq(formResponses.client_id, clientId)).orderBy(desc(formResponses.submitted_at)).limit(6);
    if (responses.length) {
        const forms = await db.select({ id: coachForms.id, title: coachForms.title }).from(coachForms).where(inArray(coachForms.id, responses.map((r) => r.form_id)));
        const titleById = new Map(forms.map((f) => [f.id, f.title]));
        for (const r of responses) items.push({ type: 'form', icon: 'ti-forms', text: `Completed form: ${titleById.get(r.form_id) || 'form'}`, date: r.submitted_at });
    }

    return items
        .filter((i) => i.date)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 20)
        .map((i) => ({ ...i, date: typeof i.date === 'string' ? i.date : new Date(i.date).toISOString() }));
}

/* ----------------------------- client ----------------------------- */

router.get('/me/profile', requireAuth, async (req, res) => {
    try {
        const me = uid(req);
        const [profile, measurements, photos] = await Promise.all([loadProfile(me), measurementsByMetric(me), loadPhotos(me)]);
        res.json({ profile, measurements, photos });
    } catch (err) { console.error('GET /me/profile:', err); res.status(500).json({ error: err.message }); }
});

router.put('/me/goal', requireAuth, async (req, res) => {
    try {
        const me = uid(req);
        const set = { updated_at: new Date() };
        if (req.body?.goal_text !== undefined) set.goal_text = req.body.goal_text ? String(req.body.goal_text).slice(0, 2000) : null;
        if (req.body?.goal_date !== undefined) set.goal_date = req.body.goal_date || null;
        await db.insert(clientProfile).values({ client_id: me, ...set }).onConflictDoUpdate({ target: clientProfile.client_id, set });
        res.json(await loadProfile(me));
    } catch (err) { console.error('PUT /me/goal:', err); res.status(500).json({ error: err.message }); }
});

router.post('/me/measurements', requireAuth, async (req, res) => {
    try { await addMeasurement(uid(req), req.body, res); }
    catch (err) { console.error('POST /me/measurements:', err); res.status(500).json({ error: err.message }); }
});

router.post('/me/photos', requireAuth, async (req, res) => {
    try {
        const me = uid(req);
        const b64 = req.body?.image_base64;
        if (!b64 || typeof b64 !== 'string') return res.status(400).json({ error: 'image_base64 is required.' });
        const clean = b64.includes(',') ? b64.slice(b64.indexOf(',') + 1) : b64;
        const [row] = await db.insert(progressPhotos).values({
            client_id: me,
            date: req.body?.date || new Date().toISOString().slice(0, 10),
            angle: req.body?.angle ? String(req.body.angle).slice(0, 20) : null,
            image_mime: req.body?.image_mime ? String(req.body.image_mime).slice(0, 64) : 'image/jpeg',
            image_base64: clean,
            note: req.body?.note ? String(req.body.note).slice(0, 500) : null,
        }).returning({ id: progressPhotos.id });
        res.status(201).json({ ok: true, id: row.id });
    } catch (err) { console.error('POST /me/photos:', err); res.status(500).json({ error: err.message }); }
});

router.delete('/me/photos/:id', requireAuth, async (req, res) => {
    try {
        await db.delete(progressPhotos).where(and(eq(progressPhotos.id, Number(req.params.id)), eq(progressPhotos.client_id, uid(req))));
        res.json({ ok: true });
    } catch (err) { console.error('DELETE /me/photos/:id:', err); res.status(500).json({ error: err.message }); }
});

export default router;
