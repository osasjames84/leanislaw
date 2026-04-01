import express from 'express';
import { db } from '../db.js';
import { bodyMetrics, foodCatalog, foodLogEntries, userMacroPlan, userTdeeState } from '../schema.js';
import { requireAuth } from '../middleware/auth.js';
import { and, asc, desc, eq, ilike } from 'drizzle-orm';
import {
    computeMacroTargets,
    customMacrosMatchTarget,
    kcalFromMacroGrams,
    MACRO_KCAL_TOLERANCE,
    macrosForGrams,
} from '../lib/macroEngine.js';
import { getFoodDetails, searchFoodsByName } from '../lib/usdaService.js';

const router = express.Router();

function uid(req) {
    return Number(req.userId);
}

const GOALS = new Set(['lose', 'maintain', 'gain']);
const MEAL_SLOTS = new Set(['uncategorized', 'breakfast', 'lunch', 'dinner', 'snacks']);

function numOrZero(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function pickNutrient(nutrientsByName, keys) {
    for (const k of keys) {
        if (nutrientsByName[k] != null && Number.isFinite(Number(nutrientsByName[k]))) {
            return Number(nutrientsByName[k]);
        }
    }
    return 0;
}

// GET /api/v1/macros/usda/search?q=&pageSize=&page=
router.get('/usda/search', requireAuth, async (req, res) => {
    try {
        const q = String(req.query.q || '')
            .trim()
            .slice(0, 120);
        if (!q) {
            return res.status(400).json({ error: 'q is required' });
        }
        const pageSize = Math.max(1, Math.min(50, Number(req.query.pageSize) || 25));
        const pageNumber = Math.max(1, Number(req.query.page) || Number(req.query.pageNumber) || 1);
        const foods = await searchFoodsByName(q, { pageSize, pageNumber });
        res.json({ query: q, page: pageNumber, pageSize, foods });
    } catch (err) {
        console.error('USDA search error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/macros/usda/food/:fdcId
router.get('/usda/food/:fdcId', requireAuth, async (req, res) => {
    try {
        const fdcId = Number(req.params.fdcId);
        if (!Number.isFinite(fdcId) || fdcId <= 0) {
            return res.status(400).json({ error: 'Invalid fdcId' });
        }
        const detail = await getFoodDetails(fdcId);
        res.json(detail);
    } catch (err) {
        console.error('USDA food detail error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/macros/usda/day { date, fdcId, grams, meal_slot? }
// Fetches USDA detail, upserts a food_catalog row, and logs food for the day.
router.post('/usda/day', requireAuth, async (req, res) => {
    try {
        const userId = uid(req);
        const { date, fdcId, grams } = req.body;
        let mealSlot =
            req.body.meal_slot != null ? String(req.body.meal_slot).toLowerCase() : 'uncategorized';
        if (!MEAL_SLOTS.has(mealSlot)) mealSlot = 'uncategorized';

        if (!date) return res.status(400).json({ error: 'date is required' });
        const id = Number(fdcId);
        const g = Number(grams);
        if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Valid fdcId is required' });
        if (!Number.isFinite(g) || g <= 0 || g > 5000) {
            return res.status(400).json({ error: 'Valid grams required' });
        }

        const detail = await getFoodDetails(id);
        const n = detail.nutrientsByName || {};
        const kcal100 = pickNutrient(n, ['Energy']);
        const p100 = pickNutrient(n, ['Protein']);
        const c100 = pickNutrient(n, ['Carbohydrate, by difference', 'Carbohydrate']);
        const f100 = pickNutrient(n, ['Total lipid (fat)', 'Fatty acids, total saturated']);

        if (kcal100 <= 0) {
            return res.status(400).json({ error: 'USDA food missing usable kcal data' });
        }

        const catalogName = `USDA ${id} - ${String(detail.description || 'Unknown food').slice(0, 140)}`;
        let [food] = await db.select().from(foodCatalog).where(eq(foodCatalog.name, catalogName)).limit(1);
        if (!food) {
            const [insertedFood] = await db
                .insert(foodCatalog)
                .values({
                    name: catalogName,
                    kcal_per_100g: String(Math.max(0, Math.round(kcal100 * 100) / 100)),
                    protein_per_100g: String(Math.max(0, Math.round(p100 * 100) / 100)),
                    carbs_per_100g: String(Math.max(0, Math.round(c100 * 100) / 100)),
                    fat_per_100g: String(Math.max(0, Math.round(f100 * 100) / 100)),
                })
                .returning();
            food = insertedFood;
        }

        const [entry] = await db
            .insert(foodLogEntries)
            .values({
                user_id: userId,
                date,
                food_catalog_id: food.id,
                grams: String(g),
                meal_slot: mealSlot,
            })
            .returning();

        const macros = macrosForGrams(food, g);
        res.status(201).json({
            id: entry.id,
            date: entry.date,
            meal_slot: entry.meal_slot,
            food_id: food.id,
            name: detail.description || food.name,
            grams: g,
            source: 'usda',
            fdcId: id,
            per_100g: {
                kcal: numOrZero(food.kcal_per_100g),
                protein_g: numOrZero(food.protein_per_100g),
                carbs_g: numOrZero(food.carbs_per_100g),
                fat_g: numOrZero(food.fat_per_100g),
            },
            ...macros,
        });
    } catch (err) {
        console.error('USDA add-day error:', err);
        res.status(500).json({ error: err.message });
    }
});

async function maintenanceKcalForUser(userId) {
    const [met] = await db
        .select()
        .from(userTdeeState)
        .where(eq(userTdeeState.user_id, userId))
        .limit(1);
    if (!met) return null;
    const ema = met.ema_tdee != null ? Number(met.ema_tdee) : null;
    const baseline = Number(met.baseline_tdee);
    const v = Number.isFinite(ema) && ema > 0 ? ema : baseline;
    return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
}

function mergeTargetsWithCustom(baseTargets, planRow) {
    if (!baseTargets) return null;
    if (
        planRow?.custom_protein_g == null ||
        planRow?.custom_carbs_g == null ||
        planRow?.custom_fat_g == null
    ) {
        return { ...baseTargets, macros_custom: false };
    }
    const p = Number(planRow.custom_protein_g);
    const c = Number(planRow.custom_carbs_g);
    const f = Number(planRow.custom_fat_g);
    if (![p, c, f].every((x) => Number.isFinite(x) && x >= 0)) {
        return { ...baseTargets, macros_custom: false, macros_custom_stale: true };
    }
    if (!customMacrosMatchTarget(baseTargets.target_kcal, p, c, f)) {
        return {
            ...baseTargets,
            macros_custom: false,
            macros_custom_stale: true,
        };
    }
    return {
        ...baseTargets,
        protein_g: Math.round(p * 10) / 10,
        carbs_g: Math.round(c * 10) / 10,
        fat_g: Math.round(f * 10) / 10,
        macros_custom: true,
        macro_kcal_rounded: Math.round(kcalFromMacroGrams(p, c, f)),
    };
}

async function latestWeightKg(userId) {
    const rows = await db
        .select()
        .from(bodyMetrics)
        .where(eq(bodyMetrics.user_id, userId))
        .orderBy(desc(bodyMetrics.date))
        .limit(1);
    if (!rows[0]) return null;
    const w = Number(rows[0].weight_kg);
    return Number.isFinite(w) && w > 0 ? w : null;
}

function signedWeeklyFromClient(goal, weeklyRateKg) {
    const r = Number(weeklyRateKg);
    if (goal === 'maintain' || !Number.isFinite(r) || r === 0) return 0;
    if (goal === 'lose') return -Math.abs(r);
    if (goal === 'gain') return Math.abs(r);
    return 0;
}

/** Light-touch trend vs goal (optional string). */
async function coachingNote(userId, goal, weeklySignedKg) {
    if (goal !== 'lose' && goal !== 'gain') return null;
    const rows = await db
        .select()
        .from(bodyMetrics)
        .where(eq(bodyMetrics.user_id, userId))
        .orderBy(desc(bodyMetrics.date))
        .limit(20);
    if (rows.length < 2) return null;
    const newest = rows[0];
    const oldest = rows[rows.length - 1];
    const d0 = new Date(newest.date).getTime();
    const d1 = new Date(oldest.date).getTime();
    const days = (d0 - d1) / 86400000;
    if (days < 6) return null;
    const deltaKg = Number(newest.weight_kg) - Number(oldest.weight_kg);
    const actualWeekly = (deltaKg / days) * 7;
    if (goal === 'lose' && weeklySignedKg < 0) {
        const target = weeklySignedKg;
        if (actualWeekly > target * 0.35 && actualWeekly > -0.05) {
            return `Your scale trend (~${actualWeekly.toFixed(2)} kg/wk) is behind your ${target} kg/wk plan. Try a slightly larger deficit if recovery and adherence are good.`;
        }
    }
    if (goal === 'gain' && weeklySignedKg > 0) {
        const target = weeklySignedKg;
        if (actualWeekly < target * 0.35 && actualWeekly < 0.05) {
            return `Gain is slower than your ${target} kg/wk target. Consider a modest calorie bump or verify intake logging.`;
        }
    }
    return null;
}

// GET /api/v1/macros/foods?q=
router.get('/foods', requireAuth, async (req, res) => {
    try {
        const q = String(req.query.q || '')
            .trim()
            .slice(0, 80);
        if (!q) {
            const all = await db
                .select()
                .from(foodCatalog)
                .orderBy(asc(foodCatalog.name))
                .limit(30);
            return res.json(all);
        }
        const pattern = `%${q}%`;
        const rows = await db
            .select()
            .from(foodCatalog)
            .where(ilike(foodCatalog.name, pattern))
            .orderBy(asc(foodCatalog.name))
            .limit(25);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/macros/plan — plan + computed targets
router.get('/plan', requireAuth, async (req, res) => {
    try {
        const userId = uid(req);
        const maint = await maintenanceKcalForUser(userId);
        const weightKg = await latestWeightKg(userId);
        const [plan] = await db
            .select()
            .from(userMacroPlan)
            .where(eq(userMacroPlan.user_id, userId))
            .limit(1);

        const goal = plan?.goal ?? 'maintain';
        const weeklySigned = plan != null ? Number(plan.weekly_change_kg) : 0;
        const weeklyRateMagnitude =
            goal === 'lose' ? Math.abs(weeklySigned) : goal === 'gain' ? Math.abs(weeklySigned) : 0;

        let targets = null;
        let missing = [];
        if (maint == null) missing.push('maintenance calories (complete TDEE setup)');
        if (weightKg == null) missing.push('body weight (log weight)');
        if (missing.length === 0) {
            const computed = computeMacroTargets({
                maintenanceKcal: maint,
                weeklyChangeKg: weeklySigned,
                weightKg,
                goal,
            });
            targets = mergeTargetsWithCustom(computed, plan);
        }

        const note = await coachingNote(userId, goal, weeklySigned);

        res.json({
            plan: plan
                ? {
                      goal: plan.goal,
                      weekly_change_kg: Number(plan.weekly_change_kg),
                      weekly_rate_display_kg: weeklyRateMagnitude,
                      updated_at: plan.updated_at,
                      custom_protein_g:
                          plan.custom_protein_g != null ? Number(plan.custom_protein_g) : null,
                      custom_carbs_g:
                          plan.custom_carbs_g != null ? Number(plan.custom_carbs_g) : null,
                      custom_fat_g: plan.custom_fat_g != null ? Number(plan.custom_fat_g) : null,
                  }
                : {
                      goal: 'maintain',
                      weekly_change_kg: 0,
                      weekly_rate_display_kg: 0,
                      updated_at: null,
                      custom_protein_g: null,
                      custom_carbs_g: null,
                      custom_fat_g: null,
                  },
            targets,
            maintenance_kcal: maint,
            weight_kg_used: weightKg,
            missing_factors: missing,
            coaching_note: note,
            assumptions:
                'Targets use your live TDEE as maintenance, ~7700 kcal per kg weekly change, then protein by goal, then fat (~28% of calories) and remaining carbs. Optional custom macros must match total calories.',
            macro_kcal_tolerance: MACRO_KCAL_TOLERANCE,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/v1/macros/plan  body: { goal, weekly_rate_kg, custom_macros?: null | { protein_g, carbs_g, fat_g } }
router.put('/plan', requireAuth, async (req, res) => {
    try {
        const userId = uid(req);
        const goal = String(req.body.goal || 'maintain').toLowerCase();
        if (!GOALS.has(goal)) {
            return res.status(400).json({ error: 'goal must be lose, maintain, or gain' });
        }
        const rate = goal === 'maintain' ? 0 : Number(req.body.weekly_rate_kg);
        if (goal !== 'maintain' && (!Number.isFinite(rate) || rate <= 0 || rate > 2)) {
            return res.status(400).json({ error: 'weekly_rate_kg must be between 0 and 2 for lose/gain' });
        }
        const signed = signedWeeklyFromClient(goal, rate);

        const maint = await maintenanceKcalForUser(userId);
        const weightKg = await latestWeightKg(userId);
        let computedTargets = null;
        if (maint != null && weightKg != null) {
            computedTargets = computeMacroTargets({
                maintenanceKcal: maint,
                weeklyChangeKg: signed,
                weightKg,
                goal,
            });
        }

        const setObj = {
            goal,
            weekly_change_kg: String(signed),
            updated_at: new Date(),
        };

        if ('custom_macros' in req.body) {
            if (req.body.custom_macros == null) {
                setObj.custom_protein_g = null;
                setObj.custom_carbs_g = null;
                setObj.custom_fat_g = null;
            } else {
                if (!computedTargets) {
                    return res.status(400).json({
                        error: 'TDEE and logged weight required before saving custom macros',
                    });
                }
                const cm = req.body.custom_macros;
                const p = Number(cm.protein_g);
                const c = Number(cm.carbs_g);
                const f = Number(cm.fat_g);
                if (![p, c, f].every((x) => Number.isFinite(x) && x >= 0)) {
                    return res.status(400).json({
                        error: 'custom_macros needs non-negative protein_g, carbs_g, fat_g',
                    });
                }
                if (!customMacrosMatchTarget(computedTargets.target_kcal, p, c, f)) {
                    const k = Math.round(kcalFromMacroGrams(p, c, f));
                    return res.status(400).json({
                        error: `Macro calories (${k}) must be within ${MACRO_KCAL_TOLERANCE} kcal of target ${computedTargets.target_kcal} kcal`,
                    });
                }
                setObj.custom_protein_g = String(Math.round(p * 10) / 10);
                setObj.custom_carbs_g = String(Math.round(c * 10) / 10);
                setObj.custom_fat_g = String(Math.round(f * 10) / 10);
            }
        }

        const insertValues = {
            user_id: userId,
            goal,
            weekly_change_kg: String(signed),
            updated_at: new Date(),
        };
        if ('custom_macros' in req.body) {
            insertValues.custom_protein_g = setObj.custom_protein_g ?? null;
            insertValues.custom_carbs_g = setObj.custom_carbs_g ?? null;
            insertValues.custom_fat_g = setObj.custom_fat_g ?? null;
        }

        await db.insert(userMacroPlan).values(insertValues).onConflictDoUpdate({
            target: userMacroPlan.user_id,
            set: setObj,
        });

        const [row] = await db
            .select()
            .from(userMacroPlan)
            .where(eq(userMacroPlan.user_id, userId))
            .limit(1);

        res.json({
            goal: row.goal,
            weekly_change_kg: Number(row.weekly_change_kg),
            weekly_rate_display_kg:
                row.goal === 'lose'
                    ? Math.abs(Number(row.weekly_change_kg))
                    : row.goal === 'gain'
                      ? Math.abs(Number(row.weekly_change_kg))
                      : 0,
            custom_protein_g: row.custom_protein_g != null ? Number(row.custom_protein_g) : null,
            custom_carbs_g: row.custom_carbs_g != null ? Number(row.custom_carbs_g) : null,
            custom_fat_g: row.custom_fat_g != null ? Number(row.custom_fat_g) : null,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/macros/day?date=
router.get('/day', requireAuth, async (req, res) => {
    try {
        const userId = uid(req);
        const dateStr = req.query.date || new Date().toISOString().slice(0, 10);

        const rows = await db
            .select({
                id: foodLogEntries.id,
                date: foodLogEntries.date,
                grams: foodLogEntries.grams,
                meal_slot: foodLogEntries.meal_slot,
                food_id: foodCatalog.id,
                name: foodCatalog.name,
                kcal_per_100g: foodCatalog.kcal_per_100g,
                protein_per_100g: foodCatalog.protein_per_100g,
                carbs_per_100g: foodCatalog.carbs_per_100g,
                fat_per_100g: foodCatalog.fat_per_100g,
            })
            .from(foodLogEntries)
            .innerJoin(foodCatalog, eq(foodLogEntries.food_catalog_id, foodCatalog.id))
            .where(and(eq(foodLogEntries.user_id, userId), eq(foodLogEntries.date, dateStr)))
            .orderBy(asc(foodLogEntries.id));

        const entries = rows.map((r) => {
            const m = macrosForGrams(
                {
                    kcal_per_100g: r.kcal_per_100g,
                    protein_per_100g: r.protein_per_100g,
                    carbs_per_100g: r.carbs_per_100g,
                    fat_per_100g: r.fat_per_100g,
                },
                r.grams
            );
            return {
                id: r.id,
                food_id: r.food_id,
                meal_slot: r.meal_slot || 'uncategorized',
                name: r.name,
                grams: Number(r.grams),
                ...m,
            };
        });

        const totals = entries.reduce(
            (acc, e) => ({
                kcal: acc.kcal + e.kcal,
                protein_g: acc.protein_g + e.protein_g,
                carbs_g: acc.carbs_g + e.carbs_g,
                fat_g: acc.fat_g + e.fat_g,
            }),
            { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
        );
        totals.protein_g = Math.round(totals.protein_g * 10) / 10;
        totals.carbs_g = Math.round(totals.carbs_g * 10) / 10;
        totals.fat_g = Math.round(totals.fat_g * 10) / 10;

        res.json({ date: dateStr, entries, totals });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/macros/day  { date, food_catalog_id, grams, meal_slot? }
router.post('/day', requireAuth, async (req, res) => {
    try {
        const userId = uid(req);
        const { date, food_catalog_id, grams } = req.body;
        let mealSlot =
            req.body.meal_slot != null ? String(req.body.meal_slot).toLowerCase() : 'uncategorized';
        if (!MEAL_SLOTS.has(mealSlot)) mealSlot = 'uncategorized';

        if (!date) return res.status(400).json({ error: 'date is required' });
        const fid = Number(food_catalog_id);
        const g = Number(grams);
        if (!Number.isFinite(fid) || !Number.isFinite(g) || g <= 0 || g > 5000) {
            return res.status(400).json({ error: 'food_catalog_id and valid grams required' });
        }

        const [food] = await db.select().from(foodCatalog).where(eq(foodCatalog.id, fid)).limit(1);
        if (!food) return res.status(404).json({ error: 'Food not found' });

        const [inserted] = await db
            .insert(foodLogEntries)
            .values({
                user_id: userId,
                date,
                food_catalog_id: fid,
                grams: String(g),
                meal_slot: mealSlot,
            })
            .returning();

        const macros = macrosForGrams(food, g);
        res.status(201).json({
            id: inserted.id,
            date: inserted.date,
            meal_slot: inserted.meal_slot,
            food_id: food.id,
            name: food.name,
            grams: g,
            ...macros,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/v1/macros/entries/:id { meal_slot }
router.patch('/entries/:id', requireAuth, async (req, res) => {
    try {
        const userId = uid(req);
        const id = Number(req.params.id);
        let mealSlot =
            req.body.meal_slot != null ? String(req.body.meal_slot).toLowerCase() : '';
        if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
        if (!MEAL_SLOTS.has(mealSlot)) {
            return res.status(400).json({ error: 'Invalid meal_slot' });
        }

        const [updated] = await db
            .update(foodLogEntries)
            .set({ meal_slot: mealSlot })
            .where(and(eq(foodLogEntries.id, id), eq(foodLogEntries.user_id, userId)))
            .returning({ id: foodLogEntries.id, meal_slot: foodLogEntries.meal_slot });

        if (!updated) return res.status(404).json({ error: 'Entry not found' });
        res.json({ ok: true, ...updated });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/v1/macros/entries/:id
router.delete('/entries/:id', requireAuth, async (req, res) => {
    try {
        const userId = uid(req);
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

        const deleted = await db
            .delete(foodLogEntries)
            .where(and(eq(foodLogEntries.id, id), eq(foodLogEntries.user_id, userId)))
            .returning({ id: foodLogEntries.id });

        if (!deleted.length) {
            return res.status(404).json({ error: 'Entry not found' });
        }
        res.json({ ok: true, id: deleted[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
