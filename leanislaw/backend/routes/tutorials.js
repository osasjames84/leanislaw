/**
 * Coach resource library ("tutorials"): links/videos/docs shared with clients.
 *
 *  Coach side (requireCoach):
 *    GET    /        list my tutorials
 *    POST   /        create { title, description, url, category }
 *    DELETE /:id     delete
 *
 *  Client side (requireAuth):
 *    GET    /my      tutorials shared by my coach(es)
 */

import express from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireCoach } from './coaching.js';
import { coachTutorials, coachClients } from '../schema.js';
import { and, desc, eq, inArray } from 'drizzle-orm';

const router = express.Router();
const uid = (req) => Number(req.userId);

function shape(t) {
    return { id: t.id, title: t.title, description: t.description, url: t.url, category: t.category, created_at: t.created_at };
}

router.get('/', requireAuth, requireCoach, async (req, res) => {
    try {
        const rows = await db.select().from(coachTutorials).where(eq(coachTutorials.coach_id, uid(req))).orderBy(desc(coachTutorials.id));
        res.json(rows.map(shape));
    } catch (err) {
        console.error('GET /tutorials:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/', requireAuth, requireCoach, async (req, res) => {
    try {
        const title = String(req.body?.title || '').trim().slice(0, 200);
        if (!title) return res.status(400).json({ error: 'A title is required.' });
        let url = req.body?.url ? String(req.body.url).trim().slice(0, 500) : null;
        if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
        const [row] = await db.insert(coachTutorials).values({
            coach_id: uid(req),
            title,
            description: req.body?.description ? String(req.body.description).slice(0, 1000) : null,
            url,
            category: req.body?.category ? String(req.body.category).slice(0, 60) : null,
        }).returning();
        res.status(201).json(shape(row));
    } catch (err) {
        console.error('POST /tutorials:', err);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', requireAuth, requireCoach, async (req, res) => {
    try {
        await db.delete(coachTutorials).where(and(eq(coachTutorials.id, Number(req.params.id)), eq(coachTutorials.coach_id, uid(req))));
        res.json({ ok: true });
    } catch (err) {
        console.error('DELETE /tutorials/:id:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/my', requireAuth, async (req, res) => {
    try {
        const me = uid(req);
        const coaches = await db.select({ coach_id: coachClients.coach_id }).from(coachClients).where(eq(coachClients.client_id, me));
        if (!coaches.length) return res.json([]);
        const rows = await db.select().from(coachTutorials)
            .where(inArray(coachTutorials.coach_id, coaches.map((c) => c.coach_id)))
            .orderBy(desc(coachTutorials.id));
        res.json(rows.map(shape));
    } catch (err) {
        console.error('GET /tutorials/my:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
