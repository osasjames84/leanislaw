import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useUnits } from "../contexts/UnitsContext";
import {
    displayWeightToKg,
    KG_PER_LB,
    LBS_PER_KG,
} from "../units";

const ALLOW_REPEAT_TDEE =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_ALLOW_TDEE_REPEAT === "true";

const selectControlStyle = {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #e5e5ea",
    fontSize: "0.9rem",
    backgroundColor: "#fff",
    boxSizing: "border-box",
};

const LEVEL_ACCENTS = {
    Beginner: { bg: "#ececef", fg: "#3a3a3c" },
    Novice: { bg: "#e8f4fc", fg: "#0b5cab" },
    Intermediate: { bg: "#f3e8ff", fg: "#6b21a8" },
    Advanced: { bg: "#fff4e6", fg: "#b45309" },
    Elite: { bg: "#ecfdf3", fg: "#047857" },
};

function levelAccent(level) {
    return LEVEL_ACCENTS[level] ?? { bg: "#ececef", fg: "#3a3a3c" };
}

/** Visual tier 0 = leanest silhouette … 9 = highest body fat (wider shape). */
const BODY_FAT_OPTIONS = [
    { id: "bf_sub5", label: "About 5% or less", shortLabel: "≤5%", midpoint: 4, tier: 0 },
    { id: "bf_5_8", label: "Roughly 5–8%", shortLabel: "5–8%", midpoint: 6.5, tier: 1 },
    { id: "bf_8_12", label: "Roughly 8–12%", shortLabel: "8–12%", midpoint: 10, tier: 2 },
    { id: "bf_12_16", label: "Roughly 12–16%", shortLabel: "12–16%", midpoint: 14, tier: 3 },
    { id: "bf_16_20", label: "Roughly 16–20%", shortLabel: "16–20%", midpoint: 18, tier: 4 },
    { id: "bf_20_25", label: "Roughly 20–25%", shortLabel: "20–25%", midpoint: 22.5, tier: 5 },
    { id: "bf_25_30", label: "Roughly 25–30%", shortLabel: "25–30%", midpoint: 27.5, tier: 6 },
    { id: "bf_30_35", label: "Roughly 30–35%", shortLabel: "30–35%", midpoint: 32.5, tier: 7 },
    { id: "bf_35_40", label: "Roughly 35–40%", shortLabel: "35–40%", midpoint: 37.5, tier: 8 },
    { id: "bf_40p", label: "Around 40% or more", shortLabel: "40%+", midpoint: 42, tier: 9 },
];

const STEP_PRESETS = [
    { label: "Light", steps: 3500 },
    { label: "Typical", steps: 7000 },
    { label: "Active", steps: 10000 },
    { label: "Very active", steps: 14000 },
];

const BENCH_VARS = ["Barbell bench press", "Dumbbell bench", "Incline barbell", "Smith machine bench"];
const SQUAT_VARS = ["Back squat", "Front squat", "Safety bar squat", "Goblet squat"];
const HINGE_VARS = ["Conventional deadlift", "Sumo deadlift", "Romanian deadlift", "Trap bar deadlift"];

function BodySilhouette({ tier }) {
    const t = Math.max(0, Math.min(9, tier));
    const waist = 18 + t * 2.2;
    const shoulder = 26 + t * 1.4;
    const hip = 22 + t * 2.4;
    const fill = t <= 2 ? "#3a3a3c" : t <= 5 ? "#5c5c5e" : "#8e8e93";
    const stroke = t <= 2 ? "#1c1c1e" : "#636366";
    return (
        <svg width="72" height="120" viewBox="0 0 72 120" aria-hidden style={{ display: "block" }}>
            <ellipse cx="36" cy="14" rx={9 + t * 0.25} ry={11 + t * 0.2} fill={fill} stroke={stroke} strokeWidth="1.2" />
            <path
                d={`M36 26 L${36 - shoulder * 0.5} 38 L${36 - waist * 0.45} 58 L${36 - hip * 0.48} 78 L${36 - waist * 0.35} 112 L36 118 L${36 + waist * 0.35} 112 L${36 + hip * 0.48} 78 L${36 + waist * 0.45} 58 L${36 + shoulder * 0.5} 38 Z`}
                fill={fill}
                stroke={stroke}
                strokeWidth="1.2"
                strokeLinejoin="round"
            />
            <path
                d={`M${36 - shoulder * 0.5} 38 L${36 - shoulder * 0.85} 72 M${36 + shoulder * 0.5} 38 L${36 + shoulder * 0.85} 72`}
                stroke={stroke}
                strokeWidth="5"
                strokeLinecap="round"
            />
        </svg>
    );
}

