/**
 * The Looksmax Score (0–100) + rank ladder. Pure functions: the engine gathers
 * the raw signals from existing tables and passes them in. The score fuses the
 * four things that actually drive a recomp — training, nutrition, body trend,
 * and consistency — into one number with a Sub-5 → GODCHAD rank.
 */

// Weighting (max points per pillar): training 35, nutrition 30, body 20, consistency 15.
export const PILLARS = { training: 35, nutrition: 30, body: 20, consistency: 15 };

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** Sub-5 → GODCHAD ladder. Themed to the looksmaxing/ascension brand. */
export function rankFor(score) {
    const ladder = [
        { min: 0, name: 'Sub-5', tier: 0, blurb: 'The grind begins.' },
        { min: 25, name: 'Normie', tier: 1, blurb: 'Out of the gutter. Keep stacking days.' },
        { min: 45, name: 'Chadlite', tier: 2, blurb: 'Momentum is real. Don’t break the chain.' },
        { min: 65, name: 'Chad', tier: 3, blurb: 'Locked in. People are noticing.' },
        { min: 82, name: 'Gigachad', tier: 4, blurb: 'Elite consistency. Mogging in progress.' },
        { min: 93, name: 'GODCHAD', tier: 5, blurb: 'Ascended. Protect the streak at all costs.' },
    ];
    let cur = ladder[0];
    for (const r of ladder) if (score >= r.min) cur = r;
    const next = ladder.find((r) => r.min > score) || null;
    return { ...cur, next: next ? { name: next.name, at: next.min } : null };
}

/**
 * @param {object} s raw signals
 *   trainingDays7  - distinct days trained in last 7
 *   trainingTarget - weekly training target (default 4)
 *   foodDays7      - distinct days food logged in last 7
 *   proteinDays7   - days protein target hit in last 7 (optional)
 *   weighIns28     - body-metric entries in last 28 days
 *   weightSlope    - kg/week trend (negative = losing)
 *   goal           - 'lose' | 'gain' | 'maintain'
 *   streakDays     - current daily streak
 */
export function computeScore(s) {
    const target = s.trainingTarget && s.trainingTarget > 0 ? s.trainingTarget : 4;

    // Training: trained days vs target.
    const training = Math.round(clamp((s.trainingDays7 || 0) / target, 0, 1) * PILLARS.training);

    // Nutrition: logging consistency (up to 20) + protein hit bonus (up to 10).
    const logScore = clamp((s.foodDays7 || 0) / 7, 0, 1) * 20;
    const proteinScore = s.proteinDays7 != null ? clamp(s.proteinDays7 / 7, 0, 1) * 10 : clamp((s.foodDays7 || 0) / 7, 0, 1) * 10;
    const nutrition = Math.round(logScore + proteinScore);

    // Body: tracking consistency (up to 10) + trend toward goal (up to 10).
    const trackScore = clamp((s.weighIns28 || 0) / 8, 0, 1) * 10;
    let trendScore = 5; // neutral baseline when we can't tell
    if (s.weightSlope != null && Number.isFinite(s.weightSlope)) {
        const sl = s.weightSlope;
        if (s.goal === 'gain') trendScore = sl > 0.05 ? 10 : sl > -0.1 ? 6 : 2;
        else if (s.goal === 'lose') trendScore = sl < -0.05 ? 10 : sl < 0.1 ? 6 : 2;
        else trendScore = Math.abs(sl) < 0.15 ? 10 : 5;
    }
    const body = Math.round(trackScore + (s.weighIns28 ? trendScore : 0));

    // Consistency: streak.
    const consistency = Math.round(clamp((s.streakDays || 0) / 14, 0, 1) * PILLARS.consistency);

    const score = clamp(training + nutrition + body + consistency, 0, 100);
    return {
        score,
        breakdown: { training, nutrition, body, consistency },
        max: PILLARS,
        rank: rankFor(score),
    };
}

/** XP for a daily action kind. */
export const XP = { log_food: 15, log_workout: 40, log_weight: 10, checkin: 30, hit_protein: 20 };

/** Level curve: 500 XP per level. */
export function levelFor(xp) {
    const per = 500;
    const level = Math.floor((xp || 0) / per) + 1;
    const intoLevel = (xp || 0) % per;
    return { level, into: intoLevel, span: per, toNext: per - intoLevel };
}
