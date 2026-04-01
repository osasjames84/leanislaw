import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useUnits } from "../contexts/UnitsContext";
import { authBearerHeaders } from "../apiHeaders";
import { formatFoodGrams, GRAMS_PER_OZ, KG_PER_LB, LBS_PER_KG, ML_PER_US_FLOZ } from "../units";
import {
    computeMacroTargets,
    customMacrosMatchTarget,
    kcalFromMacroGrams,
    MACRO_KCAL_TOLERANCE,
    macrosFromCaloriePercents,
} from "../macroTargetsPreview.js";

/**
 * Range is always 0.5–5 lb/month. Metric UI shows kg equivalent; API still uses weekly kg.
 */
const WEEKS_PER_MONTH = 365.25 / 12 / 7;
const MONTHLY_MIN_LB = 0.5;
const MONTHLY_MAX_LB = 5;
const MONTHLY_STEP_LB = 0.05;
const MONTHLY_MIN_KG = MONTHLY_MIN_LB * KG_PER_LB;
const MONTHLY_MAX_KG = MONTHLY_MAX_LB * KG_PER_LB;
const WEEKLY_MIN_KG = (MONTHLY_MIN_LB / WEEKS_PER_MONTH) * KG_PER_LB;
const WEEKLY_MAX_KG = (MONTHLY_MAX_LB / WEEKS_PER_MONTH) * KG_PER_LB;
const WEEKLY_STEP_KG = (MONTHLY_STEP_LB / WEEKS_PER_MONTH) * KG_PER_LB;

function clampWeeklyRateKg(kg) {
    const n = Number(kg);
    if (!Number.isFinite(n)) return WEEKLY_MIN_KG;
    return Math.min(WEEKLY_MAX_KG, Math.max(WEEKLY_MIN_KG, n));
}

function weeklyKgToMonthlyDisplayStr(weeklyKg, units) {
    const monthlyKg = Number(weeklyKg) * WEEKS_PER_MONTH;
    if (!Number.isFinite(monthlyKg)) return "";
    if (units === "imperial") {
        const lb = monthlyKg * LBS_PER_KG;
        return String(Math.round(lb * 100) / 100);
    }
    return String(Math.round(monthlyKg * 1000) / 1000);
}

function parseMonthlyToWeeklyKg(raw, units) {
    const v = parseFloat(String(raw).replace(",", ".").trim());
    if (!Number.isFinite(v)) return null;
    if (units === "imperial") return (v / WEEKS_PER_MONTH) * KG_PER_LB;
    return v / WEEKS_PER_MONTH;
}

const MEALS = [
    { id: "uncategorized", label: "Uncategorized" },
    { id: "breakfast", label: "Breakfast" },
    { id: "lunch", label: "Lunch" },
    { id: "dinner", label: "Dinner" },
    { id: "snacks", label: "Snacks" },
];

function shiftDate(iso, deltaDays) {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + deltaDays);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
}

function todayIsoLocal() {
    const dt = new Date();
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
}

