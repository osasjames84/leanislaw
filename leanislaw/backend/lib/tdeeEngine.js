/**
 * TDEE: weight is stored in kg in the DB; BMR uses tissue masses in pounds, then
 *   BMR (kcal/day) = 12 * LBM_lb + 2 * FM_lb
 * TDEE = BMR * (NEAT_mult + exercise_mult + TEF)
 * TEF = 0.1 (always on).
 */

const LBS_PER_KG = 2.2046226218;

export function computeLbmFm(weightKg, bodyFatPct) {
    const t = computeTissueFromWeightKg(weightKg, bodyFatPct);
    return { lbmKg: t.lbmKg, fmKg: t.fmKg };
}

/** Total weight (kg) → LBM/FM in lb and kg. */
export function computeTissueFromWeightKg(weightKg, bodyFatPct) {
    const w = Number(weightKg);
    const bf = Number(bodyFatPct);
    if (!Number.isFinite(w) || w <= 0) throw new Error('Invalid weight');
    if (!Number.isFinite(bf) || bf < 0 || bf > 100) throw new Error('Body fat % must be between 0 and 100');

    const weightLb = w * LBS_PER_KG;
    const fmLb = weightLb * (bf / 100);
    const lbmLb = weightLb - fmLb;
    const lbmKg = lbmLb / LBS_PER_KG;
    const fmKg = fmLb / LBS_PER_KG;

    return { weightLb, lbmLb, fmLb, lbmKg, fmKg };
}

/** Lyle-style BMR with coefficients applied to pound-mass of LBM and FM. */
export function bmrLyleFromLb(lbmLb, fmLb) {
    return 12 * lbmLb + 2 * fmLb;
}

export function stepsToNeatMultiplier(steps) {
    const s = Math.max(0, Math.floor(Number(steps) || 0));
    if (s < 5000) return 1.1;
    if (s < 10000) return 1.15;
    if (s < 15000) return 1.2;
    if (s < 20000) return 1.25;
    return 1.3;
}

const WL_RATE = { low: 0.1, moderate: 0.15, high: 0.2 };
const CARDIO_RATE = { low: 0.2, moderate: 0.3, high: 0.4 };

export function exerciseMultiplierFromActivities(activities) {
    if (!Array.isArray(activities)) return 0;
    let sum = 0;
    for (const a of activities) {
        const h = Math.max(0, Number(a.hours) || 0);
        if (h <= 0) continue;
        const intensity = a.intensity === 'low' || a.intensity === 'high' ? a.intensity : 'moderate';
        if (a.type === 'weightlifting') {
            sum += (WL_RATE[intensity] ?? 0.15) * h;
        } else if (a.type === 'cardio') {
            sum += (CARDIO_RATE[intensity] ?? 0.3) * h;
        }
    }
    return sum;
}

const TEF = 0.1;

export function computeTdeeBreakdown({ weightKg, bodyFatPct, steps, activities }) {
    const { lbmLb, fmLb, lbmKg, fmKg } = computeTissueFromWeightKg(weightKg, bodyFatPct);
    const bmr = bmrLyleFromLb(lbmLb, fmLb);
    const neatMultiplier = stepsToNeatMultiplier(steps);
    const exerciseMultiplier = exerciseMultiplierFromActivities(activities);
    const totalMultiplier = neatMultiplier + exerciseMultiplier + TEF;
    const tdee = bmr * totalMultiplier;
    return {
        lbmKg,
        fmKg,
        lbmLb: Math.round(lbmLb * 10) / 10,
        fmLb: Math.round(fmLb * 10) / 10,
        bmr: Math.round(bmr * 10) / 10,
        neatMultiplier,
        exerciseMultiplier: Math.round(exerciseMultiplier * 1000) / 1000,
        tef: TEF,
        totalMultiplier: Math.round(totalMultiplier * 1000) / 1000,
        tdee: Math.round(tdee),
    };
}
