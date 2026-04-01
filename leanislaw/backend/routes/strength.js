import express from 'express';
import { db } from '../db.js';
import { bodyMetrics, strengthSnapshots, userStrengthProfile } from '../schema.js';
import { requireAuth } from '../middleware/auth.js';
import { and, desc, eq } from 'drizzle-orm';
import {
    classifyBench,
    classifyHinge,
    classifySquat,
    overallStrengthLevel,
} from '../lib/strengthStandards.js';

const router = express.Router();
const LBS_PER_KG = 2.2046226218;

function uid(req) {
    return Number(req.userId);
}

async function latestBodyweightLb(userId) {
    const rows = await db
        .select()
        .from(bodyMetrics)
        .where(eq(bodyMetrics.user_id, userId))
        .orderBy(desc(bodyMetrics.date))
        .limit(1);
    if (!rows[0]) return null;
    const kg = Number(rows[0].weight_kg);
    if (!Number.isFinite(kg) || kg <= 0) return null;
    return kg * LBS_PER_KG;
}

function buildClassification(benchLb, squatLb, hingeLb, bodyweightLb) {
    const bw = bodyweightLb;
    const benchLevel = classifyBench(benchLb, bw);
    const squatLevel = classifySquat(squatLb, bw);
    const hingeLevel = classifyHinge(hingeLb, bw);
    const overall = overallStrengthLevel(benchLevel, squatLevel, hingeLevel);
    return { benchLevel, squatLevel, hingeLevel, overall };
}

// GET /api/v1/strength/profile
router.get('/profile', requireAuth, async (req, res) => {
    try {
        const userId = uid(req);
        const rows = await db
            .select()
            .from(userStrengthProfile)
            .where(eq(userStrengthProfile.user_id, userId))
            .limit(1);
        res.json(rows[0] ?? null);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/strength/profile — create (onboarding)
router.post('/profile', requireAuth, async (req, res) => {
    try {
        const userId = uid(req);
        const {
            years_lifting,
            bench_variation,
            bench_lb,
            squat_variation,
            squat_lb,
            hinge_variation,
            hinge_lb,
        } = req.body;

        const b = Number(bench_lb);
        const s = Number(squat_lb);
        const h = Number(hinge_lb);
        if (![b, s, h].every((x) => Number.isFinite(x) && x > 0)) {
            return res.status(400).json({ error: 'bench_lb, squat_lb, and hinge_lb are required' });
        }

        const bw = await latestBodyweightLb(userId);
        if (!bw) {
            return res.status(400).json({ error: 'Log body weight first (body metrics).' });
        }

        const { benchLevel, squatLevel, hingeLevel, overall } = buildClassification(b, s, h, bw);

        let y = null;
        if (years_lifting !== undefined && years_lifting !== null && years_lifting !== '') {
            const n = Number(years_lifting);
            y = Number.isFinite(n) ? String(n) : null;
        }

        await db
            .insert(userStrengthProfile)
            .values({
                user_id: userId,
                years_lifting: y,
                bench_variation: bench_variation || null,
                bench_lb: String(b),
                baseline_bench_lb: String(b),
                squat_variation: squat_variation || null,
                squat_lb: String(s),
                baseline_squat_lb: String(s),
                hinge_variation: hinge_variation || null,
                hinge_lb: String(h),
                baseline_hinge_lb: String(h),
                bench_level: benchLevel,
                squat_level: squatLevel,
                hinge_level: hingeLevel,
                overall_level: overall,
                updated_at: new Date(),
            })
            .onConflictDoUpdate({
                target: userStrengthProfile.user_id,
                set: {
                    years_lifting: y,
                    bench_variation: bench_variation || null,
                    bench_lb: String(b),
                    squat_variation: squat_variation || null,
                    squat_lb: String(s),
                    hinge_variation: hinge_variation || null,
                    hinge_lb: String(h),
                    bench_level: benchLevel,
                    squat_level: squatLevel,
                    hinge_level: hingeLevel,
                    overall_level: overall,
                    updated_at: new Date(),
                },
            });

        const today = new Date().toISOString().slice(0, 10);
        await db
            .insert(strengthSnapshots)
            .values({
                user_id: userId,
                date: today,
                bench_lb: String(b),
                squat_lb: String(s),
                hinge_lb: String(h),
            })
            .onConflictDoUpdate({
                target: [strengthSnapshots.user_id, strengthSnapshots.date],
                set: {
                    bench_lb: String(b),
                    squat_lb: String(s),
                    hinge_lb: String(h),
                },
            });

        const [row] = await db
            .select()
            .from(userStrengthProfile)
            .where(eq(userStrengthProfile.user_id, userId))
            .limit(1);

        res.status(201).json(row);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/v1/strength/profile — update current lift numbers (baselines unchanged)
router.patch('/profile', requireAuth, async (req, res) => {
    try {
        const userId = uid(req);
        const [existing] = await db
            .select()
            .from(userStrengthProfile)
            .where(eq(userStrengthProfile.user_id, userId))
            .limit(1);
        if (!existing) {
            return res.status(404).json({ error: 'No strength profile' });
        }

        const bench = req.body.bench_lb != null ? Number(req.body.bench_lb) : Number(existing.bench_lb);
        const squat = req.body.squat_lb != null ? Number(req.body.squat_lb) : Number(existing.squat_lb);
        const hinge = req.body.hinge_lb != null ? Number(req.body.hinge_lb) : Number(existing.hinge_lb);

        const bw = await latestBodyweightLb(userId);
        if (!bw) {
            return res.status(400).json({ error: 'Log body weight first.' });
        }

        const { benchLevel, squatLevel, hingeLevel, overall } = buildClassification(bench, squat, hinge, bw);

        const patch = {
            bench_lb: String(bench),
            squat_lb: String(squat),
            hinge_lb: String(hinge),
            bench_level: benchLevel,
            squat_level: squatLevel,
            hinge_level: hingeLevel,
            overall_level: overall,
            updated_at: new Date(),
        };
        if (req.body.years_lifting !== undefined) {
            patch.years_lifting =
                req.body.years_lifting === '' ? null : String(req.body.years_lifting);
        }
        if (req.body.bench_variation !== undefined) patch.bench_variation = req.body.bench_variation;
        if (req.body.squat_variation !== undefined) patch.squat_variation = req.body.squat_variation;
        if (req.body.hinge_variation !== undefined) patch.hinge_variation = req.body.hinge_variation;

        await db.update(userStrengthProfile).set(patch).where(eq(userStrengthProfile.user_id, userId));

        const today = new Date().toISOString().slice(0, 10);
        await db
            .insert(strengthSnapshots)
            .values({
                user_id: userId,
                date: today,
                bench_lb: String(bench),
                squat_lb: String(squat),
                hinge_lb: String(hinge),
            })
            .onConflictDoUpdate({
                target: [strengthSnapshots.user_id, strengthSnapshots.date],
                set: {
                    bench_lb: String(bench),
                    squat_lb: String(squat),
                    hinge_lb: String(hinge),
                },
            });

        const [row] = await db
            .select()
            .from(userStrengthProfile)
            .where(eq(userStrengthProfile.user_id, userId))
            .limit(1);

        res.json(row);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
