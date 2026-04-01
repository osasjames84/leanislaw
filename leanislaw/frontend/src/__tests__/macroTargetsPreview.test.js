import { describe, expect, it } from "vitest";
import {
  computeMacroTargets,
  customMacrosMatchTarget,
  dailyKcalFromWeeklyChangeKg,
  kcalFromMacroGrams,
  macrosFromCaloriePercents,
} from "../macroTargetsPreview";

describe("macro target helpers", () => {
  it("computes daily kcal delta from weekly change", () => {
    expect(dailyKcalFromWeeklyChangeKg(0.5)).toBeCloseTo(550, 0);
  });

  it("returns null for invalid maintenance/weight", () => {
    const out = computeMacroTargets({
      maintenanceKcal: 500,
      weeklyChangeKg: 0,
      weightKg: 0,
      goal: "maintain",
    });
    expect(out).toBeNull();
  });

  it("computes sane macro targets", () => {
    const out = computeMacroTargets({
      maintenanceKcal: 2600,
      weeklyChangeKg: 0.2,
      weightKg: 80,
      goal: "gain",
    });
    expect(out).not.toBeNull();
    expect(out.target_kcal).toBeGreaterThan(1200);
    expect(out.protein_g).toBeGreaterThan(0);
    expect(out.carbs_g).toBeGreaterThanOrEqual(0);
    expect(out.fat_g).toBeGreaterThan(0);
  });

  it("converts percents to macros near target kcal", () => {
    const grams = macrosFromCaloriePercents(2400, 30, 40, 30);
    const kcal = kcalFromMacroGrams(grams.protein_g, grams.carbs_g, grams.fat_g);
    expect(grams.protein_g).toBeGreaterThan(0);
    expect(grams.carbs_g).toBeGreaterThanOrEqual(0);
    expect(grams.fat_g).toBeGreaterThan(0);
    expect(customMacrosMatchTarget(2400, grams.protein_g, grams.carbs_g, grams.fat_g, 40)).toBe(true);
    expect(Math.abs(kcal - 2400)).toBeLessThanOrEqual(40);
  });
});
