/**
 * Looksmax engine: gather a user's signals from the existing tables, reconcile
 * today's XP from what they've already logged, update the streak, compute the
 * score, and unlock achievements. Called on every GET /journey, so the game
 * stays in sync with normal logging without changing any log flow.
 */

import { db } from '../../db.js';
import {
    userProgress, xpEvents, achievements,
    workoutSessions, foodLogEntries, bodyMetrics, weeklyCheckins, userMacroPlan,
} from '../../schema.js';
import { and, asc, desc, eq, gte, inArray } from 'drizzle-orm';
import { computeScore, levelFor, XP } from './score.js';
import { mondayOf, isoDate } from '../weeklyReport/weekRange.js';

const dayStr = (d) => isoDate(d instanceof Date ? d : new Date(d));
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

async function gather(userId) {
    const now = new Date();
    const today = dayStr(now);
    const d7 = dayStr(addDays(now, -7));
    const d28 = dayStr(addDays(now, -28));
    const weekStart = isoDate(mondayOf(now));

    const since7 = addDays(now, -7);
    const [sessions, foods, bodies, checkin, plan] = await Promise.all([
        db.select({ date: workoutSessions.date, endTime: workoutSessions.endTime, is_template: workoutSessions.is_template })
            .from(workoutSessions).where(and(eq(workoutSessions.user_id, userId), gte(workoutSessions.date, since7))),
        db.select({ date: foodLogEntries.date }).from(foodLogEntries).where(and(eq(foodLogEntries.user_id, userId), gte(foodLogEntries.date, d7))),
        db.select({ date: bodyMetrics.date, weight: bodyMetrics.weight_kg }).from(bodyMetrics).where(and(eq(bodyMetrics.user_id, userId), gte(bodyMetrics.date, d28))).orderBy(asc(bodyMetrics.date)),
        db.select({ week_start: weeklyCheckins.week_start }).from(weeklyCheckins).where(and(eq(weeklyCheckins.client_id, userId), eq(weeklyCheckins.week_start, weekStart))).limit(1),
        db.select({ goal: userMacroPlan.goal }).from(userMacroPlan).where(eq(userMacroPlan.user_id, userId)).limit(1),
    ]);

    const trainingDates = new Set(sessions.filter((s) => !s.is_template).map((s) => dayStr(s.date)));
    const foodDates = new Set(foods.map((f) => f.date));
    const bodyDates = new Set(bodies.map((b) => b.date));

    let weightSlope = null;
    if (bodies.length >= 2) {
        const first = bodies[0], last = bodies[bodies.length - 1];
        const days = Math.max(1, (new Date(last.date) - new Date(first.date)) / 86400000);
        weightSlope = ((Number(last.weight) - Number(first.weight)) / days) * 7;
    }

    return {
        today, weekStart,
        trainingDays7: trainingDates.size,
        foodDays7: foodDates.size,
        weighIns28: bodies.length,
        weightSlope,
        goal: plan[0]?.goal || 'lose',
        actions: {
            log_food: foodDates.has(today),
            log_workout: trainingDates.has(today),
            log_weight: bodyDates.has(today),
            checkin: checkin.length > 0,
        },
    };
}

/** Insert XP events for today's completed actions (idempotent), return total + today's awards. */
async function reconcileXp(userId, g) {
    const rows = [];
    if (g.actions.log_food) rows.push({ kind: 'log_food', date: g.today });
    if (g.actions.log_workout) rows.push({ kind: 'log_workout', date: g.today });
    if (g.actions.log_weight) rows.push({ kind: 'log_weight', date: g.today });
    if (g.actions.checkin) rows.push({ kind: 'checkin', date: g.weekStart }); // weekly: once per week
    for (const r of rows) {
        await db.insert(xpEvents).values({ user_id: userId, kind: r.kind, xp: XP[r.kind] || 0, date: r.date })
            .onConflictDoNothing({ target: [xpEvents.user_id, xpEvents.kind, xpEvents.date] });
    }
    const all = await db.select({ xp: xpEvents.xp }).from(xpEvents).where(eq(xpEvents.user_id, userId));
    const total = all.reduce((a, b) => a + (b.xp || 0), 0);
    return total;
}

async function updateStreak(userId, activeToday, today) {
    const [row] = await db.select().from(userProgress).where(eq(userProgress.user_id, userId)).limit(1);
    const yesterday = dayStr(addDays(new Date(today), -1));
    let streak = row?.streak_days || 0;
    let last = row?.last_active_date || null;
    let best = row?.best_streak || 0;

    if (activeToday) {
        if (last === today) { /* already counted */ }
        else if (last === yesterday) streak += 1;
        else streak = 1;
        last = today;
        best = Math.max(best, streak);
    } else if (last !== today && last !== yesterday) {
        streak = 0; // chain broken
    }
    return { streak, best, last, existed: !!row };
}

