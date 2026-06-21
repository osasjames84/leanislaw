/**
 * Coach forms: build a questionnaire, assign it to clients, review responses.
 *
 *  Coach side (requireCoach):
 *    GET    /                list my forms (+ assigned/response counts)
 *    POST   /                create a form { title, description, fields[] }
 *    DELETE /:id             delete a form
 *    POST   /:id/assign      assign to a client { client_id }
 *    GET    /:id/responses   responses for a form (+ client names)
 *
 *  Client side (requireAuth):
 *    GET    /my              forms assigned to me (+ my response)
 *    POST   /my/:formId/respond  submit answers { answers }
 */

import express from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireCoach } from './coaching.js';
import { coachForms, formAssignments, formResponses, coachClients, users } from '../schema.js';
import { and, desc, eq, inArray } from 'drizzle-orm';

const router = express.Router();
const uid = (req) => Number(req.userId);

async function ownsClient(coach, clientId) {
    const rows = await db
        .select({ id: coachClients.id })
        .from(coachClients)
        .where(and(eq(coachClients.coach_id, coach), eq(coachClients.client_id, clientId)))
        .limit(1);
    return rows.length > 0;
}

function cleanFields(input) {
    if (!Array.isArray(input)) return [];
    const types = new Set(['text', 'textarea', 'number', 'scale']);
    return input
        .map((f, i) => ({
            id: f?.id ? String(f.id).slice(0, 40) : `f${i + 1}`,
            label: String(f?.label || '').slice(0, 200),
            type: types.has(f?.type) ? f.type : 'text',
            required: Boolean(f?.required),
        }))
        .filter((f) => f.label);
}

/* ----------------------------- coach side ----------------------------- */

