/**
 * Build the engine's normalized weekly bundle (shape = reports/sample_data.json)
 * for one coach and one week, straight from the real app DB. This is the only
 * place that knows the app's tables; everything downstream is the unchanged
 * Python engine. See backend/docs/weekly-report-mapping.md.
 */

import { db } from '../../db.js';
import {
    users,
    coachClients,
    workoutSessions,
    exerciseLog,
    foodLogEntries,
    foodCatalog,
    bodyMetrics,
    dailyTdeeInputs,
    daily_logs,
    userMacroPlan,
    userTdeeState,
    weeklyCheckins,
    assignedWorkouts,
} from '../../schema.js';
import { and, asc, eq, gte, inArray, lte, lt } from 'drizzle-orm';
import { computeMacroTargets, macrosForGrams } from '../macroEngine.js';
import { dayAbbr } from './weekRange.js';

const GOAL_LABEL = { lose: 'Fat loss', gain: 'Muscle gain', maintain: 'Maintenance' };

function round1(x) {
    return Math.round(Number(x) * 10) / 10;
}

async function maintenanceKcal(clientId) {
    const [met] = await db
        .select()
        .from(userTdeeState)
        .where(eq(userTdeeState.user_id, clientId))
        .limit(1);
    if (!met) return null;
    const ema = met.ema_tdee != null ? Number(met.ema_tdee) : null;
    const v = Number.isFinite(ema) && ema > 0 ? ema : Number(met.baseline_tdee);
    return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
}

async function latestWeightKg(clientId, onOrBefore) {
    const rows = await db
        .select({ weight_kg: bodyMetrics.weight_kg })
        .from(bodyMetrics)
        .where(and(eq(bodyMetrics.user_id, clientId), lte(bodyMetrics.date, onOrBefore)))
        .orderBy(asc(bodyMetrics.date));
    if (!rows.length) return null;
    const w = Number(rows[rows.length - 1].weight_kg);
    return Number.isFinite(w) && w > 0 ? w : null;
}

/** Reuse the live /macros/plan math so report targets match what the client sees. */
async function nutritionTargets(clientId, weekEnd) {
    const maint = await maintenanceKcal(clientId);
    const weightKg = await latestWeightKg(clientId, weekEnd);
    const [plan] = await db
        .select()
        .from(userMacroPlan)
        .where(eq(userMacroPlan.user_id, clientId))
        .limit(1);
    const goal = plan?.goal ?? 'maintain';
    const weeklySigned = plan != null ? Number(plan.weekly_change_kg) : 0;
    let targets = null;
    if (maint != null && weightKg != null) {
        targets = computeMacroTargets({
            maintenanceKcal: maint,
            weeklyChangeKg: weeklySigned,
            weightKg,
            goal,
        });
    }
    return { goal, targets };
}

async function trainingSection(clientId, week, assigned) {
    const rows = await db
        .select()
        .from(workoutSessions)
        .where(
            and(
                eq(workoutSessions.user_id, clientId),
                eq(workoutSessions.is_template, false),
                gte(workoutSessions.date, week.startDate),
                lt(workoutSessions.date, week.endExclusive)
            )
        )
        .orderBy(asc(workoutSessions.date));

    // A session counts as completed if it was finished (end_time) or has logged sets.
    const ids = rows.map((r) => r.id);
    const loggedSessionIds = new Set();
    if (ids.length) {
        const logs = await db
            .select({ sid: exerciseLog.workoutSessionsId })
            .from(exerciseLog)
            .where(inArray(exerciseLog.workoutSessionsId, ids));
        for (const l of logs) loggedSessionIds.add(l.sid);
    }

    const sessions = rows.map((r) => ({
        day: dayAbbr(r.date),
        name: r.name,
        completed: r.endTime != null || loggedSessionIds.has(r.id),
    }));
    const loggedCompleted = sessions.filter((s) => s.completed).length;
    const notes = rows
        .map((r) => (r.notes || '').trim())
        .filter(Boolean)
        .join(' · ');

    // When the coach has assigned a plan for this week, that plan is the source of
    // truth for adherence: denominator = assigned count, numerator = those the
    // client marked done (or that have a logged session). Otherwise fall back to
    // the static weekly_training_target denominator.
    const plan = await db
        .select({ status: assignedWorkouts.status })
        .from(assignedWorkouts)
        .where(
            and(
                eq(assignedWorkouts.client_id, clientId),
                gte(assignedWorkouts.scheduled_date, week.weekStart),
                lte(assignedWorkouts.scheduled_date, week.weekEnd)
            )
        );
    if (plan.length) {
        const planCompleted = plan.filter((p) => p.status === 'completed').length;
        return {
            assigned: plan.length,
            completed: Math.max(planCompleted, Math.min(loggedCompleted, plan.length)),
            sessions,
            notes,
        };
    }

    return { assigned, completed: loggedCompleted, sessions, notes };
}