const ACHIEVEMENTS = {
    first_workout: { label: 'First Rep', desc: 'Logged your first workout', icon: 'ti-barbell' },
    streak_7: { label: '7-Day Lock-In', desc: '7-day streak', icon: 'ti-flame' },
    streak_30: { label: 'Iron Discipline', desc: '30-day streak', icon: 'ti-flame' },
    level_5: { label: 'Ascending', desc: 'Reached level 5', icon: 'ti-stairs-up' },
    chad_reached: { label: 'Chad Status', desc: 'Looksmax score 65+', icon: 'ti-mood-cool' },
    gigachad: { label: 'Gigachad', desc: 'Looksmax score 82+', icon: 'ti-crown' },
    consistent_logger: { label: 'Tracker', desc: 'Logged food 6+ days this week', icon: 'ti-checkbox' },
};

async function unlock(userId, g, score, level, streak) {
    const have = await db.select({ code: achievements.code }).from(achievements).where(eq(achievements.user_id, userId));
    const haveSet = new Set(have.map((h) => h.code));
    const earned = [];
    const award = (code) => { if (!haveSet.has(code)) earned.push(code); };

    if (g.trainingDays7 > 0) award('first_workout');
    if (streak >= 7) award('streak_7');
    if (streak >= 30) award('streak_30');
    if (level >= 5) award('level_5');
    if (score >= 65) award('chad_reached');
    if (score >= 82) award('gigachad');
    if (g.foodDays7 >= 6) award('consistent_logger');

    for (const code of earned) {
        await db.insert(achievements).values({ user_id: userId, code }).onConflictDoNothing({ target: [achievements.user_id, achievements.code] });
    }
    const allCodes = [...haveSet, ...earned];
    return {
        earnedNow: earned.map((c) => ({ code: c, ...ACHIEVEMENTS[c] })),
        all: allCodes.map((c) => ({ code: c, ...ACHIEVEMENTS[c] })).filter((a) => a.label),
    };
}

/** The full journey payload for a user. */
export async function buildJourney(userId) {
    const g = await gather(userId);
    const activeToday = Object.values(g.actions).some(Boolean);

    const totalXp = await reconcileXp(userId, g);
    const { streak, best, last } = await updateStreak(userId, activeToday, g.today);
    const lvl = levelFor(totalXp);
    const scored = computeScore({
        trainingDays7: g.trainingDays7, foodDays7: g.foodDays7, weighIns28: g.weighIns28,
        weightSlope: g.weightSlope, goal: g.goal, streakDays: streak, trainingTarget: 4,
    });
    const ach = await unlock(userId, g, scored.score, lvl.level, streak);

    // persist snapshot
    await db.insert(userProgress).values({
        user_id: userId, xp: totalXp, level: lvl.level, streak_days: streak, best_streak: best,
        last_active_date: last, looksmax_score: scored.score, rank: scored.rank.name, updated_at: new Date(),
    }).onConflictDoUpdate({
        target: userProgress.user_id,
        set: { xp: totalXp, level: lvl.level, streak_days: streak, best_streak: best, last_active_date: last, looksmax_score: scored.score, rank: scored.rank.name, updated_at: new Date() },
    });

    const quests = [
        { key: 'log_workout', label: 'Log a workout', xp: XP.log_workout, done: g.actions.log_workout, icon: 'ti-barbell' },
        { key: 'log_food', label: 'Log a meal', xp: XP.log_food, done: g.actions.log_food, icon: 'ti-salad' },
        { key: 'log_weight', label: 'Log your weight', xp: XP.log_weight, done: g.actions.log_weight, icon: 'ti-scale' },
        { key: 'checkin', label: 'Weekly check-in', xp: XP.checkin, done: g.actions.checkin, icon: 'ti-clipboard-check' },
    ];

    return {
        score: scored.score,
        breakdown: scored.breakdown,
        max: scored.max,
        rank: scored.rank,
        xp: totalXp,
        level: lvl.level,
        level_into: lvl.into,
        level_span: lvl.span,
        level_to_next: lvl.toNext,
        streak,
        best_streak: best,
        active_today: activeToday,
        goal: g.goal,
        signals: { trainingDays7: g.trainingDays7, foodDays7: g.foodDays7, weighIns28: g.weighIns28, weightSlope: g.weightSlope },
        quests,
        achievements: ach.all,
        achievements_unlocked: ach.earnedNow,
    };
}
