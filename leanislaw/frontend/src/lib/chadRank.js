/** Rank label from total non-template workout sessions logged. */
export function getChadRank(workoutCount) {
    if (workoutCount === 0) return "SUBHUMAN";
    if (workoutCount < 5) return "SUB-5";
    if (workoutCount < 50) return "LTN";
    if (workoutCount < 100) return "MTN";
    if (workoutCount < 200) return "HTN";
    if (workoutCount < 300) return "CHAD LITE";
    if (workoutCount >= 300) return "CHAD";
    return "SUB-5";
}