async function nutritionSection(clientId, week, targets) {
    const rows = await db
        .select({
            date: foodLogEntries.date,
            grams: foodLogEntries.grams,
            kcal_per_100g: foodCatalog.kcal_per_100g,
            protein_per_100g: foodCatalog.protein_per_100g,
            carbs_per_100g: foodCatalog.carbs_per_100g,
            fat_per_100g: foodCatalog.fat_per_100g,
        })
        .from(foodLogEntries)
        .innerJoin(foodCatalog, eq(foodLogEntries.food_catalog_id, foodCatalog.id))
        .where(
            and(
                eq(foodLogEntries.user_id, clientId),
                gte(foodLogEntries.date, week.weekStart),
                lte(foodLogEntries.date, week.weekEnd)
            )
        );

    const byDate = new Map();
    for (const r of rows) {
        const m = macrosForGrams(r, r.grams);
        const acc = byDate.get(r.date) || { calories: 0, protein_g: 0 };
        acc.calories += m.kcal;
        acc.protein_g += m.protein_g;
        byDate.set(r.date, acc);
    }

    const targetProtein = targets?.protein_g ?? null;
    const days = [...byDate.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([date, v]) => ({
            date,
            calories: Math.round(v.calories),
            protein_g: round1(v.protein_g),
            hit_protein: targetProtein != null ? v.protein_g >= targetProtein : false,
        }));

    return {
        target_calories: targets?.target_kcal ?? null,
        target_protein_g: targetProtein,
        target_days: 7,
        logged_days: days.length,
        days,
    };
}

async function bodySection(clientId, week) {
    const rows = await db
        .select()
        .from(bodyMetrics)
        .where(
            and(
                eq(bodyMetrics.user_id, clientId),
                gte(bodyMetrics.date, week.weekStart),
                lte(bodyMetrics.date, week.weekEnd)
            )
        )
        .orderBy(asc(bodyMetrics.date));

    const weight_series = rows.map((r) => ({ date: r.date, weight: Number(r.weight_kg) }));
    const measurements = {};
    for (const r of rows) {
        if (r.body_fat_pct != null) measurements.body_fat_pct = Number(r.body_fat_pct);
    }
    return { unit: 'kg', weight_series, measurements };
}

async function avgSteps(clientId, week) {
    const stepByDate = new Map();
    const add = (date, steps) => {
        const s = Number(steps);
        if (!Number.isFinite(s) || s <= 0) return;
        stepByDate.set(date, Math.max(stepByDate.get(date) || 0, s));
    };
    const tdeeRows = await db
        .select({ date: dailyTdeeInputs.date, steps: dailyTdeeInputs.steps })
        .from(dailyTdeeInputs)
        .where(
            and(
                eq(dailyTdeeInputs.user_id, clientId),
                gte(dailyTdeeInputs.date, week.weekStart),
                lte(dailyTdeeInputs.date, week.weekEnd)
            )
        );
    for (const r of tdeeRows) add(r.date, r.steps);
    const logRows = await db
        .select({ date: daily_logs.date, steps: daily_logs.steps })
        .from(daily_logs)
        .where(
            and(
                eq(daily_logs.userId, clientId),
                gte(daily_logs.date, week.weekStart),
                lte(daily_logs.date, week.weekEnd)
            )
        );
    for (const r of logRows) add(r.date, r.steps);

    if (!stepByDate.size) return null;
    const total = [...stepByDate.values()].reduce((a, b) => a + b, 0);
    return Math.round(total / stepByDate.size);
}

async function checkinSection(clientId, week) {
    const [ci] = await db
        .select()
        .from(weeklyCheckins)
        .where(
            and(eq(weeklyCheckins.client_id, clientId), eq(weeklyCheckins.week_start, week.weekStart))
        )
        .limit(1);
    const steps_avg = await avgSteps(clientId, week);
    if (!ci) {
        return {
            submitted: false,
            sleep_h: null,
            energy_1to5: null,
            stress_1to5: null,
            steps_avg,
            notes: '',
        };
    }
    return {
        submitted: true,
        sleep_h: ci.sleep_h != null ? Number(ci.sleep_h) : null,
        energy_1to5: ci.energy_1to5 != null ? Number(ci.energy_1to5) : null,
        stress_1to5: ci.stress_1to5 != null ? Number(ci.stress_1to5) : null,
        steps_avg,
        notes: ci.notes || '',
    };
}

async function buildClient(link, week) {
    const clientId = link.client_id;
    const { goal, targets } = await nutritionTargets(clientId, week.weekEnd);
    const [training, nutrition, body, checkin] = await Promise.all([
        trainingSection(clientId, week, link.weekly_training_target),
        nutritionSection(clientId, week, targets),
        bodySection(clientId, week),
        checkinSection(clientId, week),
    ]);
    return {
        id: clientId,
        name: `${link.first_name} ${link.last_name}`.trim(),
        goal: GOAL_LABEL[goal] || 'Maintenance',
        training,
        nutrition,
        body,
        checkin,
    };
}

/** Build the full weekly bundle for a coach. `week` = resolveWeek(...) output. */
export async function buildWeeklyBundle(coachId, week) {
    const [coach] = await db
        .select({ first_name: users.first_name, last_name: users.last_name })
        .from(users)
        .where(eq(users.id, coachId))
        .limit(1);
    const coachName = coach ? `${coach.first_name} ${coach.last_name}`.trim() : 'Coach';

    const links = await db
        .select({
            client_id: coachClients.client_id,
            weekly_training_target: coachClients.weekly_training_target,
            first_name: users.first_name,
            last_name: users.last_name,
        })
        .from(coachClients)
        .innerJoin(users, eq(users.id, coachClients.client_id))
        .where(and(eq(coachClients.coach_id, coachId), eq(coachClients.status, 'active')))
        .orderBy(asc(users.first_name));

    const clients = [];
    for (const link of links) {
        clients.push(await buildClient(link, week));
    }

    return {
        coach: coachName,
        week_start: week.weekStart,
        week_end: week.weekEnd,
        clients,
    };
}