router.get('/', requireAuth, requireCoach, async (req, res) => {
    try {
        const me = uid(req);
        const forms = await db.select().from(coachForms).where(eq(coachForms.coach_id, me)).orderBy(desc(coachForms.id));
        const ids = forms.map((f) => f.id);
        const assigns = ids.length ? await db.select().from(formAssignments).where(inArray(formAssignments.form_id, ids)) : [];
        const byForm = new Map();
        for (const a of assigns) {
            const e = byForm.get(a.form_id) || { assigned: 0, completed: 0 };
            e.assigned += 1;
            if (a.status === 'completed') e.completed += 1;
            byForm.set(a.form_id, e);
        }
        res.json(forms.map((f) => ({
            id: f.id, title: f.title, description: f.description,
            fields: typeof f.fields === 'string' ? JSON.parse(f.fields) : f.fields || [],
            created_at: f.created_at,
            ...(byForm.get(f.id) || { assigned: 0, completed: 0 }),
        })));
    } catch (err) {
        console.error('GET /forms:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/', requireAuth, requireCoach, async (req, res) => {
    try {
        const title = String(req.body?.title || '').trim().slice(0, 200);
        if (!title) return res.status(400).json({ error: 'A form title is required.' });
        const [row] = await db.insert(coachForms).values({
            coach_id: uid(req),
            title,
            description: req.body?.description ? String(req.body.description).slice(0, 1000) : null,
            fields: cleanFields(req.body?.fields),
        }).returning();
        res.status(201).json(row);
    } catch (err) {
        console.error('POST /forms:', err);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', requireAuth, requireCoach, async (req, res) => {
    try {
        await db.delete(coachForms).where(and(eq(coachForms.id, Number(req.params.id)), eq(coachForms.coach_id, uid(req))));
        res.json({ ok: true });
    } catch (err) {
        console.error('DELETE /forms/:id:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/:id/assign', requireAuth, requireCoach, async (req, res) => {
    try {
        const me = uid(req);
        const formId = Number(req.params.id);
        const clientId = Number(req.body?.client_id);
        const [form] = await db.select({ id: coachForms.id }).from(coachForms).where(and(eq(coachForms.id, formId), eq(coachForms.coach_id, me))).limit(1);
        if (!form) return res.status(404).json({ error: 'Form not found.' });
        if (!(await ownsClient(me, clientId))) return res.status(404).json({ error: 'Client not on your roster.' });
        await db.insert(formAssignments).values({ form_id: formId, client_id: clientId })
            .onConflictDoNothing({ target: [formAssignments.form_id, formAssignments.client_id] });
        res.status(201).json({ ok: true });
    } catch (err) {
        console.error('POST /forms/:id/assign:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id/responses', requireAuth, requireCoach, async (req, res) => {
    try {
        const me = uid(req);
        const formId = Number(req.params.id);
        const [form] = await db.select().from(coachForms).where(and(eq(coachForms.id, formId), eq(coachForms.coach_id, me))).limit(1);
        if (!form) return res.status(404).json({ error: 'Form not found.' });
        const responses = await db
            .select({
                client_id: formResponses.client_id,
                answers: formResponses.answers,
                submitted_at: formResponses.submitted_at,
                first_name: users.first_name,
                last_name: users.last_name,
            })
            .from(formResponses)
            .innerJoin(users, eq(users.id, formResponses.client_id))
            .where(eq(formResponses.form_id, formId))
            .orderBy(desc(formResponses.submitted_at));
        res.json({
            form: { ...form, fields: typeof form.fields === 'string' ? JSON.parse(form.fields) : form.fields || [] },
            responses: responses.map((r) => ({
                client_id: r.client_id,
                name: `${r.first_name} ${r.last_name}`.trim(),
                answers: typeof r.answers === 'string' ? JSON.parse(r.answers) : r.answers || {},
                submitted_at: r.submitted_at,
            })),
        });
    } catch (err) {
        console.error('GET /forms/:id/responses:', err);
        res.status(500).json({ error: err.message });
    }
});

/* ----------------------------- client side ----------------------------- */

router.get('/my', requireAuth, async (req, res) => {
    try {
        const me = uid(req);
        const assigns = await db
            .select({ status: formAssignments.status, form_id: formAssignments.form_id })
            .from(formAssignments)
            .where(eq(formAssignments.client_id, me));
        if (!assigns.length) return res.json([]);
        const ids = assigns.map((a) => a.form_id);
        const forms = await db.select().from(coachForms).where(inArray(coachForms.id, ids));
        const responses = await db.select().from(formResponses).where(and(eq(formResponses.client_id, me), inArray(formResponses.form_id, ids)));
        const respByForm = new Map(responses.map((r) => [r.form_id, typeof r.answers === 'string' ? JSON.parse(r.answers) : r.answers]));
        const statusByForm = new Map(assigns.map((a) => [a.form_id, a.status]));
        res.json(forms.map((f) => ({
            id: f.id, title: f.title, description: f.description,
            fields: typeof f.fields === 'string' ? JSON.parse(f.fields) : f.fields || [],
            status: statusByForm.get(f.id) || 'pending',
            my_answers: respByForm.get(f.id) || null,
        })));
    } catch (err) {
        console.error('GET /forms/my:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/my/:formId/respond', requireAuth, async (req, res) => {
    try {
        const me = uid(req);
        const formId = Number(req.params.formId);
        const [assign] = await db.select({ id: formAssignments.id }).from(formAssignments)
            .where(and(eq(formAssignments.form_id, formId), eq(formAssignments.client_id, me))).limit(1);
        if (!assign) return res.status(404).json({ error: 'This form is not assigned to you.' });
        const answers = req.body?.answers && typeof req.body.answers === 'object' ? req.body.answers : {};
        await db.insert(formResponses).values({ form_id: formId, client_id: me, answers })
            .onConflictDoUpdate({ target: [formResponses.form_id, formResponses.client_id], set: { answers, submitted_at: new Date() } });
        await db.update(formAssignments).set({ status: 'completed' })
            .where(and(eq(formAssignments.form_id, formId), eq(formAssignments.client_id, me)));
        res.status(201).json({ ok: true });
    } catch (err) {
        console.error('POST /forms/my/:formId/respond:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
