import { describe, expect, it } from "vitest";
import {
  KG_PER_LB,
  LBS_PER_KG,
  displayWeightToKg,
  formatFoodGrams,
  formatSignedDeltaLb,
  kgToDisplayWeight,
  parseExerciseWeightToKg,
} from "../units";

describe("units helpers", () => {
  it("converts kg for imperial display", () => {
    const lb = Number(kgToDisplayWeight(100, "imperial"));
    expect(lb).toBeCloseTo(100 * LBS_PER_KG, 1);
  });

  it("parses imperial display weight to kg", () => {
    const kg = displayWeightToKg("220.5", "imperial");
    expect(kg).toBeCloseTo(220.5 * KG_PER_LB, 4);
  });

  it("parses exercise weight strings and preserves empty", () => {
    expect(parseExerciseWeightToKg("", "metric")).toBe("");
    expect(parseExerciseWeightToKg("100", "metric")).toBe("100");
  });

  it("formats food grams in metric and imperial", () => {
    expect(formatFoodGrams(125, "metric")).toBe("125 g");
    expect(formatFoodGrams(56.7, "imperial")).toContain("oz");
  });

  it("formats signed deltas", () => {
    expect(formatSignedDeltaLb(1, "imperial")).toBe("+1 lb");
    expect(formatSignedDeltaLb(-2, "imperial")).toBe("−2 lb");
  });
});
