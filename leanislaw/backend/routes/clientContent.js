/**
 * Per-client documents + meal plans.
 *
 *  Coach (requireCoach + roster ownership):
 *    GET    /clients/:id/documents     POST same    DELETE /documents/:docId
 *    GET    /clients/:id/meal-plan     PUT  /clients/:id/meal-plan (upsert active plan)
 *
 *  Client (requireAuth, own rows):
 *    GET    /my/documents              docs for me (mine + roster-shared)
 *    GET    /my/meal-plan             my active meal plan
 */

import express from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireCoach } from './coaching.js';
import { coachDocuments, mealPlans, coachClients } from '../schema.js';
import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';

const router = express.Router();
const uid = (req) => Number(req.userId);

async function ownsClient(coach, clientId) {
    const rows = await db.select({ id: coachClients.id }).from(coachClients)
        .where(and(eq(coachClients.coach_id, coach), eq(coachClients.client_id, clientId))).limit(1);
    return rows.length > 0;
}

function normUrl(u) {
    if (!u) return null;
    const s = String(u).trim().slice(0, 500);
    return s && !/^https?:\/\//i.test(s) ? `https://${s}` : s || null;
}
function cleanMeals(input) {
    if (!Array.isArray(input)) return [];
    return input.map((m) => ({
        name: String(m?.name || '').slice(0, 120),
        items: Array.isArray(m?.items) ? m.items.map((i) => String(i).slice(0, 200)).filter(Boolean) : [],
        notes: m?.notes ? String(m.notes).slice(0, 500) : null,
    })).filter((m) => m.name || m.items.length);
}
const intOrNull = (v) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Math.round(Number(v)) : null);

/* --------------------------- documents (coach) --------------------------- */

router.get('/clients/:id/documents', requireAuth, requireCoach, async (req, res) => {
    try {
        const me = uid(req); const clientId = Number(req.params.id);
        if (!(await ownsClient(me, clientId))) return res.status(404).json({ error: 'Client not on your roster.' });
        const rows = await db.select().from(coachDocuments)
            .where(and(eq(coachDocuments.coach_id, me), or(eq(coachDocuments.client_id, clientId), isNull(coachDocuments.client_id))))
            .orderBy(desc(coachDocuments.id));
        res.json(rows);
    } catch (err) { console.error('GET documents:', err); res.status(500).json({ error: err.message }); }
});

router.post('/clients/:id/documents', requireAuth, requireCoach, async (req, res) => {
    try {
        const me = uid(req); const clientId = Number(req.params.id);
        if (!(await ownsClient(me, clientId))) return res.status(404).json({ error: 'Client not on your roster.' });
        const title = String(req.body?.title || '').trim().slice(0, 200);
        if (!title) return res.status(400).json({ error: 'A document title is required.' });
        const [row] = await db.insert(coachDocuments).values({
            coach_id: me, client_id: clientId, title, url: normUrl(req.body?.url),
            note: req.body?.note ? String(req.body.note).slice(0, 1000) : null,
        }).returning();
        res.status(201).json(row);
    } catch (err) { console.error('POST documents:', err); res.status(500).json({ error: err.message }); }
});

router.delete('/documents/:docId', requireAuth, requireCoach, async (req, res) => {
    try {
        await db.delete(coachDocuments).where(and(eq(coachDocuments.id, Number(req.params.docId)), eq(coachDocuments.coach_id, uid(req))));
        res.json({ ok: true });
    } catch (err) { console.error('DELETE documents:', err); res.status(500).json({ error: err.message }); }
});

/* --------------------------- meal plan (coach) --------------------------- */

async function activeMealPlan(coachId, clientId) {
    const [row] = await db.select().from(mealPlans)
        .where(and(eq(mealPlans.client_id, clientId), eq(mealPlans.active, true)))
        .orderBy(desc(mealPlans.id)).limit(1);
    return row || null;
}

router.get('/clients/:id/meal-plan', requireAuth, requireCoach, async (req, res) => {
    try {
        const me = uid(req); const clientId = Number(req.params.id);
        if (!(await ownsClient(me, clientId))) return res.status(404).json({ error: 'Client not on your roster.' });
        res.json(await activeMealPlan(me, clientId));
    } catch (err) { console.error('GET meal-plan:', err); res.status(500).json({ error: err.message }); }
});

router.put('/clients/:id/meal-plan', requireAuth, requireCoach, async (req, res) => {
    try {
        const me = uid(req); const clientId = Number(req.params.id);
        if (!(await ownsClient(me, clientId))) return res.status(404).json({ error: 'Client not on your roster.' });
        const title = String(req.body?.title || 'Meal plan').trim().slice(0, 200);
        // Deactivate previous, insert new active plan (keeps simple history).
        await db.update(mealPlans).set({ active: false }).where(and(eq(mealPlans.client_id, clientId), eq(mealPlans.active, true)));
        const [row] = await db.insert(mealPlans).values({
            coach_id: me, client_id: clientId, title,
            target_calories: intOrNull(req.body?.target_calories),
            target_protein_g: intOrNull(req.body?.target_protein_g),
            target_carbs_g: intOrNull(req.body?.target_carbs_g),
            target_fat_g: intOrNull(req.body?.target_fat_g),
            meals: cleanMeals(req.body?.meals),
            notes: req.body?.notes ? String(req.body.notes).slice(0, 2000) : null,
        }).returning();
        res.json(row);
    } catch (err) { console.error('PUT meal-plan:', err); res.status(500).json({ error: err.message }); }
});

/* ----------------------------- client ----------------------------- */

router.get('/my/documents', requireAuth, async (req, res) => {
    try {
        const me = uid(req);
        const coaches = await db.select({ coach_id: coachClients.coach_id }).from(coachClients).where(eq(coachClients.client_id, me));
        if (!coaches.length) return res.json([]);
        const coachIds = coaches.map((c) => c.coach_id);
        const rows = await db.select().from(coachDocuments)
            .where(or(eq(coachDocuments.client_id, me), and(isNull(coachDocuments.client_id), inArray(coachDocuments.coach_id, coachIds))))
            .orderBy(desc(coachDocuments.id));
        res.json(rows);
    } catch (err) { console.error('GET /my/documents:', err); res.status(500).json({ error: err.message }); }
});

router.get('/my/meal-plan', requireAuth, async (req, res) => {
    try {
        const me = uid(req);
        const [row] = await db.select().from(mealPlans)
            .where(and(eq(mealPlans.client_id, me), eq(mealPlans.active, true)))
            .orderBy(desc(mealPlans.id)).limit(1);
        res.json(row || null);
    } catch (err) { console.error('GET /my/meal-plan:', err); res.status(500).json({ error: err.message }); }
});

export default router;