const STEPS = [
    "welcome",
    "weight",
    "bodyfat",
    "steps",
    "training",
    "experience",
    "strength",
    "loading",
    "result",
];

const TdeeOnboarding = () => {
    const navigate = useNavigate();
    const { token, user, loading: authLoading, refreshUser } = useAuth();
    const { units, setUnits } = useUnits();

    const [step, setStep] = useState("welcome");
    const [weightInput, setWeightInput] = useState("");
    const [bodyFatId, setBodyFatId] = useState(null);
    const [stepsAvg, setStepsAvg] = useState(7000);
    const [stepsCustom, setStepsCustom] = useState("");
    const [liftHrsWeek, setLiftHrsWeek] = useState("");
    const [cardioHrsWeek, setCardioHrsWeek] = useState("");
    const [yearsLifting, setYearsLifting] = useState("1");
    const [benchVal, setBenchVal] = useState("");
    const [squatVal, setSquatVal] = useState("");
    const [hingeVal, setHingeVal] = useState("");
    const [benchVar, setBenchVar] = useState(BENCH_VARS[0]);
    const [squatVar, setSquatVar] = useState(SQUAT_VARS[0]);
    const [hingeVar, setHingeVar] = useState(HINGE_VARS[0]);

    const [tdeeResult, setTdeeResult] = useState(null);
    /** Set when /strength/profile succeeds — shows on result step. */
    const [strengthSnapshot, setStrengthSnapshot] = useState(null);
    const [flowError, setFlowError] = useState("");
    const [continueBusy, setContinueBusy] = useState(false);
    const loadingAttemptRef = useRef(0);

    const switchWeightUnits = (next) => {
        if (next === units) return;
        const w = parseFloat(String(weightInput).replace(",", "."));
        if (Number.isFinite(w)) {
            if (units === "metric" && next === "imperial") {
                setWeightInput((w * LBS_PER_KG).toFixed(1));
            } else if (units === "imperial" && next === "metric") {
                setWeightInput(String(Math.round(w * KG_PER_LB * 100) / 100));
            }
        }
        setUnits(next);
    };

    const idx = STEPS.indexOf(step);
    const progress = step === "result" ? 1 : Math.max(0, idx / (STEPS.length - 2));

    const goNext = useCallback(() => {
        const i = STEPS.indexOf(step);
        if (i >= 0 && i < STEPS.length - 1) {
            setStep(STEPS[i + 1]);
        }
    }, [step]);

    const goBack = useCallback(() => {
        const i = STEPS.indexOf(step);
        if (i > 0 && STEPS[i - 1] !== "loading") {
            setStep(STEPS[i - 1]);
        }
    }, [step]);

    useEffect(() => {
        if (step !== "loading") return undefined;
        const attempt = ++loadingAttemptRef.current;
        let cancelled = false;
        const alive = () => !cancelled && attempt === loadingAttemptRef.current;

        (async () => {
            setFlowError("");
            setStrengthSnapshot(null);
            const date = new Date().toISOString().slice(0, 10);
            const weightKg = displayWeightToKg(weightInput, units);
            const bf = BODY_FAT_OPTIONS.find((o) => o.id === bodyFatId);
            if (weightKg == null || !bf) {
                if (!alive()) return;
                setFlowError("Something was missing. Go back and check your answers.");
                setStep("weight");
                return;
            }

            const stepsVal =
                stepsCustom.trim() !== ""
                    ? Math.max(0, Math.floor(Number(stepsCustom) || 0))
                    : Math.max(0, Math.floor(stepsAvg));

            const liftW = Math.max(0, Number(liftHrsWeek) || 0);
            const cardW = Math.max(0, Number(cardioHrsWeek) || 0);
            const activities = [];
            if (liftW > 0) {
                activities.push({
                    type: "weightlifting",
                    hours: liftW / 7,
                    intensity: "moderate",
                });
            }
            if (cardW > 0) {
                activities.push({
                    type: "cardio",
                    hours: cardW / 7,
                    intensity: "moderate",
                });
            }

            await new Promise((r) => setTimeout(r, 1800));
            if (!alive()) return;

            try {
                const authH = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

                const bodyRes = await fetch("/api/v1/tdee/body-metrics", {
                    method: "POST",
                    headers: authH,
                    body: JSON.stringify({
                        date,
                        weight_kg: weightKg,
                        body_fat_pct: bf.midpoint,
                    }),
                });
                const bodyData = await bodyRes.json().catch(() => ({}));
                if (!alive()) return;
                if (!bodyRes.ok) throw new Error(bodyData.error || "Could not save your profile.");

                const dailyRes = await fetch("/api/v1/tdee/daily", {
                    method: "PUT",
                    headers: authH,
                    body: JSON.stringify({ date, steps: stepsVal, activities }),
                });
                const dailyData = await dailyRes.json().catch(() => ({}));
                if (!alive()) return;
                if (!dailyRes.ok) throw new Error(dailyData.error || "Could not save activity.");

                const sumRes = await fetch(
                    `/api/v1/tdee/summary?date=${encodeURIComponent(date)}&include_formula=1`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const sumData = await sumRes.json().catch(() => ({}));
                if (!alive()) return;
                if (!sumRes.ok) {
                    throw new Error(sumData.error || "Could not calculate your estimate.");
                }
                if (sumData.missingBodyMetric) {
                    throw new Error(sumData.message || "Weight is required for this date.");
                }
                if (sumData.missingBodyFat) {
                    throw new Error(sumData.message || "Body fat is required for the estimate.");
                }
                if (!sumData.breakdown) {
                    throw new Error(sumData.error || "Could not calculate your estimate.");
                }

                const tdeeVal = sumData.breakdown.tdee;
                if (!Number.isFinite(Number(tdeeVal))) {
                    throw new Error("Could not read your estimate. Try again.");
                }

                const baseRes = await fetch("/api/v1/tdee/baseline", {
                    method: "POST",
                    headers: authH,
                    body: JSON.stringify({ baseline_tdee: Number(tdeeVal) }),
                });
                const baseData = await baseRes.json().catch(() => ({}));
                if (!alive()) return;
                if (!baseRes.ok) {
                    throw new Error(baseData.error || "Could not save metabolic baseline.");
                }

                const toLb = (v) => {
                    const n = parseFloat(String(v).replace(",", "."));
                    if (!Number.isFinite(n) || n <= 0) return null;
                    return units === "imperial" ? n : n * LBS_PER_KG;
                };
                const bLb = toLb(benchVal);
                const sLb = toLb(squatVal);
                const hLb = toLb(hingeVal);
                if (bLb == null || sLb == null || hLb == null) {
                    throw new Error("Enter your best recent numbers for bench, squat, and hinge (deadlift/RDL).");
                }

                const strRes = await fetch("/api/v1/strength/profile", {
                    method: "POST",
                    headers: authH,
                    body: JSON.stringify({
                        years_lifting: yearsLifting === "" ? null : Number(yearsLifting),
                        bench_variation: benchVar,
                        bench_lb: bLb,
                        squat_variation: squatVar,
                        squat_lb: sLb,
                        hinge_variation: hingeVar,
                        hinge_lb: hLb,
                    }),
                });
                const strData = await strRes.json().catch(() => ({}));
                if (!alive()) return;
                if (!strRes.ok) {
                    throw new Error(strData.error || "Could not save strength profile.");
                }

                setStrengthSnapshot({
                    overall_level: strData.overall_level,
                    bench_level: strData.bench_level,
                    squat_level: strData.squat_level,
                    hinge_level: strData.hinge_level,
                });
                setTdeeResult(Number(tdeeVal));
                if (!alive()) return;
                setStep("result");
            } catch (e) {
                if (alive()) {
                    setFlowError(e.message || "Something went wrong.");
                    setStep("strength");
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [
        step,
        weightInput,
        units,
        bodyFatId,
        stepsAvg,
        stepsCustom,
        liftHrsWeek,
        cardioHrsWeek,
        yearsLifting,
        benchVal,
        squatVal,
        hingeVal,
        benchVar,
        squatVar,
        hingeVar,
        token,
    ]);

    if (authLoading || !user) {
        return (
            <div style={page}>
                <p style={{ color: "#8e8e93", textAlign: "center", padding: 40 }}>Loading…</p>
            </div>
        );
    }

    if (user.tdee_onboarding_done && !ALLOW_REPEAT_TDEE && step !== "result") {
        return <Navigate to="/dashboard" replace />;
    }

    const handleContinueToApp = async () => {
        setContinueBusy(true);
        try {
            const res = await fetch("/api/v1/auth/tdee-onboarding/complete", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || "Could not finish setup.");
            }
            await refreshUser();
            navigate("/dashboard", { replace: true });
        } catch (e) {
            alert(e.message || "Something went wrong.");
        } finally {
            setContinueBusy(false);
        }
    };

    const canContinueWeight = displayWeightToKg(weightInput, units) != null;
    const canContinueBf = Boolean(bodyFatId);
    const canContinueSteps =
        stepsCustom.trim() !== "" ? Number(stepsCustom) > 0 : stepsAvg > 0;

    const canContinueStrength = (() => {
        const toNum = (v) => parseFloat(String(v).replace(",", "."));
        return (
            [benchVal, squatVal, hingeVal].every((v) => {
                const n = toNum(v);
                return Number.isFinite(n) && n > 0;
            }) && (yearsLifting === "" || Number.isFinite(Number(yearsLifting)))
        );
    })();

    const renderStep = () => {
        if (step === "welcome") {
            return (
                <div style={card}>
                    <p style={kicker}>Energy estimate</p>
                    <h1 style={h1}>Let&apos;s personalize your numbers</h1>
                    <p style={lead}>
                        A few quick questions—one screen at a time. We&apos;ll estimate how many calories you
                        likely burn in a day so you have a starting point.
                    </p>
                    <button type="button" onClick={goNext} style={btnPrimary}>
                        Continue
                    </button>
                </div>
            );
        }

        if (step === "weight") {
            return (
                <div style={card}>
                    <p style={kicker}>Step 1 of 7</p>
                    <h1 style={h1}>What do you weigh?</h1>
                    <p style={lead}>Use your current morning weight if you can.</p>
                    <div style={segmentGroup}>
                        <button
                            type="button"
                            onClick={() => switchWeightUnits("metric")}
                            style={units === "metric" ? segmentActive : segmentIdle}
                        >
                            kg
                        </button>
                        <button
                            type="button"
                            onClick={() => switchWeightUnits("imperial")}
                            style={units === "imperial" ? segmentActive : segmentIdle}
                        >
                            lb
                        </button>
                    </div>
                    <input
                        type="number"
                        step="any"
                        inputMode="decimal"
                        placeholder={units === "imperial" ? "Weight in lb" : "Weight in kg"}
                        value={weightInput}
                        onChange={(e) => setWeightInput(e.target.value)}
                        style={input}
                    />
                    <div style={row}>
                        <button type="button" onClick={goBack} style={btnGhost}>
                            Back
                        </button>
                        <button
                            type="button"
                            disabled={!canContinueWeight}
                            onClick={goNext}
                            style={{
                                ...btnPrimaryFlex,
                                opacity: canContinueWeight ? 1 : 0.45,
                                cursor: canContinueWeight ? "pointer" : "default",
                            }}
                        >
                            Next
                        </button>
                    </div>
                </div>
            );
        }

        if (step === "bodyfat") {
            return (
                <div style={cardWide}>
                    <p style={kicker}>Step 2 of 7</p>
                    <h1 style={h1}>Which look is closest?</h1>
                    <p style={lead}>Pick the range that best matches you right now. No wrong answers.</p>
                    <div style={bfGrid}>
                        {BODY_FAT_OPTIONS.map((o) => (
                            <button
                                key={o.id}
                                type="button"
                                onClick={() => setBodyFatId(o.id)}
                                style={{
                                    ...bfCard,
                                    borderColor: bodyFatId === o.id ? "#007aff" : "#e5e5ea",
                                    backgroundColor: bodyFatId === o.id ? "#f2f8ff" : "#fff",
                                    boxShadow: bodyFatId === o.id ? "0 0 0 2px rgba(0,122,255,0.25)" : "none",
                                }}
                            >
                                <div style={bfSvgWrap}>
                                    <BodySilhouette tier={o.tier} />
                                </div>
                                <span style={bfLabel}>{o.label}</span>
                            </button>
                        ))}
                    </div>
                    <div style={row}>
                        <button type="button" onClick={goBack} style={btnGhost}>
                            Back
                        </button>
                        <button
                            type="button"
                            disabled={!canContinueBf}
                            onClick={goNext}
                            style={{
                                ...btnPrimaryFlex,
                                opacity: canContinueBf ? 1 : 0.45,
                                cursor: canContinueBf ? "pointer" : "default",
                            }}
                        >
                            Next
                        </button>
                    </div>
                </div>
            );
        }

        if (step === "steps") {
            return (
                <div style={card}>
                    <p style={kicker}>Step 3 of 7</p>
                    <h1 style={h1}>Typical daily steps</h1>
                    <p style={lead}>On an average day, about how much do you move outside the gym?</p>
                    <div style={presetRow}>
                        {STEP_PRESETS.map((p) => (
                            <button
                                key={p.label}
                                type="button"
                                onClick={() => {
                                    setStepsAvg(p.steps);
                                    setStepsCustom("");
                                }}
                                style={{
                                    ...presetBtn,
                                    backgroundColor: stepsCustom === "" && stepsAvg === p.steps ? "#000" : "#f2f2f7",
                                    color: stepsCustom === "" && stepsAvg === p.steps ? "#fff" : "#000",
                                }}
                            >
                                {p.label}
                                <span style={presetSub}>{p.steps.toLocaleString()}</span>
                            </button>
                        ))}
                    </div>
                    <label style={label}>Or enter your own</label>
                    <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        placeholder="Average steps per day"
                        value={stepsCustom}
                        onChange={(e) => setStepsCustom(e.target.value)}
                        style={input}
                    />
                    <div style={row}>
                        <button type="button" onClick={goBack} style={btnGhost}>
                            Back
                        </button>
                        <button
                            type="button"
                            disabled={!canContinueSteps}
                            onClick={goNext}
                            style={{
                                ...btnPrimaryFlex,
                                opacity: canContinueSteps ? 1 : 0.45,
                                cursor: canContinueSteps ? "pointer" : "default",
                            }}
                        >
                            Next
                        </button>
                    </div>
                </div>
            );
        }

        if (step === "training") {
            return (
                <div style={card}>
                    <p style={kicker}>Step 4 of 7</p>
                    <h1 style={h1}>Training most weeks</h1>
                    <p style={lead}>Rough weekly hours. Skip or use zero if you don&apos;t do that type.</p>
                    <label style={label}>Weight training (hours / week)</label>
                    <input
                        type="number"
                        step="any"
                        min="0"
                        inputMode="decimal"
                        placeholder="e.g. 4"
                        value={liftHrsWeek}
                        onChange={(e) => setLiftHrsWeek(e.target.value)}
                        style={input}
                    />
                    <label style={label}>Cardio (hours / week)</label>
                    <input
                        type="number"
                        step="any"
                        min="0"
                        inputMode="decimal"
                        placeholder="e.g. 2"
                        value={cardioHrsWeek}
                        onChange={(e) => setCardioHrsWeek(e.target.value)}
                        style={input}
                    />
                    <div style={row}>
                        <button type="button" onClick={goBack} style={btnGhost}>
                            Back
                        </button>
                        <button type="button" onClick={goNext} style={btnPrimaryFlex}>
                            Next
                        </button>
                    </div>
                </div>
            );
        }

        if (step === "experience") {
            return (
                <div style={card}>
                    <p style={kicker}>Step 5 of 7</p>
                    <h1 style={h1}>How long have you been lifting?</h1>
                    <p style={lead}>Total years of serious barbell or gym training (best estimate).</p>
                    <input
                        type="number"
                        step="any"
                        min="0"
                        inputMode="decimal"
                        placeholder="Years"
                        value={yearsLifting}
                        onChange={(e) => setYearsLifting(e.target.value)}
                        style={input}
                    />
                    <div style={row}>
                        <button type="button" onClick={goBack} style={btnGhost}>
                            Back
                        </button>
                        <button type="button" onClick={goNext} style={btnPrimaryFlex}>
                            Next
                        </button>
                    </div>
                </div>
            );
        }

        if (step === "strength") {
            const unitLbl = units === "imperial" ? "lb" : "kg";
            return (
                <div style={cardWide}>
                    <p style={kicker}>Step 6 of 7</p>
                    <h1 style={h1}>Your big lifts</h1>
                    <p style={lead}>
                        Strongest recent numbers for each pattern — heavy working sets or a max attempt. We compare
                        these to your body weight to estimate where you sit overall.
                    </p>
                    <div style={liftPanel}>
                        <div style={liftPanelHeader}>
                            <span style={liftPanelTitle}>Bench</span>
                            <span style={liftPanelHint}>Horizontal press</span>
                        </div>
                        <div style={strengthFieldGrid}>
                            <div style={strengthFieldCol}>
                                <span style={labelInLift}>Variation</span>
                                <select
                                    value={benchVar}
                                    onChange={(e) => setBenchVar(e.target.value)}
                                    style={selectInLift}
                                >
                                    {BENCH_VARS.map((v) => (
                                        <option key={v} value={v}>
                                            {v}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div style={strengthFieldCol}>
                                <span style={labelInLift}>Best weight ({unitLbl})</span>
                                <input
                                    type="number"
                                    step="any"
                                    inputMode="decimal"
                                    placeholder="0"
                                    value={benchVal}
                                    onChange={(e) => setBenchVal(e.target.value)}
                                    style={inputInLift}
                                />
                            </div>
                        </div>
                    </div>
                    <div style={liftPanel}>
                        <div style={liftPanelHeader}>
                            <span style={liftPanelTitle}>Squat</span>
                            <span style={liftPanelHint}>Knee-dominant</span>
                        </div>
                        <div style={strengthFieldGrid}>
                            <div style={strengthFieldCol}>
                                <span style={labelInLift}>Variation</span>
                                <select
                                    value={squatVar}
                                    onChange={(e) => setSquatVar(e.target.value)}
                                    style={selectInLift}
                                >
                                    {SQUAT_VARS.map((v) => (
                                        <option key={v} value={v}>
                                            {v}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div style={strengthFieldCol}>
                                <span style={labelInLift}>Best weight ({unitLbl})</span>
                                <input
                                    type="number"
                                    step="any"
                                    inputMode="decimal"
                                    placeholder="0"
                                    value={squatVal}
                                    onChange={(e) => setSquatVal(e.target.value)}
                                    style={inputInLift}
                                />
                            </div>
                        </div>
                    </div>
                    <div style={liftPanel}>
                        <div style={liftPanelHeader}>
                            <span style={liftPanelTitle}>Hinge</span>
                            <span style={liftPanelHint}>Deadlift, RDL, or trap bar</span>
                        </div>
                        <div style={strengthFieldGrid}>
                            <div style={strengthFieldCol}>
                                <span style={labelInLift}>Variation</span>
                                <select
                                    value={hingeVar}
                                    onChange={(e) => setHingeVar(e.target.value)}
                                    style={selectInLift}
                                >
                                    {HINGE_VARS.map((v) => (
                                        <option key={v} value={v}>
                                            {v}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div style={strengthFieldCol}>
                                <span style={labelInLift}>Best weight ({unitLbl})</span>
                                <input
                                    type="number"
                                    step="any"
                                    inputMode="decimal"
                                    placeholder="0"
                                    value={hingeVal}
                                    onChange={(e) => setHingeVal(e.target.value)}
                                    style={inputInLift}
                                />
                            </div>
                        </div>
                    </div>
                    {flowError ? <div style={errBox}>{flowError}</div> : null}
                    <div style={row}>
                        <button type="button" onClick={goBack} style={btnGhost}>
                            Back
                        </button>
                        <button
                            type="button"
                            disabled={!canContinueStrength}
                            onClick={goNext}
                            style={{
                                ...btnPrimaryFlex,
                                opacity: canContinueStrength ? 1 : 0.45,
                                cursor: canContinueStrength ? "pointer" : "default",
                            }}
                        >
                            Calculate
                        </button>
                    </div>
                </div>
            );
        }

        if (step === "loading") {
            return (
                <div style={cardCenter}>
                    <div style={spinnerRing} />
                    <h2 style={h2Loading}>Working on your estimate…</h2>
                    <p style={leadMuted}>This only takes a moment.</p>
                </div>
            );
        }

        if (step === "result") {
            const s = strengthSnapshot;
            const overallAccent = s?.overall_level ? levelAccent(s.overall_level) : null;
            const chipStyle = (lvl) => {
                const a = levelAccent(lvl);
                return { ...resultLiftChip, backgroundColor: a.bg, color: a.fg };
            };
            return (
                <div style={cardWide}>
                    <div style={resultGlow}>
                        <p style={kicker}>Your starting point</p>
                        <div style={tdeeNumber}>{tdeeResult != null ? tdeeResult.toLocaleString() : "—"}</div>
                        <p style={resultUnit}>estimated daily calories</p>
                    </div>
                    {s?.overall_level && overallAccent ? (
                        <div style={resultStrengthSection}>
                            <p style={resultStrengthKicker}>Strength (vs bodyweight)</p>
                            <div
                                style={{
                                    ...resultOverallBadge,
                                    backgroundColor: overallAccent.bg,
                                    color: overallAccent.fg,
                                }}
                            >
                                {s.overall_level}
                            </div>
                            <p style={resultStrengthCaption}>
                                Each lift is scored vs your body weight using fixed ratio bands for bench, squat, and
                                hinge. Your dashboard will track changes from here.
                            </p>
                            <div style={resultLiftRow}>
                                <span style={chipStyle(s.bench_level)}>Bench · {s.bench_level ?? "—"}</span>
                                <span style={chipStyle(s.squat_level)}>Squat · {s.squat_level ?? "—"}</span>
                                <span style={chipStyle(s.hinge_level)}>Hinge · {s.hinge_level ?? "—"}</span>
                            </div>
                        </div>
                    ) : null}
                    <p style={disclaimer}>
                        Your daily calorie target will update from real data (weight change + logged intake), not from
                        the starting formula. Strength tracking helps estimate muscle vs fat changes on your dashboard.
                    </p>
                    <button
                        type="button"
                        disabled={continueBusy}
                        onClick={handleContinueToApp}
                        style={{
                            ...btnPrimary,
                            opacity: continueBusy ? 0.55 : 1,
                            cursor: continueBusy ? "default" : "pointer",
                        }}
                    >
                        {continueBusy ? "Saving…" : "Continue to app"}
                    </button>
                </div>
            );
        }

        return null;
    };

    return (
        <div style={page}>
            <style>{`
        @keyframes tdeeOnbIn {
          from { opacity: 0; transform: translateX(22px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes tdeeSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
            {step !== "loading" && step !== "result" && (
                <div style={topBar}>
                    {step !== "welcome" ? (
                        <button type="button" onClick={goBack} style={backLink}>
                            ← Back
                        </button>
                    ) : (
                        <span />
                    )}
                    <div style={progressTrack}>
                        <div style={{ ...progressFill, width: `${Math.round(progress * 100)}%` }} />
                    </div>
                </div>
            )}
            <div
                key={step}
                style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "20px 16px 32px",
                    animation: "tdeeOnbIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) both",
                }}
            >
                {renderStep()}
            </div>
        </div>
    );
};

const page = {
    minHeight: "100vh",
    backgroundColor: "#f2f2f7",
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
};

const topBar = {
    padding: "12px 16px 0",
    display: "flex",
    flexDirection: "column",
    gap: 10,
};

const backLink = {
    border: "none",
    background: "none",
    color: "#007aff",
    fontWeight: "600",
    fontSize: "1rem",
    cursor: "pointer",
    alignSelf: "flex-start",
    padding: "4px 0",
};

const progressTrack = {
    height: 4,
    borderRadius: 4,
    backgroundColor: "#e5e5ea",
    overflow: "hidden",
};
const progressFill = {
    height: "100%",
    borderRadius: 4,
    backgroundColor: "#000",
    transition: "width 0.35s ease",
};

const card = {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: "28px 24px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.06)",
    boxSizing: "border-box",
};

const cardWide = {
    ...card,
    maxWidth: 440,
};

const cardCenter = {
    ...card,
    textAlign: "center",
    maxWidth: 340,
};

const kicker = {
    margin: 0,
    fontSize: "0.7rem",
    fontWeight: "800",
    color: "#8e8e93",
    letterSpacing: "1px",
    textTransform: "uppercase",
};

const h1 = {
    margin: "10px 0 12px",
    fontSize: "1.45rem",
    fontWeight: "800",
    letterSpacing: "-0.5px",
    color: "#000",
    lineHeight: 1.25,
};

const h2Loading = {
    margin: "24px 0 8px",
    fontSize: "1.2rem",
    fontWeight: "800",
    color: "#000",
};

const lead = {
    margin: "0 0 22px",
    fontSize: "0.95rem",
    color: "#636366",
    lineHeight: 1.45,
};

const leadMuted = {
    ...lead,
    marginBottom: 0,
};

const label = {
    display: "block",
    fontSize: "0.7rem",
    fontWeight: "700",
    color: "#8e8e93",
    textTransform: "uppercase",
    marginBottom: 8,
    letterSpacing: "0.5px",
};

const input = {
    width: "100%",
    boxSizing: "border-box",
    padding: "14px 16px",
    fontSize: "1.05rem",
    border: "1px solid #e5e5ea",
    borderRadius: 14,
    marginBottom: 16,
    backgroundColor: "#fafafa",
};

const liftPanel = {
    backgroundColor: "#f5f5f7",
    border: "1px solid #e5e5ea",
    borderRadius: 16,
    padding: "14px 14px 16px",
    marginBottom: 12,
    boxSizing: "border-box",
};

const liftPanelHeader = {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    marginBottom: 12,
};

const liftPanelTitle = {
    fontSize: "1.05rem",
    fontWeight: "800",
    color: "#000",
    letterSpacing: "-0.3px",
};

const liftPanelHint = {
    fontSize: "0.78rem",
    fontWeight: "600",
    color: "#8e8e93",
};

const strengthFieldGrid = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    alignItems: "stretch",
};

const strengthFieldCol = {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 6,
};

const labelInLift = {
    fontSize: "0.65rem",
    fontWeight: "700",
    color: "#8e8e93",
    textTransform: "uppercase",
    letterSpacing: "0.4px",
};

const selectInLift = {
    ...selectControlStyle,
    width: "100%",
    minHeight: 44,
};

const inputInLift = {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 14px",
    fontSize: "1rem",
    border: "1px solid #e5e5ea",
    borderRadius: 12,
    backgroundColor: "#fff",
    minHeight: 44,
};

const resultStrengthSection = {
    marginTop: 8,
    marginBottom: 4,
    paddingTop: 18,
    borderTop: "1px solid #e5e5ea",
};

const resultStrengthKicker = {
    margin: "0 0 8px",
    fontSize: "0.7rem",
    fontWeight: "800",
    color: "#8e8e93",
    letterSpacing: "1px",
    textTransform: "uppercase",
};

const resultOverallBadge = {
    display: "inline-block",
    padding: "10px 18px",
    borderRadius: 14,
    fontSize: "1.35rem",
    fontWeight: "900",
    letterSpacing: "-0.4px",
};

const resultStrengthCaption = {
    margin: "10px 0 14px",
    fontSize: "0.88rem",
    color: "#636366",
    lineHeight: 1.45,
};

const resultLiftRow = {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
};

const resultLiftChip = {
    padding: "8px 12px",
    borderRadius: 10,
    fontSize: "0.8rem",
    fontWeight: "700",
};

const segmentGroup = {
    display: "flex",
    borderRadius: 12,
    overflow: "hidden",
    border: "1px solid #d1d1d6",
    marginBottom: 14,
    backgroundColor: "#e5e5ea",
};
const segmentIdle = {
    flex: 1,
    border: "none",
    padding: "10px 14px",
    fontWeight: "700",
    fontSize: "0.9rem",
    backgroundColor: "transparent",
    color: "#636366",
    cursor: "pointer",
};
const segmentActive = {
    ...segmentIdle,
    backgroundColor: "#fff",
    color: "#000",
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
};

const btnPrimary = {
    width: "100%",
    padding: "16px 20px",
    borderRadius: 14,
    border: "none",
    backgroundColor: "#000",
    color: "#fff",
    fontWeight: "800",
    fontSize: "1rem",
    cursor: "pointer",
    marginTop: 8,
};

const btnPrimaryFlex = {
    ...btnPrimary,
    flex: 1,
    marginTop: 0,
    opacity: 1,
};

const btnGhost = {
    flex: 1,
    padding: "16px 20px",
    borderRadius: 14,
    border: "1px solid #d1d1d6",
    backgroundColor: "#fff",
    color: "#007aff",
    fontWeight: "700",
    fontSize: "1rem",
    cursor: "pointer",
};

const row = { display: "flex", gap: 10, marginTop: 8 };

const bfGrid = {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 10,
    marginBottom: 20,
    maxHeight: "52vh",
    overflowY: "auto",
    paddingRight: 4,
};

const bfCard = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "12px 10px",
    borderRadius: 16,
    border: "2px solid #e5e5ea",
    cursor: "pointer",
    textAlign: "center",
    transition: "border-color 0.2s, background-color 0.2s",
};

const bfSvgWrap = {
    marginBottom: 8,
    minHeight: 120,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
};

const bfLabel = {
    fontSize: "0.78rem",
    fontWeight: "600",
    color: "#3a3a3c",
    lineHeight: 1.3,
};

const presetRow = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginBottom: 16,
};

const presetBtn = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "14px 10px",
    borderRadius: 14,
    border: "none",
    fontWeight: "800",
    fontSize: "0.9rem",
    cursor: "pointer",
};

const presetSub = {
    fontSize: "0.75rem",
    fontWeight: "600",
    opacity: 0.85,
    marginTop: 4,
};

const errBox = {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fff2f2",
    color: "#b91c1c",
    fontSize: "0.88rem",
    marginBottom: 12,
};

const spinnerRing = {
    width: 52,
    height: 52,
    margin: "0 auto",
    borderRadius: "50%",
    border: "4px solid #e5e5ea",
    borderTopColor: "#000",
    animation: "tdeeSpin 0.85s linear infinite",
};

const resultGlow = {
    textAlign: "center",
    padding: "8px 0 20px",
};

const tdeeNumber = {
    fontSize: "3.2rem",
    fontWeight: "900",
    letterSpacing: "-2px",
    color: "#000",
    lineHeight: 1,
    marginTop: 8,
};

const resultUnit = {
    margin: "8px 0 0",
    fontSize: "0.95rem",
    color: "#8e8e93",
    fontWeight: "600",
};

const disclaimer = {
    fontSize: "0.88rem",
    color: "#636366",
    lineHeight: 1.5,
    margin: "0 0 20px",
};

export default TdeeOnboarding;
