/**
 * Dynamic TDEE from logged intake (EMA) adjusted by bodyweight trend.
 * ~7700 kcal ≈ 1 kg tissue energy; daily imbalance ≈ Δkg/day * 7700.
 */

const ALPHA_INTAKE = 0.15;
const ALPHA_TDEE = 0.12;
const KCAL_PER_KG_DAY = 7700;

function parseDateMs(d) {
    if (!d) return NaN;
    const s = typeof d === 'string' ? d : d.toString();
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : NaN;
}

/** EMA over series (most recent last). */
export function emaSeries(values, alpha) {
    if (!values.length) return null;
    let e = Number(values[0]) || 0;
    for (let i = 1; i < values.length; i++) {
        const v = Number(values[i]) || 0;
        e = alpha * v + (1 - alpha) * e;
    }
    return e;
}

/**
 * bodyRows: [{ date: 'YYYY-MM-DD', weight_kg: number|string }] ascending by date
 * Returns approximate Δkg per day (linear slope over window).
 */
export function weightSlopeKgPerDay(bodyRows, windowDays = 21) {
    const rows = [...bodyRows]
        .map((r) => ({
            t: parseDateMs(r.date),
            kg: Number(r.weight_kg),
        }))
        .filter((r) => Number.isFinite(r.t) && Number.isFinite(r.kg) && r.kg > 0)
        .sort((a, b) => a.t - b.t);

    if (rows.length < 3) return 0;

    const last = rows[rows.length - 1];
    const cutoff = last.t - windowDays * 86400000;
    const win = rows.filter((r) => r.t >= cutoff);
    if (win.length < 2) return 0;

    const first = win[0];
    const lastPt = win[win.length - 1];
    const daySpan = Math.max(1, (lastPt.t - first.t) / 86400000);
    return (lastPt.kg - first.kg) / daySpan;
}

/**
 * calorieLogs: [{ calories: number|null }] in chronological order (by day), nulls skipped
 */
export function nextEmaIntake(prevEma, dayCalories, alpha = ALPHA_INTAKE) {
    const c = Number(dayCalories);
    if (!Number.isFinite(c) || c <= 0) return prevEma;
    if (prevEma == null || !Number.isFinite(Number(prevEma))) return c;
    return alpha * c + (1 - alpha) * Number(prevEma);
}

/**
 * implied maintenance from intake and weight change rate
 */
export function impliedTdeeFromIntakeAndSlope(emaIntake, slopeKgPerDay) {
    const intake = Number(emaIntake);
    if (!Number.isFinite(intake) || intake <= 0) return null;
    const s = Number(slopeKgPerDay) || 0;
    const adj = s * KCAL_PER_KG_DAY;
    return intake - adj;
}

export function nextEmaTdee(prevEmaTdee, candidateTdee, baselineTdee, alpha = ALPHA_TDEE) {
    const cand = Number(candidateTdee);
    const base = Number(baselineTdee);
    if (!Number.isFinite(cand) || cand <= 0) {
        return Number.isFinite(Number(prevEmaTdee)) && Number(prevEmaTdee) > 0 ? Number(prevEmaTdee) : base;
    }
    let prev = Number(prevEmaTdee);
    if (!Number.isFinite(prev) || prev <= 0) prev = base;
    const blended = alpha * cand + (1 - alpha) * prev;
    // Soft anchor: never drift more than ±40% from baseline in one step is handled by EMA; clamp hard outliers
    const low = base * 0.65;
    const high = base * 1.45;
    return Math.min(high, Math.max(low, blended));
}

export { ALPHA_INTAKE, ALPHA_TDEE, KCAL_PER_KG_DAY };
