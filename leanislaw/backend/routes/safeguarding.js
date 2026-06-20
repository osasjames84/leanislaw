/**
 * Client-facing duty-of-care endpoints:
 *  - intake (PAR-Q + wellbeing) captured at onboarding
 *  - support signpost (region-appropriate ED support; coaching, not medical care)
 *  - weekly wellbeing check-in (feeds the coach report)
 *  - "my week" adherence-only view that respects hide_raw_numbers
 *
 * Concerning-pattern FLAGS are never returned here — they are coach-only.
 */

import express from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { clientSafeguarding, weeklyCheckins, weeklyReports } from '../schema.js';
import { and, eq } from 'drizzle-orm';
import { supportForRegion } from '../lib/supportResources.js';
import { resolveWeek, mondayOf, isoDate } from '../lib/weeklyReport/weekRange.js';

const router = express.Router();

function uid(req) {
    return Number(req.userId);
}

async function loadSafeguarding(clientId) {
    const [row] = await db
        .select()
        .from(clientSafeguarding)
        .where(eq(clientSafeguarding.client_id, clientId))
        .limit(1);
    return row || null;
}

// GET /api/v1/safeguarding/me — what the client app needs to render duty-of-care.
router.get('/me', requireAuth, async (req, res) => {
    try {
        const row = await loadSafeguarding(uid(req));
        const region = row?.support_region || 'UK';
        res.json({
            screen_completed: row?.screen_completed ?? false,
            hide_raw_numbers: row?.hide_raw_numbers ?? false,
            support_region: region,
            support: supportForRegion(region),
        });
    } catch (err) {
        console.error('GET /safeguarding/me:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/safeguarding/support?region= — always-available signpost.
router.get('/support', requireAuth, async (req, res) => {
    try {
        let region = req.query?.region;
        if (!region) {
            const row = await loadSafeguarding(uid(req));
            region = row?.support_region || 'UK';
        }
        res.json(supportForRegion(region));
    } catch (err) {
        console.error('GET /safeguarding/support:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/safeguarding/intake { par_q: {...}, wellbeing_note?, support_region? }
router.post('/intake', requireAuth, async (req, res) => {
    try {
        const parQ = req.body?.par_q;
        if (!parQ || typeof parQ !== 'object') {
            return res.status(400).json({ error: 'par_q answers are required.' });
        }
        const set = {
            par_q: parQ,
            screen_completed: true,
            wellbeing_note:
                req.body?.wellbeing_note != null ? String(req.body.wellbeing_note).slice(0, 2000) : null,
            updated_at: new Date(),
        };
        if (req.body?.support_region) {
            set.support_region = String(req.body.support_region).toUpperCase().slice(0, 8);
        }
        await db
            .insert(clientSafeguarding)
            .values({ client_id: uid(req), ...set })
            .onConflictDoUpdate({ target: clientSafeguarding.client_id, set });
        res.status(201).json({ ok: true, screen_completed: true });
    } catch (err) {
        console.error('POST /safeguarding/intake:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/safeguarding/checkin { week_start?, sleep_h?, energy_1to5?, stress_1to5?, notes? }
router.post('/checkin', requireAuth, async (req, res) => {
    try {
        const weekStart = req.body?.week_start
            ? resolveWeek(req.body.week_start).weekStart
            : isoDate(mondayOf(new Date()));

        const clamp = (v, lo, hi) => {
            const n = Number(v);
            return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null;
        };
        const sleep = req.body?.sleep_h != null ? clamp(req.body.sleep_h, 0, 24) : null;
        const energy = req.body?.energy_1to5 != null ? clamp(req.body.energy_1to5, 1, 5) : null;
        const stress = req.body?.stress_1to5 != null ? clamp(req.body.stress_1to5, 1, 5) : null;
        const notes = req.body?.notes != null ? String(req.body.notes).slice(0, 2000) : null;

        const values = {
            client_id: uid(req),
            week_start: weekStart,
            sleep_h: sleep != null ? String(sleep) : null,
            energy_1to5: energy != null ? Math.round(energy) : null,
            stress_1to5: stress != null ? Math.round(stress) : null,
            notes,
        };
        await db
            .insert(weeklyCheckins)
            .values(values)
            .onConflictDoUpdate({
                target: [weeklyCheckins.client_id, weeklyCheckins.week_start],
                set: {
                    sleep_h: values.sleep_h,
                    energy_1to5: values.energy_1to5,
                    stress_1to5: values.stress_1to5,
                    notes: values.notes,
                },
            });
        res.status(201).json({ ok: true, week_start: weekStart });
    } catch (err) {
        console.error('POST /safeguarding/checkin:', err);
        res.status(500).json({ error: err.message });
    }
});

function adherenceLabel(pct) {
    if (pct == null) return 'no_data';
    if (pct >= 80) return 'on_track';
    if (pct >= 50) return 'slightly_off';
    return 'off_track';
}

// GET /api/v1/safeguarding/my-week?week= — client adherence-only view.
// Respects hide_raw_numbers: when on, no raw kcal/weight is returned. Never
// returns coach flags.
router.get('/my-week', requireAuth, async (req, res) => {
    try {
        const clientId = uid(req);
        const week = resolveWeek(req.query?.week);
        const sg = await loadSafeguarding(clientId);
        const hide = sg?.hide_raw_numbers ?? false;

        const [row] = await db
            .select({ status: weeklyReports.status, model: weeklyReports.model })
            .from(weeklyReports)
            .where(
                and(
                    eq(weeklyReports.client_id, clientId),
                    eq(weeklyReports.week_start, week.weekStart)
                )
            )
            .limit(1);

        if (!row) {
            return res.json({
                has_report: false,
                week_start: week.weekStart,
                week_end: week.weekEnd,
                hide_raw_numbers: hide,
                message: 'No report yet for this week. Keep logging — your coach will review it.',
            });
        }

        const m = row.model || {};
        const trainingAdh = m.training?.adherence ?? null;
        const logAdh = m.nutrition?.log_adherence ?? null;

        const payload = {
            has_report: true,
            week_start: week.weekStart,
            week_end: week.weekEnd,
            hide_raw_numbers: hide,
            training: { status: adherenceLabel(trainingAdh) },
            nutrition_logging: { status: adherenceLabel(logAdh) },
            message:
                'This is a snapshot of your consistency. Your coach sees the full picture and will be in touch.',
        };

        // Only when the coach has NOT enabled hide-raw-numbers do we include figures.
        if (!hide) {
            payload.training.completed = m.training?.completed ?? null;
            payload.training.assigned = m.training?.assigned ?? null;
            payload.training.adherence = trainingAdh;
            payload.nutrition_logging.logged_days = m.nutrition?.logged_days ?? null;
            payload.nutrition_logging.target_days = m.nutrition?.target_days ?? null;
            payload.nutrition_logging.adherence = logAdh;
        }

        res.json(payload);
    } catch (err) {
        console.error('GET /safeguarding/my-week:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
