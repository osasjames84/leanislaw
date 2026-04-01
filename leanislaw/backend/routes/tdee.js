import express from 'express';
import { db } from '../db.js';
import {
    bodyMetrics,
    dailyTdeeInputs,
    daily_logs,
    userStrengthProfile,
    userTdeeState,
} from '../schema.js';
import { requireAuth } from '../middleware/auth.js';
import { and, asc, desc, eq, gte, lte } from 'drizzle-orm';
import { computeTdeeBreakdown } from '../lib/tdeeEngine.js';
import {
    impliedTdeeFromIntakeAndSlope,
    nextEmaIntake,
    nextEmaTdee,
    weightSlopeKgPerDay,
} from '../lib/emaTdee.js';
import { estimateMuscleVsFatLb } from '../lib/muscleGainEstimate.js';

const router = express.Router();
const LBS_PER_KG = 2.2046226218;

/** Calendar YYYY-MM-DD in the environment's local timezone (matches seed-dashboard-demo). */
function isoDateLocal(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** Normalize a pg date / string / Date to YYYY-MM-DD for map keys and comparisons. */
function dateKey(value) {
    if (value == null || value === '') return '';
    if (typeof value === 'string') return value.slice(0, 10);
    if (value instanceof Date) return isoDateLocal(value);
    return String(value).slice(0, 10);
}

function uid(req) {
    return Number(req.userId);
}

/** Latest body row on or before `dateStr` (YYYY-MM-DD). */
async function getBodyMetricForDate(userId, dateStr) {
    const rows = await db
        .select()
        .from(bodyMetrics)
        .where(and(eq(bodyMetrics.user_id, userId), lte(bodyMetrics.date, dateStr)))
        .orderBy(desc(bodyMetrics.date))
        .limit(1);
    return rows[0] ?? null;
}

async function getEffectiveSteps(userId, dateStr, tdeeRow) {
    const fromTdee = tdeeRow?.steps ?? 0;
    const logRows = await db
        .select()
        .from(daily_logs)
        .where(and(eq(daily_logs.userId, userId), eq(daily_logs.date, dateStr)))
        .limit(1);
    const fromLog = logRows[0]?.steps ?? 0;
    return Math.max(Number(fromTdee) || 0, Number(fromLog) || 0);
}

function parseActivities(raw) {
    if (!raw) return [];
    if (!Array.isArray(raw)) return [];
    return raw.filter(
        (a) =>
            a &&
            (a.type === 'weightlifting' || a.type === 'cardio') &&
            Number(a.hours) >= 0
    );
}

async function upsertDailyLogPatch(userId, dateStr, patch) {
    const rows = await db
        .select()
        .from(daily_logs)
        .where(and(eq(daily_logs.userId, userId), eq(daily_logs.date, dateStr)))
        .limit(1);
    const nextSteps = patch.steps !== undefined ? patch.steps : rows[0]?.steps ?? null;
    const nextCal = patch.calories !== undefined ? patch.calories : rows[0]?.calories ?? null;

    if (rows[0]) {
        await db
            .update(daily_logs)
            .set({
                steps: nextSteps,
                calories: nextCal,
            })
            .where(eq(daily_logs.id, rows[0].id));
    } else {
        await db.insert(daily_logs).values({
            userId,
            date: dateStr,
            steps: nextSteps,
            calories: nextCal,
        });
    }
}

export async function recomputeUserEmaTdee(userId) {
    const [state] = await db
        .select()
        .from(userTdeeState)
        .where(eq(userTdeeState.user_id, userId))
        .limit(1);
    if (!state) return null;

    const bodyAsc = await db
        .select()
        .from(bodyMetrics)
        .where(eq(bodyMetrics.user_id, userId))
        .orderBy(asc(bodyMetrics.date))
        .limit(60);

    const recent = bodyAsc.slice(-45);
    const slope = weightSlopeKgPerDay(recent);

    const logsAsc = await db
        .select()
        .from(daily_logs)
        .where(eq(daily_logs.userId, userId))
        .orderBy(asc(daily_logs.date))
        .limit(120);

    let emaI = state.ema_intake != null ? Number(state.ema_intake) : null;
    for (const row of logsAsc) {
        if (row.calories != null && Number(row.calories) > 0) {
            emaI = nextEmaIntake(emaI, row.calories);
        }
    }

    const baseline = Number(state.baseline_tdee);
    let prevTdee = state.ema_tdee != null ? Number(state.ema_tdee) : baseline;

    const implied = impliedTdeeFromIntakeAndSlope(emaI, slope);
    let newTdee = prevTdee;
    if (emaI != null && implied != null && Number.isFinite(implied) && implied > 0) {
        newTdee = nextEmaTdee(prevTdee, implied, baseline);
    } else if (emaI != null && Number.isFinite(emaI) && emaI > 0) {
        newTdee = nextEmaTdee(prevTdee, emaI, baseline);
    }

    await db
        .update(userTdeeState)
        .set({
            ema_intake: emaI != null ? String(Math.round(emaI * 10) / 10) : state.ema_intake,
            ema_tdee: String(Math.round(newTdee * 10) / 10),
            updated_at: new Date(),
        })
        .where(eq(userTdeeState.user_id, userId));

    return { ema_tdee: newTdee, ema_intake: emaI, slope };
}

/**
 * GET /api/v1/tdee/dashboard-trend?days=35
 * Series for dashboard charts: steps, calories, weight, formula TDEE (Lyle × steps) per day.
 */
router.get('/dashboard-trend', requireAuth, async (req, res) => {
    try {
        const userId = uid(req);
        const n = Math.min(90, Math.max(7, Number(req.query.days) || 35));
        const end = new Date();
        const dates = [];
        for (let i = n - 1; i >= 0; i--) {
            const d = new Date(end);
            d.setHours(12, 0, 0, 0);
            d.setDate(d.getDate() - i);
            dates.push(isoDateLocal(d));
        }
        const startD = dates[0];
        const endD = dates[dates.length - 1];

        const logs = await db
            .select()
            .from(daily_logs)
            .where(
                and(
                    eq(daily_logs.userId, userId),
                    gte(daily_logs.date, startD),
                    lte(daily_logs.date, endD)
                )
            );
        const logByDate = {};
        for (const row of logs) {
            const k = dateKey(row.date);
            if (k) logByDate[k] = row;
        }

        const bodyAsc = await db
            .select()
            .from(bodyMetrics)
            .where(eq(bodyMetrics.user_id, userId))
            .orderBy(asc(bodyMetrics.date));

        const [metState] = await db
            .select()
            .from(userTdeeState)
            .where(eq(userTdeeState.user_id, userId))
            .limit(1);

        const tdeeRows = await db
            .select()
            .from(dailyTdeeInputs)
            .where(
                and(
                    eq(dailyTdeeInputs.user_id, userId),
                    gte(dailyTdeeInputs.date, startD),
                    lte(dailyTdeeInputs.date, endD)
                )
            );
        const tdeeInputByDate = {};
        for (const row of tdeeRows) {
            tdeeInputByDate[dateKey(row.date)] = row;
        }

        /** Latest body row with fat % on or before dateStr */
        function bodyForDate(dateStr) {
            let best = null;
            for (const r of bodyAsc) {
                const ds = dateKey(r.date);
                if (ds && ds <= dateStr && r.body_fat_pct != null) best = r;
            }
            return best;
        }

        const series = [];
        for (const dateStr of dates) {
            const log = logByDate[dateStr];
            const stepsLog = log?.steps != null ? Number(log.steps) : 0;
            const tIn = tdeeInputByDate[dateStr];
            const stepsTdee = tIn?.steps != null ? Number(tIn.steps) : 0;
            const steps = Math.max(stepsLog, stepsTdee);
            const calories = log?.calories != null ? Number(log.calories) : null;
            const bodyRow = bodyForDate(dateStr);
            let formulaTdee = null;
            let weightKg = null;
            if (bodyRow) {
                weightKg = Number(bodyRow.weight_kg);
                const bf = Number(bodyRow.body_fat_pct);
                try {
                    const br = computeTdeeBreakdown({
                        weightKg,
                        bodyFatPct: bf,
                        steps,
                        activities: [],
                    });
                    formulaTdee = br.tdee;
                } catch {
                    formulaTdee = null;
                }
            }
            series.push({
                date: dateStr,
                steps,
                calories,
                weight_kg: weightKg,
                formula_tdee: formulaTdee,
            });
        }

        const emaT = metState?.ema_tdee != null ? Number(metState.ema_tdee) : null;
        const emaI = metState?.ema_intake != null ? Number(metState.ema_intake) : null;
        const baseline = metState?.baseline_tdee != null ? Number(metState.baseline_tdee) : null;

        const minExpected = Math.min(n - 2, Math.max(4, Math.floor(n / 4)));
        const sparse_data_hint =
            logs.length < minExpected && n >= 14
                ? 'Your account has few daily logs in this window (charts are per-user). For demo data: open Dashboard → menu (☰) → Settings and note your Account id, then run the seed script with SEED_USER_ID set to that number.'
                : null;

        res.json({
            range_start: startD,
            range_end: endD,
            ema_tdee: Number.isFinite(emaT) && emaT > 0 ? Math.round(emaT) : null,
            ema_intake: Number.isFinite(emaI) && emaI > 0 ? Math.round(emaI) : null,
            baseline_tdee: Number.isFinite(baseline) && baseline > 0 ? Math.round(baseline) : null,
            series,
            log_rows_in_range: logs.length,
            sparse_data_hint,
        });
    } catch (err) {
        console.error('dashboard-trend error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/tdee/summary?date=&include_formula=1
router.get('/summary', requireAuth, async (req, res) => {
    try {
        const userId = uid(req);
        const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
        const includeFormula = req.query.include_formula === '1' || req.query.include_formula === 'true';

        const bodyRow = await getBodyMetricForDate(userId, dateStr);
        if (!bodyRow) {
            return res.status(200).json({
                date: dateStr,
                missingBodyMetric: true,
                message: 'Add your weight for this day or an earlier day to see an estimate.',
            });
        }
        if (bodyRow.body_fat_pct == null) {
            return res.status(200).json({
                date: dateStr,
                missingBodyFat: true,
                bodyMetric: bodyRow,
                message: 'Add body fat % to finish your profile for this estimate.',
            });
        }

        const tdeeRows = await db
            .select()
            .from(dailyTdeeInputs)
            .where(and(eq(dailyTdeeInputs.user_id, userId), eq(dailyTdeeInputs.date, dateStr)))
            .limit(1);
        const tdeeRow = tdeeRows[0] ?? null;
        const steps = await getEffectiveSteps(userId, dateStr, tdeeRow);
        const activities = parseActivities(tdeeRow?.activities);

        const weightKg = Number(bodyRow.weight_kg);
        const bodyFatPct = Number(bodyRow.body_fat_pct);
        const breakdown = computeTdeeBreakdown({ weightKg, bodyFatPct, steps, activities });

        const [metState] = await db
            .select()
            .from(userTdeeState)
            .where(eq(userTdeeState.user_id, userId))
            .limit(1);

        const basePayload = {
            date: dateStr,
            bodyMetricUsed: {
                date: bodyRow.date,
                weight_kg: weightKg,
                body_fat_pct: bodyFatPct,
            },
            steps,
            activities,
        };

        if (metState) {
            const emaT = metState.ema_tdee != null ? Number(metState.ema_tdee) : null;
            const displayTdee = Math.round(
                Number.isFinite(emaT) && emaT > 0 ? emaT : Number(metState.baseline_tdee)
            );
            return res.json({
                ...basePayload,
                displayTdee,
                dynamic: {
                    baseline_tdee: Number(metState.baseline_tdee),
                    ema_tdee: emaT,
                    ema_intake: metState.ema_intake != null ? Number(metState.ema_intake) : null,
                    updated_at: metState.updated_at,
                    source: 'ema',
                },
                ...(includeFormula ? { breakdown } : {}),
            });
        }

        return res.json({
            ...basePayload,
            displayTdee: breakdown.tdee,
            breakdown,
        });
    } catch (err) {
        console.error('TDEE summary error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/tdee/insights — dashboard: EMA TDEE, month delta, muscle/fat estimate, strength %
router.get('/insights', requireAuth, async (req, res) => {
    try {
        const userId = uid(req);
        const [metState] = await db
            .select()
            .from(userTdeeState)
            .where(eq(userTdeeState.user_id, userId))
            .limit(1);

        const [str] = await db
            .select()
            .from(userStrengthProfile)
            .where(eq(userStrengthProfile.user_id, userId))
            .limit(1);

        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        const startMonth = `${y}-${String(m + 1).padStart(2, '0')}-01`;

        const monthMetrics = await db
            .select()
            .from(bodyMetrics)
            .where(and(eq(bodyMetrics.user_id, userId), gte(bodyMetrics.date, startMonth)))
            .orderBy(asc(bodyMetrics.date));

        let weightDeltaLb = 0;
        if (monthMetrics.length >= 2) {
            const first = monthMetrics[0];
            const last = monthMetrics[monthMetrics.length - 1];
            weightDeltaLb =
                Math.round((Number(last.weight_kg) - Number(first.weight_kg)) * LBS_PER_KG * 10) / 10;
        }

        const parts = [];
        if (str && Number(str.baseline_bench_lb) > 0) {
            parts.push(
                ((Number(str.bench_lb) - Number(str.baseline_bench_lb)) / Number(str.baseline_bench_lb)) *
                    100
            );
        }
        if (str && Number(str.baseline_squat_lb) > 0) {
            parts.push(
                ((Number(str.squat_lb) - Number(str.baseline_squat_lb)) / Number(str.baseline_squat_lb)) *
                    100
            );
        }
        if (str && Number(str.baseline_hinge_lb) > 0) {
            parts.push(
                ((Number(str.hinge_lb) - Number(str.baseline_hinge_lb)) / Number(str.baseline_hinge_lb)) *
                    100
            );
        }
        const strengthAvgPctChange =
            parts.length > 0 ? Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 10) / 10 : 0;

        const muscleEst = estimateMuscleVsFatLb({
            weightDeltaLb,
            strengthAvgPctChange,
            overallLevel: str?.overall_level ?? 'Intermediate',
        });

        const displayTdee = metState
            ? Math.round(
                  metState.ema_tdee != null && Number(metState.ema_tdee) > 0
                      ? Number(metState.ema_tdee)
                      : Number(metState.baseline_tdee)
              )
            : null;

        res.json({
            dynamicTdee: displayTdee,
            metabolic: metState
                ? {
                      baseline_tdee: Number(metState.baseline_tdee),
                      ema_tdee: metState.ema_tdee != null ? Number(metState.ema_tdee) : null,
                      ema_intake: metState.ema_intake != null ? Number(metState.ema_intake) : null,
                      updated_at: metState.updated_at,
                  }
                : null,
            monthly: {
                month_start: startMonth,
                weight_delta_lb: weightDeltaLb,
                log_days: monthMetrics.length,
                estimated_muscle_lb: muscleEst.muscle_lb,
                estimated_fat_lb: muscleEst.fat_lb,
                note: muscleEst.note,
            },
            strength: str
                ? {
                      overall_level: str.overall_level,
                      bench_level: str.bench_level,
                      squat_level: str.squat_level,
                      hinge_level: str.hinge_level,
                      avg_pct_vs_baseline: strengthAvgPctChange,
                      bench_lb: Number(str.bench_lb),
                      squat_lb: Number(str.squat_lb),
                      hinge_lb: Number(str.hinge_lb),
                      years_lifting: str.years_lifting != null ? Number(str.years_lifting) : null,
                  }
                : null,
        });
    } catch (err) {
        console.error('insights error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/tdee/baseline { baseline_tdee } — one-time seed after onboarding formula
router.post('/baseline', requireAuth, async (req, res) => {
    try {
        const userId = uid(req);
        const bt = Math.round(Number(req.body.baseline_tdee));
        if (!Number.isFinite(bt) || bt < 800 || bt > 12000) {
            return res.status(400).json({ error: 'Invalid baseline_tdee' });
        }

        await db
            .insert(userTdeeState)
            .values({
                user_id: userId,
                baseline_tdee: bt,
                ema_tdee: String(bt),
                ema_intake: null,
                updated_at: new Date(),
            })
            .onConflictDoUpdate({
                target: userTdeeState.user_id,
                set: {
                    baseline_tdee: bt,
                    ema_tdee: String(bt),
                    updated_at: new Date(),
                },
            });

        const [row] = await db
            .select()
            .from(userTdeeState)
            .where(eq(userTdeeState.user_id, userId))
            .limit(1);

        res.status(201).json(row);
    } catch (err) {
        console.error('baseline error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/tdee/day-log?date= — calories / steps for a day
router.get('/day-log', requireAuth, async (req, res) => {
    try {
        const userId = uid(req);
        const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
        const rows = await db
            .select()
            .from(daily_logs)
            .where(and(eq(daily_logs.userId, userId), eq(daily_logs.date, dateStr)))
            .limit(1);
        res.json(rows[0] ?? { date: dateStr, calories: null, steps: null });
    } catch (err) {
        console.error('day-log get error:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/v1/tdee/day-log { date, calories?, steps? }
router.put('/day-log', requireAuth, async (req, res) => {
    try {
        const userId = uid(req);
        const { date, calories, steps } = req.body;
        if (!date) {
            return res.status(400).json({ error: 'date is required' });
        }
        const patch = {};
        if (calories !== undefined) {
            const c = Math.max(0, Math.floor(Number(calories) || 0));
            patch.calories = c > 0 ? c : null;
        }
        if (steps !== undefined) {
            patch.steps = Math.max(0, Math.floor(Number(steps) || 0));
        }
        await upsertDailyLogPatch(userId, date, patch);
        try {
            await recomputeUserEmaTdee(userId);
        } catch (e) {
            console.error('EMA recompute:', e);
        }

        const rows = await db
            .select()
            .from(daily_logs)
            .where(and(eq(daily_logs.userId, userId), eq(daily_logs.date, date)))
            .limit(1);
        res.json(rows[0] ?? patch);
    } catch (err) {
        console.error('day-log error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/body-metrics', requireAuth, async (req, res) => {
    try {
        const userId = uid(req);
        const { date, weight_kg, body_fat_pct } = req.body;
        if (!date || weight_kg == null) {
            return res.status(400).json({ error: 'date and weight_kg are required' });
        }

        const bfParsed =
            body_fat_pct === undefined || body_fat_pct === null || body_fat_pct === ''
                ? null
                : String(body_fat_pct);

        await db
            .insert(bodyMetrics)
            .values({
                user_id: userId,
                date,
                weight_kg: String(weight_kg),
                body_fat_pct: bfParsed,
            })
            .onConflictDoUpdate({
                target: [bodyMetrics.user_id, bodyMetrics.date],
                set: {
                    weight_kg: String(weight_kg),
                    body_fat_pct: bfParsed,
                },
            });

        const [row] = await db
            .select()
            .from(bodyMetrics)
            .where(and(eq(bodyMetrics.user_id, userId), eq(bodyMetrics.date, date)))
            .limit(1);

        try {
            await recomputeUserEmaTdee(userId);
        } catch (e) {
            console.error('EMA recompute:', e);
        }

        res.status(201).json(row);
    } catch (err) {
        console.error('body-metrics error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/body-metrics', requireAuth, async (req, res) => {
    try {
        const userId = uid(req);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
        const rows = await db
            .select()
            .from(bodyMetrics)
            .where(eq(bodyMetrics.user_id, userId))
            .orderBy(desc(bodyMetrics.date))
            .limit(limit);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/daily', requireAuth, async (req, res) => {
    try {
        const userId = uid(req);
        const { date, steps, activities } = req.body;
        if (!date) {
            return res.status(400).json({ error: 'date is required' });
        }
        const acts = parseActivities(activities);
        const stepVal = Math.max(0, Math.floor(Number(steps) || 0));

        await db
            .insert(dailyTdeeInputs)
            .values({
                user_id: userId,
                date,
                steps: stepVal,
                activities: acts,
            })
            .onConflictDoUpdate({
                target: [dailyTdeeInputs.user_id, dailyTdeeInputs.date],
                set: {
                    steps: stepVal,
                    activities: acts,
                },
            });

        const [row] = await db
            .select()
            .from(dailyTdeeInputs)
            .where(and(eq(dailyTdeeInputs.user_id, userId), eq(dailyTdeeInputs.date, date)))
            .limit(1);

        res.json(row);
    } catch (err) {
        console.error('tdee daily error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
