/**
 * Mirrored from backend/lib/macroEngine.js for live Goals preview (no food macros).
 */

export function dailyKcalFromWeeklyChangeKg(weeklyChangeKg) {
    return (Number(weeklyChangeKg) * 7700) / 7;
}

export function computeMacroTargets({ maintenanceKcal, weeklyChangeKg, weightKg, goal }) {
    const w = Number(weightKg);
    const maint = Number(maintenanceKcal);
    if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(maint) || maint < 800) {
        return null;
    }

    const delta = dailyKcalFromWeeklyChangeKg(Number(weeklyChangeKg));
    let targetKcal = Math.round(maint + delta);
    targetKcal = Math.max(1200, Math.min(12000, targetKcal));

    const g = goal === "lose" ? "lose" : goal === "gain" ? "gain" : "maintain";
    const proteinPerKg = g === "lose" ? 2.2 : g === "gain" ? 1.7 : 1.8;
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
