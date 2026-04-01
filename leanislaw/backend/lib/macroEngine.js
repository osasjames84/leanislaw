/**
 * Macro targets from maintenance energy, body mass, goal, and intended weekly weight change.
 * Uses ~7700 kcal ≈ 1 kg adipose for daily calorie offset.
 */

/** Daily kcal adjustment from signed weekly kg change (e.g. -0.5 kg/wk → deficit). */
export function dailyKcalFromWeeklyChangeKg(weeklyChangeKg) {
    return (Number(weeklyChangeKg) * 7700) / 7;
}

/**
 * @param {{ maintenanceKcal: number, weeklyChangeKg: number, weightKg: number, goal: string }} p
 */
export function computeMacroTargets({ maintenanceKcal, weeklyChangeKg, weightKg, goal }) {
    const w = Number(weightKg);
    const maint = Number(maintenanceKcal);
    if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(maint) || maint < 800) {
        return null;
    }

    const delta = dailyKcalFromWeeklyChangeKg(Number(weeklyChangeKg));
    let targetKcal = Math.round(maint + delta);
    targetKcal = Math.max(1200, Math.min(12000, targetKcal));

    const g = goal === 'lose' ? 'lose' : goal === 'gain' ? 'gain' : 'maintain';
    const proteinPerKg = g === 'lose' ? 2.2 : g === 'gain' ? 1.7 : 1.8;
    const proteinG = Math.round(w * proteinPerKg);
    const proteinKcal = proteinG * 4;

    let fatG = Math.round((targetKcal * 0.28) / 9);
    let carbKcal = targetKcal - proteinKcal - fatG * 9;
    if (carbKcal < 120) {
        fatG = Math.round((targetKcal * 0.22) / 9);
        carbKcal = targetKcal - proteinKcal - fatG * 9;
    }
    const carbG = Math.max(0, Math.round(carbKcal / 4));

    return {
        target_kcal: targetKcal,
        protein_g: proteinG,
        carbs_g: carbG,
        fat_g: fatG,
        maintenance_kcal: Math.round(maint),
        daily_energy_delta_kcal: Math.round(delta),
    };
}

/** Max |4P+4C+9F − target_kcal| allowed when saving custom macros */
export const MACRO_KCAL_TOLERANCE = 22;

export function kcalFromMacroGrams(proteinG, carbsG, fatG) {
    return 4 * Number(proteinG) + 4 * Number(carbsG) + 9 * Number(fatG);
}

export function customMacrosMatchTarget(targetKcal, proteinG, carbsG, fatG, tol = MACRO_KCAL_TOLERANCE) {
    const t = Number(targetKcal);
    if (!Number.isFinite(t) || t <= 0) return false;
    const k = kcalFromMacroGrams(proteinG, carbsG, fatG);
    return Math.abs(k - t) <= tol;
}

/**
 * Build integer gram targets from calorie % split (sum of percents ≈ 100).
 * Residual kcal nudged into carbs so total stays near targetKcal.
 */
export function macrosFromCaloriePercents(targetKcal, proteinPct, carbsPct, fatPct) {
    const T = Math.round(Number(targetKcal));
    if (!Number.isFinite(T) || T < 800) {
        return { protein_g: 0, carbs_g: 0, fat_g: 0 };
    }
    const pPct = Number(proteinPct);
    const cPct = Number(carbsPct);
    const fPct = Number(fatPct);
    const s = pPct + cPct + fPct;
    const norm = s > 0 ? s / 100 : 1;
    const pK = (T * pPct) / norm;
    const cK = (T * cPct) / norm;
    const fK = (T * fPct) / norm;
    let protein_g = Math.max(0, Math.round(pK / 4));
    let fat_g = Math.max(0, Math.round(fK / 9));
    let rem = T - 4 * protein_g - 9 * fat_g;
    let carbs_g = Math.max(0, Math.round(rem / 4));
    rem = T - kcalFromMacroGrams(protein_g, carbs_g, fat_g);
    if (rem !== 0) {
        carbs_g = Math.max(0, carbs_g + Math.round(rem / 4));
    }
    rem = T - kcalFromMacroGrams(protein_g, carbs_g, fat_g);
    if (Math.abs(rem) >= 2) {
        protein_g = Math.max(0, protein_g + Math.round(rem / 4));
    }
    return {
        protein_g,
        carbs_g: Math.max(0, carbs_g),
        fat_g: Math.max(0, fat_g),
    };
}

export function macrosForGrams(food, grams) {
    const mult = Number(grams) / 100;
    if (!Number.isFinite(mult) || mult <= 0) {
        return { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
    }
    const kcal = Math.round(Number(food.kcal_per_100g) * mult);
    const round1 = (x) => Math.round(Number(x) * mult * 10) / 10;
    return {
        kcal,
        protein_g: round1(food.protein_per_100g),
        carbs_g: round1(food.carbs_per_100g),
        fat_g: round1(food.fat_per_100g),
    };
}
