export const UNIT_KEY = "leanislaw_unit_system";
export const FOOD_UNIT_KEY = "leanislaw_food_unit_system";
export const LBS_PER_KG = 2.2046226218;
export const KG_PER_LB = 0.45359237;
/** US nutrition / food portions */
export const GRAMS_PER_OZ = 28.349523125;
export const ML_PER_US_FLOZ = 29.5735295625;

export function readStoredUnits() {
    try {
        return localStorage.getItem(UNIT_KEY) === "imperial" ? "imperial" : "metric";
    } catch {
        return "metric";
    }
}

/** Food portion display unit: grams (metric) or ounces (imperial). */
export function readStoredFoodUnit() {
    try {
        return localStorage.getItem(FOOD_UNIT_KEY) === "imperial" ? "imperial" : "metric";
    } catch {
        return "metric";
    }
}

/** Body / TDEE weight (stored as kg on server). */
export function kgToDisplayWeight(kg, units) {
    const n = Number(kg);
    if (!Number.isFinite(n)) return "";
    return units === "imperial" ? (n * LBS_PER_KG).toFixed(1) : String(Math.round(n * 100) / 100);
}

export function displayWeightToKg(value, units) {
    const n = parseFloat(String(value).replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return null;
    return units === "imperial" ? n * KG_PER_LB : n;
}

/** Exercise set weight: API stores kg; inputs show in chosen units. */
export function formatExerciseWeightKg(kgStr, units) {
    if (kgStr === "" || kgStr == null) return "";
    const kg = parseFloat(String(kgStr).replace(",", "."));
    if (!Number.isFinite(kg)) return "";
    if (units === "imperial") return (kg * LBS_PER_KG).toFixed(1);
    return String(Math.round(kg * 100) / 100);
}

export function parseExerciseWeightToKg(displayStr, units) {
    if (displayStr === "" || displayStr == null) return "";
    const n = parseFloat(String(displayStr).replace(",", "."));
    if (!Number.isFinite(n)) return "";
    if (units === "imperial") return String(Math.round(n * KG_PER_LB * 100) / 100);
    return String(Math.round(n * 100) / 100);
}

/** Food portions: API always uses grams. */
export function formatFoodGrams(grams, units) {
    const g = Number(grams);
    if (!Number.isFinite(g)) return "";
    if (units === "imperial") {
        const oz = g / GRAMS_PER_OZ;
        const rounded = oz >= 10 ? Math.round(oz * 10) / 10 : Math.round(oz * 100) / 100;
        return `${rounded} oz`;
    }
    const rounded = g >= 100 ? Math.round(g) : Math.round(g * 10) / 10;
    return `${rounded} g`;
}

/**
 * Format a signed body-weight delta where the API value is in pounds.
 * Example: +1.1 lb → "+0.5 kg" when metric.
 */
export function formatSignedDeltaLb(lbDelta, units) {
    const n = Number(lbDelta);
    if (!Number.isFinite(n)) return "—";
    const sign = n > 0 ? "+" : n < 0 ? "−" : "";
    const absLb = Math.abs(n);
    if (units === "imperial") return `${sign}${Math.round(absLb * 100) / 100} lb`;
    const kg = absLb * KG_PER_LB;
    return `${sign}${Math.round(kg * 100) / 100} kg`;
}