function headerLabelForDate(iso) {
    if (iso === todayIsoLocal()) return "Today";
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

const MacroTracking = () => {
    const navigate = useNavigate();
    const { token } = useAuth();
    const { units, foodUnit } = useUnits();
    const [date, setDate] = useState(() => todayIsoLocal());

    const [goal, setGoal] = useState("maintain");
    const [weeklyRate, setWeeklyRate] = useState(WEEKLY_MIN_KG);
    const [planLoading, setPlanLoading] = useState(true);
    const [planSaving, setPlanSaving] = useState(false);
    const [planData, setPlanData] = useState(null);
    const [planErr, setPlanErr] = useState("");

    const [showGoals, setShowGoals] = useState(false);
    const [foodPickerOpen, setFoodPickerOpen] = useState(false);
    const [pickerMeal, setPickerMeal] = useState("uncategorized");
    const [pickerStep, setPickerStep] = useState("list");
    const [foods, setFoods] = useState([]);
    const [foodQuery, setFoodQuery] = useState("");
    const [picked, setPicked] = useState(null);
    /** Always stored in grams; input shows g or oz from settings. */
    const [portionGrams, setPortionGrams] = useState(200);
    const [amountCount, setAmountCount] = useState("1");
    const [servingSizeGrams, setServingSizeGrams] = useState(100);

    const [dayData, setDayData] = useState(null);
    const [dayErr, setDayErr] = useState("");
    const [adding, setAdding] = useState(false);
    const [expanded, setExpanded] = useState(() => new Set(["breakfast", "lunch", "dinner"]));
    const [draggingEntryId, setDraggingEntryId] = useState(null);
    const [dragOverMeal, setDragOverMeal] = useState("");

    /** Editable monthly target; synced from weeklyRate when not focused */
    const [monthlyFieldStr, setMonthlyFieldStr] = useState("");
    const [monthlyFieldFocused, setMonthlyFieldFocused] = useState(false);

    const [macroSplitSource, setMacroSplitSource] = useState("auto");
    const [macroEditTab, setMacroEditTab] = useState("grams");
    const [macroGStr, setMacroGStr] = useState({ p: "", c: "", f: "" });
    const [macroPctStr, setMacroPctStr] = useState({ p: "30", c: "40", f: "30" });
    const goalsSheetOpenedRef = useRef(false);

    const signedWeeklyPreviewKg = useMemo(() => {
        if (goal === "maintain") return 0;
        if (goal === "lose") return -Math.abs(Number(weeklyRate));
        return Math.abs(Number(weeklyRate));
    }, [goal, weeklyRate]);

    const previewTargets = useMemo(() => {
        const maint = planData?.maintenance_kcal;
        const w = planData?.weight_kg_used;
        if (maint == null || w == null) return null;
        return computeMacroTargets({
            maintenanceKcal: maint,
            weeklyChangeKg: signedWeeklyPreviewKg,
            weightKg: w,
            goal,
        });
    }, [planData?.maintenance_kcal, planData?.weight_kg_used, signedWeeklyPreviewKg, goal]);

    useEffect(() => {
        if (!showGoals) {
            goalsSheetOpenedRef.current = false;
            return;
        }
        if (!previewTargets || !planData?.targets) return;
        if (goalsSheetOpenedRef.current) return;
        goalsSheetOpenedRef.current = true;

        const p = planData.plan;
        const tgt = planData.targets;
        const hasRow =
            p?.custom_protein_g != null && p?.custom_carbs_g != null && p?.custom_fat_g != null;

        if (hasRow && (tgt.macros_custom || tgt.macros_custom_stale)) {
            setMacroSplitSource("custom");
            setMacroGStr({
                p: String(p.custom_protein_g),
                c: String(p.custom_carbs_g),
                f: String(p.custom_fat_g),
            });
        } else {
            setMacroSplitSource("auto");
            setMacroGStr({
                p: String(previewTargets.protein_g),
                c: String(previewTargets.carbs_g),
                f: String(previewTargets.fat_g),
            });
        }
        setMacroEditTab("grams");
    }, [showGoals, planData, previewTargets]);

    const openMacroPercentTab = () => {
        setMacroEditTab("percent");
        if (!previewTargets) return;
        const tk = previewTargets.target_kcal;
        const pg = parseFloat(String(macroGStr.p).replace(",", ".")) || 0;
        const cg = parseFloat(String(macroGStr.c).replace(",", ".")) || 0;
        const fg = parseFloat(String(macroGStr.f).replace(",", ".")) || 0;
        if (tk <= 0) return;
        setMacroPctStr({
            p: ((4 * pg * 100) / tk).toFixed(1),
            c: ((4 * cg * 100) / tk).toFixed(1),
            f: ((9 * fg * 100) / tk).toFixed(1),
        });
    };

    const applyMacroPercents = () => {
        if (!previewTargets) return;
        const a = parseFloat(String(macroPctStr.p).replace(",", ".")) || 0;
        const b = parseFloat(String(macroPctStr.c).replace(",", ".")) || 0;
        const c = parseFloat(String(macroPctStr.f).replace(",", ".")) || 0;
        const g = macrosFromCaloriePercents(previewTargets.target_kcal, a, b, c);
        setMacroGStr({
            p: String(g.protein_g),
            c: String(g.carbs_g),
            f: String(g.fat_g),
        });
    };

    useLayoutEffect(() => {
        if (!monthlyFieldFocused) {
            setMonthlyFieldStr(weeklyKgToMonthlyDisplayStr(weeklyRate, units));
        }
    }, [weeklyRate, units, monthlyFieldFocused]);

    const loadPlan = useCallback(async () => {
        if (!token) return;
        setPlanErr("");
        setPlanLoading(true);
        try {
            const res = await fetch("/api/v1/macros/plan", { headers: authBearerHeaders(token) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Could not load macro plan");
            setPlanData(data);
            const p = data.plan;
            if (p) {
                setGoal(p.goal || "maintain");
                const g = p.goal || "maintain";
                if (g !== "maintain") {
                    const mag = Number(p.weekly_rate_display_kg ?? Math.abs(p.weekly_change_kg));
                    if (Number.isFinite(mag) && mag > 0) setWeeklyRate(clampWeeklyRateKg(mag));
                    else setWeeklyRate(WEEKLY_MIN_KG);
                }
            }
        } catch (e) {
            setPlanErr(e.message);
        } finally {
            setPlanLoading(false);
        }
    }, [token]);

    const loadDay = useCallback(async () => {
        if (!token) return;
        setDayErr("");
        try {
            const res = await fetch(`/api/v1/macros/day?date=${encodeURIComponent(date)}`, {
                headers: authBearerHeaders(token),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Could not load day");
            setDayData(data);
        } catch (e) {
            setDayErr(e.message);
        }
    }, [token, date]);

    const loadFoods = useCallback(
        async (q) => {
            if (!token) return;
            const qq = q.trim();
            const headers = authBearerHeaders(token);
            if (!qq) {
                const res = await fetch("/api/v1/macros/foods", { headers });
                const data = await res.json().catch(() => []);
                if (res.ok) setFoods(Array.isArray(data) ? data.map((f) => ({ ...f, source: "catalog" })) : []);
                return;
            }

            const [catalogRes, usdaRes] = await Promise.all([
                fetch(`/api/v1/macros/foods?q=${encodeURIComponent(qq)}`, { headers }),
                fetch(`/api/v1/macros/usda/search?q=${encodeURIComponent(qq)}&pageSize=25`, { headers }),
            ]);

            const catalogData = await catalogRes.json().catch(() => []);
            const usdaData = await usdaRes.json().catch(() => ({}));

            const catalogFoods = Array.isArray(catalogData)
                ? catalogData.map((f) => ({ ...f, source: "catalog" }))
                : [];
            const usdaFoods = Array.isArray(usdaData.foods)
                ? usdaData.foods.map((f) => {
                      const nutrientRows = Array.isArray(f.foodNutrients) ? f.foodNutrients : [];
                      const byName = (needle) =>
                          nutrientRows.find((n) =>
                              String(n.nutrientName || n.nutrient?.name || "")
                                  .toLowerCase()
                                  .includes(needle)
                          )?.value ?? null;
                      return {
                          id: `usda-${f.fdcId}`,
                          fdcId: f.fdcId,
                          name: f.description,
                          kcal_per_100g: byName("energy"),
                          servingSize: f.servingSize ?? null,
                          servingSizeUnit: f.servingSizeUnit ?? null,
                          source: "usda",
                          brand: f.brandName || null,
                          dataType: f.dataType || null,
                      };
                  })
                : [];
            setFoods([...catalogFoods, ...usdaFoods]);
        },
        [token]
    );

    useEffect(() => {
        loadPlan();
    }, [loadPlan]);

    useEffect(() => {
        loadDay();
    }, [loadDay]);

    useEffect(() => {
        if (!foodPickerOpen) return;
        const t = setTimeout(() => loadFoods(foodQuery), foodQuery.trim() ? 220 : 0);
        return () => clearTimeout(t);
    }, [foodQuery, loadFoods, foodPickerOpen]);

    const entriesByMeal = useMemo(() => {
        const map = Object.fromEntries(MEALS.map((m) => [m.id, []]));
        for (const e of dayData?.entries ?? []) {
            const slot = e.meal_slot && map[e.meal_slot] != null ? e.meal_slot : "uncategorized";
            map[slot].push(e);
        }
        return map;
    }, [dayData]);

    const savePlan = async () => {
        if (!token) return;
        setPlanSaving(true);
        setPlanErr("");
        try {
            const body =
                goal === "maintain"
                    ? { goal: "maintain", weekly_rate_kg: 0 }
                    : { goal, weekly_rate_kg: weeklyRate };

            if (macroSplitSource === "custom") {
                if (!previewTargets) {
                    setPlanErr("Calorie target not available; check TDEE and weight.");
                    setPlanSaving(false);
                    return;
                }
                const p = parseFloat(String(macroGStr.p).replace(",", "."));
                const c = parseFloat(String(macroGStr.c).replace(",", "."));
                const f = parseFloat(String(macroGStr.f).replace(",", "."));
                if (![p, c, f].every((x) => Number.isFinite(x) && x >= 0)) {
                    setPlanErr("Enter protein, carbs, and fat in grams.");
                    setPlanSaving(false);
                    return;
                }
                if (
                    !customMacrosMatchTarget(previewTargets.target_kcal, p, c, f, MACRO_KCAL_TOLERANCE)
                ) {
                    const k = Math.round(kcalFromMacroGrams(p, c, f));
                    setPlanErr(
                        `Macro calories (${k}) must be within ±${MACRO_KCAL_TOLERANCE} kcal of target ${previewTargets.target_kcal} kcal.`,
                    );
                    setPlanSaving(false);
                    return;
                }
                body.custom_macros = { protein_g: p, carbs_g: c, fat_g: f };
            } else {
                body.custom_macros = null;
            }

            const res = await fetch("/api/v1/macros/plan", {
                method: "PUT",
                headers: { ...authBearerHeaders(token), "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Save failed");
            await loadPlan();
            setShowGoals(false);
        } catch (e) {
            setPlanErr(e.message);
        } finally {
            setPlanSaving(false);
        }
    };

    const openFoodPicker = (mealId) => {
        setPickerMeal(mealId);
        setFoodPickerOpen(true);
        setPickerStep("list");
        setPicked(null);
        setFoodQuery("");
        setPortionGrams(200);
        setAmountCount("1");
        setServingSizeGrams(100);
        setTimeout(() => loadFoods(""), 0);
    };

    const closeFoodPicker = () => {
        setFoodPickerOpen(false);
        setPicked(null);
        setPickerStep("list");
    };

    const servingOptions = useMemo(() => {
        const base = [
            { label: "100 g", grams: 100 },
            { label: "10 g", grams: 10 },
            { label: "1 g", grams: 1 },
            { label: "1 oz", grams: GRAMS_PER_OZ },
        ];
        const s = Number(picked?.servingSize);
        const u = String(picked?.servingSizeUnit || "").toLowerCase();
        if (Number.isFinite(s) && s > 0 && (u === "g" || u === "gram" || u === "grams")) {
            base.unshift({ label: `default - ${Math.round(s * 10) / 10} g`, grams: s });
        }
        return base;
    }, [picked]);

    const amountNum = useMemo(() => {
        const v = parseFloat(String(amountCount).replace(",", "."));
        return Number.isFinite(v) && v > 0 ? v : 0;
    }, [amountCount]);

    const totalPickerGrams = useMemo(
        () => Math.round(amountNum * Number(servingSizeGrams || 0) * 100) / 100,
        [amountNum, servingSizeGrams]
    );

    useEffect(() => {
        if (!foodPickerOpen || pickerStep !== "grams") return;
        setPortionGrams(totalPickerGrams);
    }, [foodPickerOpen, pickerStep, totalPickerGrams]);

    const pickerMacroPreview = useMemo(() => {
        if (!picked || !Number.isFinite(Number(picked.kcal_per_100g))) return null;
        const k100 = Number(picked.kcal_per_100g);
        const p100 = Number(picked.protein_per_100g || 0);
        const c100 = Number(picked.carbs_per_100g || 0);
        const f100 = Number(picked.fat_per_100g || 0);
        const m = totalPickerGrams / 100;
        const kcal = Math.round(k100 * m * 10) / 10;
        const protein = Math.round(p100 * m * 10) / 10;
        const carbs = Math.round(c100 * m * 10) / 10;
        const fat = Math.round(f100 * m * 10) / 10;
        const macroKcal = protein * 4 + carbs * 4 + fat * 9;
        const pct = (x) => (macroKcal > 0 ? Math.round((x / macroKcal) * 100) : 0);
        return { kcal, protein, carbs, fat, pPct: pct(protein * 4), cPct: pct(carbs * 4), fPct: pct(fat * 9) };
    }, [picked, totalPickerGrams]);

    const pickerBarRow = (label, unit, cur, goalVal, color) => {
        const pct = goalVal > 0 ? Math.min(100, Math.round((cur / goalVal) * 100)) : 0;
        const curStr = Number(cur).toFixed(1);
        const goalStr = goalVal > 0 ? Number(goalVal).toFixed(1) : "—";
        return (
            <div style={{ marginBottom: 10 }}>
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "auto 1fr auto",
                        gap: 8,
                        alignItems: "baseline",
                        fontSize: "0.74rem",
                        fontWeight: "700",
                    }}
                >
                    <span style={{ color: "#1c1c1e" }}>{label}</span>
                    <span style={{ color: "#636366", textAlign: "center" }}>
                        {curStr} / {goalStr}
                        {unit}
                    </span>
                    <span style={{ color: "#8e8e93", textAlign: "right" }}>{pct}%</span>
                </div>
                <div
                    style={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: "#e5e5ea",
                        marginTop: 6,
                        overflow: "hidden",
                    }}
                >
                    <div
                        style={{
                            width: `${pct}%`,
                            height: "100%",
                            borderRadius: 3,
                            backgroundColor: color,
                            transition: "width 0.2s ease",
                        }}
                    />
                </div>
            </div>
        );
    };

    const addFood = async (e) => {
        e?.preventDefault?.();
        if (!picked || !token) return;
        const g = totalPickerGrams;
        if (!Number.isFinite(g) || g <= 0) {
            setDayErr("Enter a valid portion size.");
            return;
        }
        setAdding(true);
        setDayErr("");
        try {
            const isUsda = picked?.source === "usda" && picked?.fdcId;
            const endpoint = isUsda ? "/api/v1/macros/usda/day" : "/api/v1/macros/day";
            const payload = isUsda
                ? {
                      date,
                      fdcId: picked.fdcId,
                      grams: g,
                      meal_slot: pickerMeal,
                  }
                : {
                      date,
                      food_catalog_id: picked.id,
                      grams: g,
                      meal_slot: pickerMeal,
                  };
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { ...authBearerHeaders(token), "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Could not add food");
            await loadDay();
            closeFoodPicker();
        } catch (err) {
            setDayErr(err.message);
        } finally {
            setAdding(false);
        }
    };

    const removeEntry = async (id) => {
        if (!token) return;
        const res = await fetch(`/api/v1/macros/entries/${id}`, {
            method: "DELETE",
            headers: authBearerHeaders(token),
        });
        if (res.ok) loadDay();
    };

    const moveEntryToMeal = async (entryId, mealId) => {
        if (!token) return;
        const res = await fetch(`/api/v1/macros/entries/${entryId}`, {
            method: "PATCH",
            headers: { ...authBearerHeaders(token), "Content-Type": "application/json" },
            body: JSON.stringify({ meal_slot: mealId }),
        });
        if (res.ok) {
            await loadDay();
        }
    };

    const toggleExpand = (mealId) => {
        setExpanded((prev) => {
            const n = new Set(prev);
            if (n.has(mealId)) n.delete(mealId);
            else n.add(mealId);
            return n;
        });
    };

    const t = planData?.targets;
    const totals = dayData?.totals ?? { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

    const barRow = (label, unit, cur, goalVal, color) => {
        const pct = goalVal > 0 ? Math.min(100, Math.round((cur / goalVal) * 100)) : 0;
        const pctLabel = `${pct}%`;
        const curStr = Number(cur).toFixed(1);
        const goalStr =
            goalVal != null && Number(goalVal) > 0 ? Number(goalVal).toFixed(1) : "—";
        return (
            <div style={{ marginBottom: 12 }}>
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "auto 1fr auto",
                        gap: 8,
                        alignItems: "baseline",
                        fontSize: "0.76rem",
                        fontWeight: "700",
                    }}
                >
                    <span style={{ color: "#1c1c1e" }}>{label}</span>
                    <span style={{ color: "#636366", textAlign: "center" }}>
                        {curStr} / {goalStr}
                        {unit}
                    </span>
                    <span style={{ color: "#8e8e93", textAlign: "right" }}>{pctLabel}</span>
                </div>
                <div
                    style={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: "#e5e5ea",
                        marginTop: 6,
                        overflow: "hidden",
                    }}
                >
                    <div
                        style={{
                            width: `${pct}%`,
                            height: "100%",
                            borderRadius: 3,
                            backgroundColor: color,
                            transition: "width 0.2s ease",
                        }}
                    />
                </div>
            </div>
        );
    };

    const goalsBody = (
        <>
            {planErr ? <div style={errBox}>{planErr}</div> : null}
            <p style={kicker}>Goal</p>
            <div style={goalRow}>
                {["lose", "maintain", "gain"].map((g) => (
                    <button
                        key={g}
                        type="button"
                        onClick={() => {
                            setGoal(g);
                            if (g !== "maintain")
                                setWeeklyRate((r) => clampWeeklyRateKg(r <= 0 ? WEEKLY_MIN_KG : r));
                        }}
                        style={{
                            ...goalBtn,
                            ...(goal === g ? goalBtnOn : {}),
                        }}
                    >
                        {g === "lose" ? "Lose" : g === "gain" ? "Gain" : "Maintain"}
                    </button>
                ))}
            </div>
            {goal !== "maintain" ? (
                <>
                    <p style={rateLabel}>
                        {goal === "lose" ? "Target loss per month" : "Target gain per month"}
                    </p>
                    <div style={rateManualRow}>
                        <input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            aria-label={
                                goal === "lose"
                                    ? units === "imperial"
                                        ? "Pounds lost per month"
                                        : "Kilograms lost per month"
                                    : units === "imperial"
                                      ? "Pounds gained per month"
                                      : "Kilograms gained per month"
                            }
                            value={monthlyFieldStr}
                            onChange={(e) => setMonthlyFieldStr(e.target.value)}
                            onFocus={() => setMonthlyFieldFocused(true)}
                            onBlur={() => {
                                setMonthlyFieldFocused(false);
                                const trimmed = monthlyFieldStr.trim();
                                const wKg = parseMonthlyToWeeklyKg(trimmed, units);
                                if (trimmed === "" || wKg == null) {
                                    setMonthlyFieldStr(weeklyKgToMonthlyDisplayStr(weeklyRate, units));
                                    return;
                                }
                                setWeeklyRate(clampWeeklyRateKg(wKg));
                            }}
                            style={rateNumberInput}
                        />
                        <span style={rateUnitSuffix}>{units === "imperial" ? "lb" : "kg"}</span>
                    </div>
                    <div style={rateSliderWrap}>
                        <span style={rateSliderEnd}>
                            {units === "imperial" ? `${MONTHLY_MIN_LB} lb` : `${MONTHLY_MIN_KG.toFixed(2)} kg`}
                        </span>
                        <input
                            type="range"
                            aria-valuemin={WEEKLY_MIN_KG}
                            aria-valuemax={WEEKLY_MAX_KG}
                            min={WEEKLY_MIN_KG}
                            max={WEEKLY_MAX_KG}
                            step={WEEKLY_STEP_KG}
                            value={clampWeeklyRateKg(weeklyRate)}
                            onChange={(e) => {
                                setMonthlyFieldFocused(false);
                                setWeeklyRate(parseFloat(e.target.value));
                            }}
                            style={rateSlider}
                        />
                        <span style={rateSliderEnd}>
                            {units === "imperial" ? `${MONTHLY_MAX_LB} lb` : `${MONTHLY_MAX_KG.toFixed(2)} kg`}
                        </span>
                    </div>
                </>
            ) : null}

            {previewTargets ? (
                <>
                    <p style={{ ...kicker, marginTop: 20 }}>Macros</p>
                    {planData?.targets?.macros_custom_stale ? (
                        <p style={macroStaleHint}>
                            Your saved manual macros don&apos;t match this calorie target after your energy
                            goal changed. Edit them below or choose &quot;Use goal-based&quot; and save.
                        </p>
                    ) : null}

                    <div style={macroRecommendedCard}>
                        <p style={macroRecommendedTitle}>
                            From your goal · <strong>{previewTargets.target_kcal}</strong> kcal/day
                        </p>
                        <p style={macroRecommendedNums}>
                            Protein <strong>{previewTargets.protein_g}</strong> g · Carbs{" "}
                            <strong>{previewTargets.carbs_g}</strong> g · Fat{" "}
                            <strong>{previewTargets.fat_g}</strong> g
                        </p>
                        <p style={macroRecommendedSub}>
                            Recommended from your TDEE, weight, lose/gain pace, and macro rules. This stays
                            your default unless you override below.
                        </p>
                    </div>

                    <p style={macroHowLabel}>Apply on save</p>
                    <div style={goalRow}>
                        <button
                            type="button"
                            onClick={() => {
                                setMacroSplitSource("auto");
                                setMacroGStr({
                                    p: String(previewTargets.protein_g),
                                    c: String(previewTargets.carbs_g),
                                    f: String(previewTargets.fat_g),
                                });
                            }}
                            style={{
                                ...goalBtn,
                                ...(macroSplitSource === "auto" ? goalBtnOn : {}),
                            }}
                        >
                            Use goal-based
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setMacroSplitSource("custom");
                                setMacroGStr({
                                    p: String(previewTargets.protein_g),
                                    c: String(previewTargets.carbs_g),
                                    f: String(previewTargets.fat_g),
                                });
                            }}
                            style={{
                                ...goalBtn,
                                ...(macroSplitSource === "custom" ? goalBtnOn : {}),
                            }}
                        >
                            Adjust manually
                        </button>
                    </div>
                    {macroSplitSource === "auto" ? (
                        <p style={macroHint}>
                            Saving uses the recommended protein, carbs, and fat above (not a custom split).
                        </p>
                    ) : null}
                    {macroSplitSource === "custom" ? (
                        <>
                            <p style={macroCalorieLine}>
                                Manual override — still must match{" "}
                                <strong>{previewTargets.target_kcal}</strong> kcal total
                                <span style={macroCalorieSub}>
                                    {" "}
                                    (4 kcal/g protein &amp; carbs, 9 kcal/g fat)
                                </span>
                            </p>
                            <div style={goalRow}>
                                <button
                                    type="button"
                                    onClick={openMacroPercentTab}
                                    style={{
                                        ...goalBtn,
                                        ...(macroEditTab === "percent" ? goalBtnOn : {}),
                                    }}
                                >
                                    By %
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMacroEditTab("grams")}
                                    style={{
                                        ...goalBtn,
                                        ...(macroEditTab === "grams" ? goalBtnOn : {}),
                                    }}
                                >
                                    By grams
                                </button>
                            </div>
                            {macroEditTab === "percent" ? (
                                <div style={macroFieldBlock}>
                                    <p style={macroHint}>
                                        % of calories from each macro (typically sum ~100). Tap Apply to
                                        convert to grams.
                                    </p>
                                    <div style={macroFieldGrid}>
                                        <label style={macroFieldCol}>
                                            <span style={macroMiniLabel}>Protein %</span>
                                            <input
                                                style={macroSmallInput}
                                                inputMode="decimal"
                                                value={macroPctStr.p}
                                                onChange={(e) =>
                                                    setMacroPctStr((s) => ({ ...s, p: e.target.value }))
                                                }
                                            />
                                        </label>
                                        <label style={macroFieldCol}>
                                            <span style={macroMiniLabel}>Carbs %</span>
                                            <input
                                                style={macroSmallInput}
                                                inputMode="decimal"
                                                value={macroPctStr.c}
                                                onChange={(e) =>
                                                    setMacroPctStr((s) => ({ ...s, c: e.target.value }))
                                                }
                                            />
                                        </label>
                                        <label style={macroFieldCol}>
                                            <span style={macroMiniLabel}>Fat %</span>
                                            <input
                                                style={macroSmallInput}
                                                inputMode="decimal"
                                                value={macroPctStr.f}
                                                onChange={(e) =>
                                                    setMacroPctStr((s) => ({ ...s, f: e.target.value }))
                                                }
                                            />
                                        </label>
                                    </div>
                                    <button type="button" style={macroApplyBtn} onClick={applyMacroPercents}>
                                        Apply % → grams
                                    </button>
                                </div>
                            ) : (
                                <div style={macroFieldBlock}>
                                    <div style={macroFieldGrid}>
                                        <label style={macroFieldCol}>
                                            <span style={macroMiniLabel}>Protein (g)</span>
                                            <input
                                                style={macroSmallInput}
                                                inputMode="decimal"
                                                value={macroGStr.p}
                                                onChange={(e) =>
                                                    setMacroGStr((s) => ({ ...s, p: e.target.value }))
                                                }
                                            />
                                        </label>
                                        <label style={macroFieldCol}>
                                            <span style={macroMiniLabel}>Carbs (g)</span>
                                            <input
                                                style={macroSmallInput}
                                                inputMode="decimal"
                                                value={macroGStr.c}
                                                onChange={(e) =>
                                                    setMacroGStr((s) => ({ ...s, c: e.target.value }))
                                                }
                                            />
                                        </label>
                                        <label style={macroFieldCol}>
                                            <span style={macroMiniLabel}>Fat (g)</span>
                                            <input
                                                style={macroSmallInput}
                                                inputMode="decimal"
                                                value={macroGStr.f}
                                                onChange={(e) =>
                                                    setMacroGStr((s) => ({ ...s, f: e.target.value }))
                                                }
                                            />
                                        </label>
                                    </div>
                                </div>
                            )}
                            <p
                                style={{
                                    ...macroKcalCheck,
                                    color: customMacrosMatchTarget(
                                        previewTargets.target_kcal,
                                        parseFloat(String(macroGStr.p).replace(",", ".")) || 0,
                                        parseFloat(String(macroGStr.c).replace(",", ".")) || 0,
                                        parseFloat(String(macroGStr.f).replace(",", ".")) || 0,
                                        MACRO_KCAL_TOLERANCE,
                                    )
                                        ? "#047857"
                                        : "#b45309",
                                }}
                            >
                                Macro calories:{" "}
                                {Math.round(
                                    kcalFromMacroGrams(
                                        parseFloat(String(macroGStr.p).replace(",", ".")) || 0,
                                        parseFloat(String(macroGStr.c).replace(",", ".")) || 0,
                                        parseFloat(String(macroGStr.f).replace(",", ".")) || 0,
                                    ),
                                )}{" "}
                                / {previewTargets.target_kcal} kcal
                                {customMacrosMatchTarget(
                                    previewTargets.target_kcal,
                                    parseFloat(String(macroGStr.p).replace(",", ".")) || 0,
                                    parseFloat(String(macroGStr.c).replace(",", ".")) || 0,
                                    parseFloat(String(macroGStr.f).replace(",", ".")) || 0,
                                    MACRO_KCAL_TOLERANCE,
                                )
                                    ? " — ok"
                                    : ` — within ±${MACRO_KCAL_TOLERANCE} kcal of target to save`}
                            </p>
                        </>
                    ) : null}
                </>
            ) : null}

            <button type="button" style={btn} onClick={savePlan} disabled={planSaving || planLoading}>
                {planSaving ? "Saving…" : "Save goals"}
            </button>
            {planData?.coaching_note ? <p style={coach}>{planData.coaching_note}</p> : null}
            {planData?.missing_factors?.length ? (
                <div style={hint}>
                    Missing: {planData.missing_factors.join(", ")}.
                    <Link to="/log/weight" style={hintLink}>
                        Weight
                    </Link>
                    {" · "}
                    <Link to="/tdee" style={hintLink}>
                        TDEE
                    </Link>
                </div>
            ) : null}
            <p style={{ marginTop: 16, fontSize: "0.88rem", color: "#636366", lineHeight: 1.4 }}>
                Range is {MONTHLY_MIN_LB}–{MONTHLY_MAX_LB} lb/month (
                {MONTHLY_MIN_KG.toFixed(2)}–{MONTHLY_MAX_KG.toFixed(2)} kg). We convert to a weekly average
                for targets. Roughly{" "}
                {units === "imperial"
                    ? "~3500 kcal per lb of that average weekly change."
                    : "~7700 kcal per kg of that average weekly change."}
            </p>
        </>
    );

    return (
        <div style={page}>
            <header style={header}>
                <button type="button" onClick={() => navigate("/dashboard")} style={backBtn}>
                    ← Home
                </button>
                <div style={dateNav}>
                    <button
                        type="button"
                        style={navChev}
                        onClick={() => setDate((d) => shiftDate(d, -1))}
                        aria-label="Previous day"
                    >
                        ‹
                    </button>
                    <span style={dateTitle}>{headerLabelForDate(date)}</span>
                    <button
                        type="button"
                        style={navChev}
                        onClick={() => setDate((d) => shiftDate(d, 1))}
                        aria-label="Next day"
                    >
                        ›
                    </button>
                </div>
                <button type="button" style={goalsBtn} onClick={() => setShowGoals(true)}>
                    Goals
                </button>
            </header>

            <div style={content}>
                {dayErr && !foodPickerOpen ? <div style={errBox}>{dayErr}</div> : null}

                <section style={targetsCard}>
                    <div style={targetsHeader}>
                        <span style={kickerInline}>Targets</span>
                        <span style={consumedLbl}>Consumed</span>
                    </div>
                    {planLoading ? <p style={targetsMuted}>Loading…</p> : null}
                    {t ? (
                        <>
                            {barRow("Energy", " kcal", totals.kcal, t.target_kcal, "#000")}
                            {barRow("Protein", " g", totals.protein_g, t.protein_g, "#007aff")}
                            {barRow("Carbs", " g", totals.carbs_g, t.carbs_g, "#34c759")}
                            {barRow("Fat", " g", totals.fat_g, t.fat_g, "#ff9500")}
                            <p style={maintHint}>
                                ~{t.maintenance_kcal} kcal maintenance
                                {t.daily_energy_delta_kcal !== 0 ? (
                                    <>
                                        {" "}
                                        ({t.daily_energy_delta_kcal > 0 ? "+" : ""}
                                        {t.daily_energy_delta_kcal} kcal / day vs that)
                                    </>
                                ) : null}
                            </p>
                        </>
                    ) : !planLoading ? (
                        <p style={targetsMuted}>Open Goals to set a plan — you need TDEE and a logged weight.</p>
                    ) : null}
                </section>

                <div style={sectionLabel}>Log</div>

                <div style={mealCard}>
                    <div style={mealRow}>
                        <span style={plusPlaceholder} aria-hidden />
                        <span style={mealTitle}>Water</span>
                        <span style={mealMeta}>
                            {units === "imperial"
                                ? "0 / 64 fl oz"
                                : `0 / ${Math.round(64 * ML_PER_US_FLOZ)} ml`}
                        </span>
                        <span style={chev}>▾</span>
                    </div>
                </div>

                {MEALS.map((m) => {
                    const list = entriesByMeal[m.id];
                    const isOpen = expanded.has(m.id);
                    const mealKcal = list.reduce((s, e) => s + e.kcal, 0);
                    return (
                        <div
                            key={m.id}
                            style={mealCard}
                            onMouseDown={(ev) => {
                                // Prevent browser focus ring on drag targets.
                                ev.currentTarget.style.outline = "none";
                            }}
                            onDragEnter={(ev) => {
                                ev.preventDefault();
                                ev.currentTarget.style.outline = "none";
                                setDragOverMeal(m.id);
                            }}
                            onDragOver={(ev) => {
                                ev.preventDefault();
                                ev.dataTransfer.dropEffect = "move";
                                ev.currentTarget.style.outline = "none";
                                setDragOverMeal(m.id);
                            }}
                            onDragLeave={() => {
                                if (dragOverMeal === m.id) setDragOverMeal("");
                            }}
                            onDrop={async (ev) => {
                                ev.preventDefault();
                                const payload = ev.dataTransfer.getData("text/plain");
                                const id = Number(payload);
                                setDragOverMeal("");
                                setDraggingEntryId(null);
                                if (!Number.isFinite(id)) return;
                                const src = (dayData?.entries || []).find((x) => Number(x.id) === id)?.meal_slot;
                                if (src === m.id) return;
                                await moveEntryToMeal(id, m.id);
                            }}
                        >
                            <div style={mealRow}>
                                <button
                                    type="button"
                                    style={plusBtn}
                                    onClick={() => openFoodPicker(m.id)}
                                    aria-label={`Add food to ${m.label}`}
                                >
                                    +
                                </button>
                                <span style={mealTitle}>{m.label}</span>
                                <span style={mealMeta}>{list.length ? `${mealKcal} kcal` : " "}</span>
                                <button
                                    type="button"
                                    style={chevBtn}
                                    onClick={() => toggleExpand(m.id)}
                                    aria-expanded={isOpen}
                                >
                                    <span style={{ ...chevIcon, transform: isOpen ? "rotate(180deg)" : "none" }}>▾</span>
                                </button>
                            </div>
                            {isOpen && list.length > 0 ? (
                                <ul style={entryList}>
                                    {list.map((e) => (
                                        <li
                                            key={e.id}
                                            style={{
                                                ...entryItem,
                                                ...(draggingEntryId === e.id ? entryItemDragging : {}),
                                            }}
                                            draggable
                                            onDragStart={(ev) => {
                                                ev.dataTransfer.setData("text/plain", String(e.id));
                                                ev.dataTransfer.effectAllowed = "move";
                                                // Remove default browser black drag preview outline.
                                                const ghost = document.createElement("div");
                                                ghost.style.width = "1px";
                                                ghost.style.height = "1px";
                                                ghost.style.opacity = "0";
                                                document.body.appendChild(ghost);
                                                ev.dataTransfer.setDragImage(ghost, 0, 0);
                                                setTimeout(() => document.body.removeChild(ghost), 0);
                                                setDraggingEntryId(e.id);
                                            }}
                                            onDragEnd={() => {
                                                setDraggingEntryId(null);
                                                setDragOverMeal("");
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontWeight: "700", fontSize: "0.92rem" }}>{e.name}</div>
                                                <div style={{ fontSize: "0.78rem", color: "#636366" }}>
                                                    {formatFoodGrams(e.grams, foodUnit)} · {e.kcal} kcal · P {e.protein_g}{" "}
                                                    · C {e.carbs_g} · F {e.fat_g}
                                                </div>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <span style={dragHandle} title="Drag to another meal">
                                                    ⋮⋮
                                                </span>
                                                <button type="button" style={delBtn} onClick={() => removeEntry(e.id)}>
                                                    Remove
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                        </div>
                    );
                })}

                <p style={footer}>
                    <Link to="/tdee" style={link}>
                        TDEE & metabolism
                    </Link>
                </p>
            </div>

            {showGoals ? (
                <div style={sheetBackdrop} role="presentation" onClick={() => setShowGoals(false)}>
                    <div
                        style={sheet}
                        role="dialog"
                        aria-label="Macro goals"
                        onClick={(ev) => ev.stopPropagation()}
                    >
                        <div style={sheetGrab} />
                        <div style={sheetHead}>
                            <h2 style={sheetTitle}>Goals & targets</h2>
                            <button type="button" style={sheetClose} onClick={() => setShowGoals(false)}>
                                Done
                            </button>
                        </div>
                        <div style={sheetBody}>{goalsBody}</div>
                    </div>
                </div>
            ) : null}

            {foodPickerOpen ? (
                <div style={pickerBackdrop} role="presentation" onClick={closeFoodPicker}>
                    <div
                        style={pickerSheet}
                        role="dialog"
                        aria-label="Add food"
                        onClick={(ev) => ev.stopPropagation()}
                    >
                        <div style={pickerHead}>
                            <button type="button" style={pickerBack} onClick={closeFoodPicker}>
                                Close
                            </button>
                            <span style={pickerTitle}>
                                {pickerStep === "list"
                                    ? `Add to ${MEALS.find((x) => x.id === pickerMeal)?.label ?? "meal"}`
                                    : "Amount"}
                            </span>
                            <span style={{ width: 56 }} />
                        </div>

                        {pickerStep === "list" ? (
                            <>
                                <input
                                    style={pickerSearch}
                                    placeholder="Search foods…"
                                    value={foodQuery}
                                    onChange={(e) => setFoodQuery(e.target.value)}
                                    autoFocus
                                />
                                <div style={pickerList}>
                                    {foods.map((f) => (
                                        <button
                                            key={f.id}
                                            type="button"
                                            style={pickerFoodRow}
                                            onClick={() => {
                                                setPicked(f);
                                                const s = Number(f?.servingSize);
                                                const u = String(f?.servingSizeUnit || "").toLowerCase();
                                                if (Number.isFinite(s) && s > 0 && (u === "g" || u === "gram" || u === "grams")) {
                                                    setServingSizeGrams(s);
                                                } else {
                                                    setServingSizeGrams(100);
                                                }
                                                setAmountCount("1");
                                                setPickerStep("grams");
                                            }}
                                        >
                                            <span style={{ fontWeight: "700" }}>
                                                {f.name}
                                                {f.source === "usda" ? " (USDA)" : ""}
                                            </span>
                                            <span style={{ fontSize: "0.72rem", color: "#8e8e93" }}>
                                                {f.kcal_per_100g != null
                                                    ? foodUnit === "imperial"
                                                        ? `${Math.round(((Number(f.kcal_per_100g) / 100) * GRAMS_PER_OZ) * 10) / 10} kcal / oz`
                                                        : `${Number(f.kcal_per_100g)} kcal / 100 g`
                                                    : "Calories not listed"}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div style={gramsWrap}>
                                <p style={{ margin: "0 0 8px", fontWeight: "700" }}>{picked?.name}</p>
                                <div style={formRow}>
                                    <label style={rowLabel}>Amount</label>
                                    <input
                                        style={smallInput}
                                        value={amountCount}
                                        onChange={(e) => setAmountCount(e.target.value)}
                                        inputMode="decimal"
                                        placeholder="1"
                                        autoFocus
                                    />
                                </div>
                                <div style={formRow}>
                                    <label style={rowLabel}>Serving size</label>
                                    <select
                                        style={smallInput}
                                        value={String(servingSizeGrams)}
                                        onChange={(e) => setServingSizeGrams(Number(e.target.value))}
                                    >
                                        {servingOptions.map((o) => (
                                            <option key={`${o.label}-${o.grams}`} value={String(o.grams)}>
                                                {o.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div style={formRow}>
                                    <label style={rowLabel}>Group</label>
                                    <select
                                        style={smallInput}
                                        value={pickerMeal}
                                        onChange={(e) => setPickerMeal(e.target.value)}
                                    >
                                        {MEALS.map((m) => (
                                            <option key={m.id} value={m.id}>
                                                {m.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div style={pickerSummaryCard}>
                                    <p style={pickerSummaryTitle}>
                                        Nutritional info for {Math.round(totalPickerGrams)} g
                                    </p>
                                    <p style={pickerSummaryMain}>
                                        {pickerMacroPreview ? `${pickerMacroPreview.kcal} kcal` : "Calories unavailable"}
                                    </p>
                                    {pickerMacroPreview ? (
                                        <>
                                            <div style={pickerMacroSplitRow}>
                                                <span style={{ color: "#007aff", fontWeight: 700 }}>
                                                    Protein {pickerMacroPreview.pPct}%
                                                </span>
                                                <span style={{ color: "#34c759", fontWeight: 700 }}>
                                                    Carbs {pickerMacroPreview.cPct}%
                                                </span>
                                                <span style={{ color: "#ff9500", fontWeight: 700 }}>
                                                    Fat {pickerMacroPreview.fPct}%
                                                </span>
                                            </div>
                                            {t ? (
                                                <div style={{ marginTop: 10 }}>
                                                    {pickerBarRow("Energy", " kcal", pickerMacroPreview.kcal, t.target_kcal, "#000")}
                                                    {pickerBarRow("Protein", " g", pickerMacroPreview.protein, t.protein_g, "#007aff")}
                                                    {pickerBarRow("Carbs", " g", pickerMacroPreview.carbs, t.carbs_g, "#34c759")}
                                                    {pickerBarRow("Fat", " g", pickerMacroPreview.fat, t.fat_g, "#ff9500")}
                                                </div>
                                            ) : (
                                                <p style={pickerSummaryLine}>
                                                    Protein {pickerMacroPreview.protein} g · Carbs {pickerMacroPreview.carbs} g · Fat{" "}
                                                    {pickerMacroPreview.fat} g
                                                </p>
                                            )}
                                        </>
                                    ) : (
                                        <p style={pickerSummaryLine}>USDA item will still be logged using full detail on save.</p>
                                    )}
                                </div>
                                <button type="button" style={btn} onClick={addFood} disabled={adding}>
                                    {adding ? "Adding…" : "Add to diary"}
                                </button>
                                <button
                                    type="button"
                                    style={btnGhost}
                                    onClick={() => {
                                        setPickerStep("list");
                                        setPicked(null);
                                    }}
                                >
                                    Back to list
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
};

const page = {
    minHeight: "100vh",
    backgroundColor: "#f2f2f7",
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
    paddingBottom: 8,
};

const header = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: "10px 12px",
    backgroundColor: "#fff",
    borderBottom: "0.5px solid #d1d1d6",
    position: "sticky",
    top: 0,
    zIndex: 20,
};

const backBtn = {
    border: "none",
    background: "none",
    fontSize: "0.95rem",
    color: "#007aff",
    fontWeight: "600",
    cursor: "pointer",
    padding: "8px 4px",
    flexShrink: 0,
};

const dateNav = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    flex: 1,
    minWidth: 0,
};

const navChev = {
    border: "none",
    background: "#f2f2f7",
    width: 36,
    height: 36,
    borderRadius: 10,
    fontSize: "1.25rem",
    fontWeight: "300",
    color: "#000",
    cursor: "pointer",
    lineHeight: 1,
};

const dateTitle = {
    fontSize: "1rem",
    fontWeight: "800",
    padding: "0 8px",
    textAlign: "center",
};

const goalsBtn = {
    border: "none",
    background: "none",
    color: "#007aff",
    fontWeight: "700",
    fontSize: "0.95rem",
    cursor: "pointer",
    padding: "8px 4px",
    flexShrink: 0,
};

const content = { padding: "12px 14px 28px", maxWidth: 520, margin: "0 auto" };

const targetsCard = {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: "16px 16px 14px",
    marginBottom: 14,
    border: "1px solid #e5e5ea",
    boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
};

const targetsHeader = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
};

const kickerInline = {
    fontSize: "0.62rem",
    fontWeight: "800",
    letterSpacing: "1px",
    textTransform: "uppercase",
    color: "#8e8e93",
};

const consumedLbl = {
    fontSize: "0.62rem",
    fontWeight: "800",
    letterSpacing: "1px",
    textTransform: "uppercase",
    color: "#aeaeb2",
};

const maintHint = {
    margin: "10px 0 0",
    fontSize: "0.72rem",
    color: "#8e8e93",
    lineHeight: 1.35,
};

const sectionLabel = {
    fontSize: "0.65rem",
    fontWeight: "800",
    color: "#8e8e93",
    letterSpacing: "1px",
    textTransform: "uppercase",
    margin: "4px 0 8px 4px",
};

const mealCard = {
    backgroundColor: "#fff",
    borderRadius: 12,
    border: "1px solid #e5e5ea",
    marginBottom: 10,
    overflow: "hidden",
    outline: "none",
};

const mealRow = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "14px 12px",
    minHeight: 48,
};

const plusBtn = {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: "1px solid #d1d1d6",
    background: "#f2f2f7",
    fontSize: "1.35rem",
    fontWeight: "300",
    lineHeight: 1,
    cursor: "pointer",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#007aff",
};

const plusPlaceholder = { width: 36, flexShrink: 0 };

const mealTitle = { flex: 1, fontWeight: "700", fontSize: "0.95rem", color: "#000" };

const mealMeta = { fontSize: "0.8rem", color: "#8e8e93", marginRight: 4 };

const chev = { color: "#c7c7cc", fontSize: "0.85rem" };

const chevBtn = {
    border: "none",
    background: "none",
    padding: 4,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
};

const chevIcon = {
    display: "inline-block",
    color: "#8e8e93",
    fontSize: "0.75rem",
    transition: "transform 0.2s ease",
};

const entryList = { listStyle: "none", margin: 0, padding: "0 12px 12px", borderTop: "1px solid #f2f2f7" };

const entryItem = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    padding: "12px 0",
    borderBottom: "1px solid #f2f2f7",
    cursor: "grab",
    outline: "none",
};
const entryItemDragging = {
    opacity: 0.45,
};
const dragHandle = {
    fontSize: "0.9rem",
    color: "#8e8e93",
    userSelect: "none",
    lineHeight: 1,
};

const delBtn = {
    border: "none",
    background: "none",
    color: "#ff3b30",
    fontWeight: "700",
    fontSize: "0.8rem",
    cursor: "pointer",
    flexShrink: 0,
};

const footer = { textAlign: "center", marginTop: 20 };

const link = { color: "#007aff", fontWeight: "600", textDecoration: "none" };

const errBox = {
    padding: 12,
    borderRadius: 12,
    background: "#fee2e2",
    color: "#b91c1c",
    fontSize: "0.88rem",
    marginBottom: 12,
};

const targetsMuted = { color: "#8e8e93", fontSize: "0.88rem" };

const sheetBackdrop = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    zIndex: 200,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
};

const sheet = {
    width: "100%",
    maxWidth: 520,
    maxHeight: "88vh",
    background: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
};

const sheetGrab = {
    width: 40,
    height: 5,
    borderRadius: 3,
    background: "#e5e5ea",
    margin: "10px auto 6px",
};

const sheetHead = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "4px 16px 12px",
    borderBottom: "1px solid #f2f2f7",
};

const sheetTitle = { margin: 0, fontSize: "1.05rem", fontWeight: "800" };

const sheetClose = {
    border: "none",
    background: "none",
    color: "#007aff",
    fontWeight: "700",
    fontSize: "1rem",
    cursor: "pointer",
};

const sheetBody = { padding: 16, overflowY: "auto" };

const kicker = {
    margin: "0 0 10px",
    fontSize: "0.65rem",
    fontWeight: "800",
    color: "#8e8e93",
    letterSpacing: "1px",
    textTransform: "uppercase",
};

const goalRow = { display: "flex", gap: 8, marginBottom: 14 };

const goalBtn = {
    flex: 1,
    padding: "12px 8px",
    borderRadius: 12,
    border: "1px solid #d1d1d6",
    background: "#f2f2f7",
    fontWeight: "800",
    fontSize: "0.85rem",
    cursor: "pointer",
};

const goalBtnOn = {
    background: "#000",
    color: "#fff",
    borderColor: "#000",
};

const rateLabel = { margin: "8px 0 6px", fontSize: "0.88rem", fontWeight: "600" };

const rateManualRow = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
};

const rateNumberInput = {
    width: 120,
    boxSizing: "border-box",
    padding: "12px 14px",
    fontSize: "1.25rem",
    fontWeight: "700",
    border: "1px solid #d1d1d6",
    borderRadius: 12,
    background: "#fff",
    color: "#1c1c1e",
    textAlign: "center",
};

const rateUnitSuffix = { fontSize: "1.05rem", fontWeight: "600", color: "#3a3a3c" };

const rateSliderWrap = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
};

const rateSliderEnd = { fontSize: "0.72rem", fontWeight: "700", color: "#8e8e93", flexShrink: 0 };

const rateSlider = {
    flex: 1,
    minWidth: 0,
    height: 8,
    accentColor: "#000",
    cursor: "pointer",
};

const macroStaleHint = {
    margin: "0 0 12px",
    padding: "10px 12px",
    borderRadius: 10,
    background: "#fff8e6",
    color: "#92400e",
    fontSize: "0.82rem",
    lineHeight: 1.35,
};

const macroRecommendedCard = {
    margin: "0 0 14px",
    padding: "14px 14px",
    borderRadius: 12,
    border: "1px solid #e5e5ea",
    background: "#f9f9fb",
};

const macroRecommendedTitle = {
    margin: "0 0 6px",
    fontSize: "0.8rem",
    fontWeight: "700",
    color: "#3a3a3c",
};

const macroRecommendedNums = {
    margin: "0 0 8px",
    fontSize: "1rem",
    color: "#1c1c1e",
    lineHeight: 1.4,
};

const macroRecommendedSub = {
    margin: 0,
    fontSize: "0.75rem",
    color: "#8e8e93",
    lineHeight: 1.35,
};

const macroHowLabel = {
    margin: "0 0 8px",
    fontSize: "0.65rem",
    fontWeight: "800",
    color: "#8e8e93",
    letterSpacing: "0.5px",
    textTransform: "uppercase",
};

const macroCalorieLine = {
    margin: "0 0 10px",
    fontSize: "0.88rem",
    color: "#1c1c1e",
};

const macroCalorieSub = { color: "#8e8e93", fontWeight: "500", fontSize: "0.78rem" };

const macroHint = {
    margin: "0 0 10px",
    fontSize: "0.8rem",
    color: "#636366",
    lineHeight: 1.35,
};

const macroFieldBlock = { marginBottom: 12 };

const macroFieldGrid = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 10,
    marginBottom: 10,
};

const macroFieldCol = { display: "flex", flexDirection: "column", gap: 6 };

const macroMiniLabel = {
    fontSize: "0.65rem",
    fontWeight: "800",
    color: "#8e8e93",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
};

const macroSmallInput = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 10px",
    fontSize: "1rem",
    fontWeight: "700",
    border: "1px solid #d1d1d6",
    borderRadius: 10,
    background: "#fff",
};

const macroApplyBtn = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "none",
    background: "#f2f2f7",
    color: "#007aff",
    fontWeight: "800",
    fontSize: "0.9rem",
    cursor: "pointer",
    marginBottom: 8,
};

const macroKcalCheck = {
    margin: "0 0 8px",
    fontSize: "0.82rem",
    fontWeight: "700",
};

const btn = {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 14,
    border: "none",
    background: "#000",
    color: "#fff",
    fontWeight: "800",
    fontSize: "0.95rem",
    cursor: "pointer",
};

const btnGhost = {
    width: "100%",
    marginTop: 10,
    padding: "12px 16px",
    borderRadius: 14,
    border: "none",
    background: "#f2f2f7",
    color: "#007aff",
    fontWeight: "700",
    fontSize: "0.9rem",
    cursor: "pointer",
};

const label = {
    display: "block",
    fontSize: "0.68rem",
    fontWeight: "800",
    color: "#8e8e93",
    textTransform: "uppercase",
    marginBottom: 6,
};

const input = {
    width: "100%",
    boxSizing: "border-box",
    padding: "14px 16px",
    fontSize: "1rem",
    border: "1px solid #e5e5ea",
    borderRadius: 12,
    marginBottom: 14,
};

const coach = {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    background: "#fff8e6",
    color: "#92400e",
    fontSize: "0.88rem",
    lineHeight: 1.4,
};

const hint = { marginTop: 12, fontSize: "0.85rem", color: "#636366", lineHeight: 1.4 };

const hintLink = { color: "#007aff", fontWeight: "700" };

const pickerBackdrop = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    zIndex: 210,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
};

const pickerSheet = {
    width: "100%",
    maxWidth: 520,
    maxHeight: "85vh",
    background: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
};

const pickerHead = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 14px",
    borderBottom: "1px solid #e5e5ea",
    flexShrink: 0,
};

const pickerBack = {
    border: "none",
    background: "none",
    color: "#007aff",
    fontWeight: "600",
    fontSize: "1rem",
    cursor: "pointer",
    padding: 4,
};

const pickerTitle = { fontWeight: "800", fontSize: "0.95rem" };

const pickerSearch = {
    margin: "12px 14px 8px",
    padding: "12px 14px",
    fontSize: "1rem",
    border: "1px solid #e5e5ea",
    borderRadius: 12,
    boxSizing: "border-box",
    width: "calc(100% - 28px)",
    alignSelf: "center",
};

const pickerList = {
    flex: 1,
    overflowY: "auto",
    padding: "0 0 16px",
};

const pickerFoodRow = {
    width: "100%",
    textAlign: "left",
    padding: "12px 16px",
    border: "none",
    borderBottom: "1px solid #f2f2f7",
    background: "#fff",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 4,
};

const gramsWrap = { padding: 20 };
const formRow = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
};
const rowLabel = {
    fontSize: "0.9rem",
    fontWeight: "700",
    color: "#1c1c1e",
};
const smallInput = {
    width: 170,
    boxSizing: "border-box",
    padding: "10px 12px",
    fontSize: "0.95rem",
    border: "1px solid #e5e5ea",
    borderRadius: 10,
    background: "#fff",
};
const pickerSummaryCard = {
    margin: "10px 0 14px",
    padding: "12px 12px",
    border: "1px solid #e5e5ea",
    borderRadius: 12,
    background: "#f9f9fb",
};
const pickerSummaryTitle = {
    margin: "0 0 6px",
    fontSize: "0.78rem",
    fontWeight: "700",
    color: "#636366",
};
const pickerSummaryMain = {
    margin: "0 0 6px",
    fontSize: "1.1rem",
    fontWeight: "800",
    color: "#000",
};
const pickerSummaryLine = {
    margin: 0,
    fontSize: "0.78rem",
    color: "#3a3a3c",
    lineHeight: 1.35,
};
const pickerMacroSplitRow = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    fontSize: "0.78rem",
    marginBottom: 2,
};

export default MacroTracking;
