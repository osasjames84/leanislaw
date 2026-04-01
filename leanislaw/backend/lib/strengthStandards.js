/**
 * Bodyweight-relative strength tiers. Ratio = lift_lb / bodyweight_lb.
 *
 * Bench / squat / hinge breakpoints (× bodyweight), product table:
 *   Bench:   Beginner 0.5 → Novice 0.75 → Intermediate 1.0 → Advanced 1.5 → Elite 2.0
 *   Squat:   0.75 → 1.25 → 1.75 → 2.25 → 3.0
 *   Hinge:   1.0 → 1.5 → 2.0 → 2.5 → 3.0
 */

const ORDER = ['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Elite'];

function ratioFromLb(liftLb, bodyweightLb) {
    const bw = Number(bodyweightLb);
    const lift = Number(liftLb);
    if (!Number.isFinite(bw) || bw <= 0 || !Number.isFinite(lift) || lift <= 0) return null;
    return lift / bw;
}

/** @param {number} r */
export function classifyBenchRatio(r) {
    if (!Number.isFinite(r) || r <= 0) return 'Beginner';
    if (r < 0.75) return 'Beginner';
    if (r < 1.0) return 'Novice';
    if (r < 1.5) return 'Intermediate';
    if (r < 2.0) return 'Advanced';
    return 'Elite';
}

/** @param {number} r */
export function classifySquatRatio(r) {
    if (!Number.isFinite(r) || r <= 0) return 'Beginner';
    if (r < 0.75) return 'Beginner';
    if (r < 1.25) return 'Novice';
    if (r < 1.75) return 'Intermediate';
    if (r < 3.0) return 'Advanced';
    return 'Elite';
}

/** @param {number} r */
export function classifyHingeRatio(r) {
    if (!Number.isFinite(r) || r <= 0) return 'Beginner';
    if (r < 1.0) return 'Beginner';
    if (r < 1.5) return 'Novice';
    if (r < 2.0) return 'Intermediate';
    if (r < 3.0) return 'Advanced';
    return 'Elite';
}

/** @deprecated Use classifyBenchRatio / variant-specific helpers; kept for any external imports */
export function classifyLift(variant, ratio) {
    const r = Number(ratio);
    if (variant === 'squat') return classifySquatRatio(r);
    if (variant === 'hinge') return classifyHingeRatio(r);
    return classifyBenchRatio(r);
}

export function classifyBench(benchLb, bodyweightLb) {
    const r = ratioFromLb(benchLb, bodyweightLb);
    if (r == null) return 'Beginner';
    return classifyBenchRatio(r);
}

export function classifySquat(squatLb, bodyweightLb) {
    const r = ratioFromLb(squatLb, bodyweightLb);
    if (r == null) return 'Beginner';
    return classifySquatRatio(r);
}

export function classifyHinge(hingeLb, bodyweightLb) {
    const r = ratioFromLb(hingeLb, bodyweightLb);
    if (r == null) return 'Beginner';
    return classifyHingeRatio(r);
}

export function levelToScore(level) {
    const i = ORDER.indexOf(level);
    return i >= 0 ? i + 1 : 1;
}

export function scoreToLevel(avgScore) {
    const idx = Math.min(ORDER.length - 1, Math.max(0, Math.round(avgScore) - 1));
    return ORDER[idx];
}

/** Average of bench/squat/hinge classifications → overall label. */
export function overallStrengthLevel(benchLevel, squatLevel, hingeLevel) {
    const s = (levelToScore(benchLevel) + levelToScore(squatLevel) + levelToScore(hingeLevel)) / 3;
    return scoreToLevel(s);
}

/** Monthly realistic LBM gain cap (lb/month) from overall level. */
export function monthlyLbmCapLb(overallLevel) {
    const map = {
        Beginner: 2.0,
        Novice: 1.75,
        Intermediate: 1.125,
        Advanced: 0.75,
        Elite: 0.25,
    };
    return map[overallLevel] ?? 1;
}
