/**
 * Exercise progression engine. Given a client's exercise logs (joined to session
 * date + exercise name), compute per-exercise week-over-week strength: best set,
 * estimated 1RM (Epley), and total volume — plus a progressive-overload hint.
 *
 * This is the deterministic layer; an AI overview can narrate on top of it later.
 */

import { mondayOf, isoDate } from './weekRange.js';

const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Epley estimated 1RM. */
function e1rm(weight, reps) {
    if (weight <= 0 || reps <= 0) return 0;
    return weight * (1 + reps / 30);
}

/** Working sets from a log row: prefer the sets[] array, fall back to top-level. */
function workingSets(log) {
    const out = [];
    const sets = Array.isArray(log.sets) ? log.sets : [];
    for (const s of sets) {
        const w = num(s?.weight);
        const r = num(s?.reps);
        if (w > 0 && r > 0) out.push({ w, r });
    }
    if (!out.length) {
        const w = num(log.weight);
        const r = num(log.reps);
        if (w > 0 && r > 0) out.push({ w, r });
    }
    return out;
}

/**
 * @param {Array<{exercise:string, body_part:string, date:string|Date, sets:any, reps:any, weight:any}>} logs
 * @returns {Array} per-exercise progression, most recently trained first.
 */
export function computeProgression(logs, { minWeeks = 1 } = {}) {
    // exercise -> weekKey -> { bestE1rm, topW, topReps, volume }
    const byExercise = new Map();

    for (const log of logs) {
        const sets = workingSets(log);
        if (!sets.length) continue;
        const wk = isoDate(mondayOf(log.date instanceof Date ? log.date : new Date(log.date)));
        const name = log.exercise || 'Exercise';
        if (!byExercise.has(name)) byExercise.set(name, { body_part: log.body_part, weeks: new Map() });
        const ex = byExercise.get(name);
        const cur = ex.weeks.get(wk) || { bestE1rm: 0, topW: 0, topReps: 0, volume: 0 };
        for (const s of sets) {
            const est = e1rm(s.w, s.r);
            if (est > cur.bestE1rm) {
                cur.bestE1rm = est;
                cur.topW = s.w;
                cur.topReps = s.r;
            }
            cur.volume += s.w * s.r;
        }
        ex.weeks.set(wk, cur);
    }

    const result = [];
    for (const [name, ex] of byExercise) {
        const weeks = [...ex.weeks.entries()]
            .sort((a, b) => (a[0] < b[0] ? -1 : 1))
            .map(([week, v]) => ({
                week,
                est_1rm: Math.round(v.bestE1rm),
                top_weight: Math.round(v.topW * 10) / 10,
                top_reps: v.topReps,
                volume: Math.round(v.volume),
            }));
        if (weeks.length < minWeeks) continue;
        const latest = weeks[weeks.length - 1];
        const prev = weeks.length > 1 ? weeks[weeks.length - 2] : null;
        const delta_1rm = prev ? latest.est_1rm - prev.est_1rm : null;
        const delta_volume = prev ? latest.volume - prev.volume : null;

        let suggestion;
        if (latest.top_reps >= 12) {
            suggestion = `Hit ${latest.top_reps} reps at ${latest.top_weight}kg — increase load ~5–10%.`;
        } else if (delta_1rm != null && delta_1rm > 0) {
            suggestion = `Progressing (+${delta_1rm} est. 1RM) — keep the current load.`;
        } else if (delta_1rm != null && delta_1rm < 0) {
            suggestion = `Down ${delta_1rm} est. 1RM vs last week — check recovery before adding load.`;
        } else {
            suggestion = `Aim to add a rep or small load this week.`;
        }

        result.push({
            exercise: name,
            body_part: ex.body_part,
            weeks,
            latest,
            prev,
            delta_1rm,
            delta_volume,
            suggestion,
            last_trained: latest.week,
        });
    }

    result.sort((a, b) => (a.last_trained < b.last_trained ? 1 : a.last_trained > b.last_trained ? -1 : b.latest.volume - a.latest.volume));
    return result;
}
