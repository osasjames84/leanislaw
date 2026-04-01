import { monthlyLbmCapLb } from './strengthStandards.js';

/**
 * Heuristic muscle vs fat split for a period given weight change, strength trend, and training level.
 * Strength progression does not change TDEE; it nudges muscle share when weight rises.
 */
export function estimateMuscleVsFatLb({
    weightDeltaLb,
    strengthAvgPctChange,
    overallLevel,
}) {
    const dW = Number(weightDeltaLb);
    const strPct = Number(strengthAvgPctChange);
    const cap = monthlyLbmCapLb(overallLevel);

    if (!Number.isFinite(dW)) {
        return { muscle_lb: 0, fat_lb: 0, note: 'insufficient_data' };
    }

    const strengthBonus = Number.isFinite(strPct) && strPct > 0 ? Math.min(0.35, strPct / 200) : 0;
    // Fraction of weight gain attributed to muscle (capped by level)
    let muscleFrac = 0;
    if (dW > 0) {
        muscleFrac = Math.min(0.85, 0.35 + strengthBonus + (cap >= 1.5 ? 0.15 : 0));
        const maxMuscle = Math.min(cap, dW);
        let muscle = Math.min(maxMuscle, dW * muscleFrac);
        if (muscle > dW) muscle = dW;
        const fat = dW - muscle;
        return {
            muscle_lb: Math.round(muscle * 10) / 10,
            fat_lb: Math.round(fat * 10) / 10,
            note: 'surplus',
        };
    }
    if (dW < 0) {
        // Loss: assume higher fraction from fat when strength held
        const fatFrac = 1 - (Number.isFinite(strPct) && strPct >= -2 ? 0.15 : 0.25);
        const fat = dW * fatFrac;
        const muscle = dW - fat;
        return {
            muscle_lb: Math.round(muscle * 10) / 10,
            fat_lb: Math.round(fat * 10) / 10,
            note: 'deficit',
        };
    }

    return { muscle_lb: 0, fat_lb: 0, note: 'maintenance' };
}
