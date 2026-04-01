import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authBearerHeaders } from "../apiHeaders";
import { useUnits } from "../contexts/UnitsContext";
import { displayWeightToKg, kgToDisplayWeight, KG_PER_LB, LBS_PER_KG } from "../units";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const LogWeight = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { token } = useAuth();
    const { units, setUnits } = useUnits();
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

    useEffect(() => {
        const q = searchParams.get("date");
        if (q && DATE_RE.test(q)) setDate(q);
    }, [searchParams]);
    const [weightInput, setWeightInput] = useState("");
    const [bodyFat, setBodyFat] = useState("");
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState("");
    const [saveHint, setSaveHint] = useState("");

    const loadForDate = useCallback(async () => {
        if (!token) return;
        setLoadError("");
        try {
            const res = await fetch("/api/v1/tdee/body-metrics?limit=60", {
                headers: { Authorization: `Bearer ${token}` },
            });
            const rows = await res.json().catch(() => []);
            if (!res.ok) throw new Error(rows.error || "Could not load metrics");
            const row = Array.isArray(rows) ? rows.find((r) => String(r.date).slice(0, 10) === date) : null;
            if (row) {
                setWeightInput(kgToDisplayWeight(row.weight_kg, units));
                setBodyFat(row.body_fat_pct != null ? String(row.body_fat_pct) : "");
            } else {
                setWeightInput("");
                setBodyFat("");
            }
        } catch (e) {
            setLoadError(e.message);
        }
    }, [date, token, units]);

    useEffect(() => {
        loadForDate();
    }, [loadForDate]);

    const switchUnits = (next) => {
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

    const save = async (e) => {
        e.preventDefault();
        const weightKg = displayWeightToKg(weightInput, units);
        if (weightKg == null) {
            setLoadError(units === "imperial" ? "Enter a valid weight in pounds." : "Enter a valid weight in kg.");
            return;
        }
        setSaving(true);
        setSaveHint("");
        setLoadError("");
        try {
            const res = await fetch("/api/v1/tdee/body-metrics", {
                method: "POST",
                headers: { ...authBearerHeaders(token), "Content-Type": "application/json" },
                body: JSON.stringify({
                    date,
                    weight_kg: weightKg,
                    body_fat_pct: bodyFat === "" ? null : bodyFat,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Save failed");
            setSaveHint("Saved. Strength tiers use your latest weight.");
            await loadForDate();
        } catch (err) {
            setLoadError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={page}>
            <header style={header}>
                <button type="button" onClick={() => navigate("/dashboard")} style={backBtn}>
                    ← Home
                </button>
                <h1 style={title}>Log weight</h1>
                <div style={{ width: 72 }} />
            </header>

            <div style={content}>
                <div style={unitRow}>
                    <span style={unitLabel}>Units</span>
                    <div style={segmentGroup}>
                        <button
                            type="button"
                            onClick={() => switchUnits("metric")}
                            style={units === "metric" ? segmentActive : segmentIdle}
                        >
                            Metric
                        </button>
                        <button
                            type="button"
                            onClick={() => switchUnits("imperial")}
                            style={units === "imperial" ? segmentActive : segmentIdle}
                        >
                            Imperial
                        </button>
                    </div>
                </div>

                <p style={lead}>Morning weight is best. Body fat % is optional but improves TDEE detail.</p>

                {loadError ? <div style={errBox}>{loadError}</div> : null}
                {saveHint ? <div style={okBox}>{saveHint}</div> : null}

                <form onSubmit={save} style={form}>
                    <label style={label}>Date</label>
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        style={input}
                    />

                    <label style={label}>{units === "imperial" ? "Weight (lb)" : "Weight (kg)"}</label>
                    <input
                        style={input}
                        placeholder={ units === "imperial" ? "e.g. 185" : "e.g. 84" }
                        value={weightInput}
                        onChange={(e) => setWeightInput(e.target.value)}
                        inputMode="decimal"
                    />

                    <label style={label}>Body fat % (optional)</label>
                    <input
                        style={input}
                        placeholder="e.g. 15"
                        value={bodyFat}
                        onChange={(e) => setBodyFat(e.target.value)}
                        inputMode="decimal"
                    />

                    <button type="submit" disabled={saving} style={btn}>
                        {saving ? "Saving…" : "Save entry"}
                    </button>
                </form>

                <p style={footer}>
                    <Link to="/tdee" style={link}>
                        View TDEE & metabolism
                    </Link>
                </p>
            </div>
        </div>
    );
};

const page = {
    minHeight: "100vh",
    backgroundColor: "#f2f2f7",
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
};

const header = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px",
    backgroundColor: "#fff",
    borderBottom: "0.5px solid #d1d1d6",
    position: "sticky",
    top: 0,
    zIndex: 5,
};

const backBtn = {
    border: "none",
    background: "none",
    fontSize: "1rem",
    color: "#007aff",
    fontWeight: "600",
    cursor: "pointer",
    padding: "4px 0",
};

const title = { margin: 0, fontSize: "1.05rem", fontWeight: "800" };

const content = { padding: "20px 16px 32px", maxWidth: 480, margin: "0 auto" };

const unitRow = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
};

const unitLabel = {
    fontSize: "0.75rem",
    fontWeight: "700",
    color: "#8e8e93",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
};

const segmentGroup = {
    display: "flex",
    borderRadius: 10,
    overflow: "hidden",
    border: "1px solid #d1d1d6",
    backgroundColor: "#e5e5ea",
};

const segmentIdle = {
    border: "none",
    padding: "8px 14px",
    fontSize: "0.85rem",
    fontWeight: "600",
    color: "#636366",
    backgroundColor: "transparent",
    cursor: "pointer",
};

const segmentActive = {
    ...segmentIdle,
    backgroundColor: "#fff",
    color: "#000",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
};

const lead = {
    margin: "0 0 18px",
    fontSize: "0.92rem",
    color: "#636366",
    lineHeight: 1.45,
};

const form = { display: "flex", flexDirection: "column", gap: 4 };

const label = {
    display: "block",
    fontSize: "0.68rem",
    fontWeight: "800",
    color: "#8e8e93",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginTop: 10,
    marginBottom: 6,
};

const input = {
    width: "100%",
    boxSizing: "border-box",
    padding: "14px 16px",
    fontSize: "1rem",
    border: "1px solid #e5e5ea",
    borderRadius: 14,
    backgroundColor: "#fff",
};

const btn = {
    marginTop: 20,
    width: "100%",
    padding: "16px 18px",
    borderRadius: 14,
    border: "none",
    backgroundColor: "#000",
    color: "#fff",
    fontWeight: "800",
    fontSize: "1rem",
    cursor: "pointer",
};

const errBox = {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
    fontSize: "0.9rem",
    marginBottom: 12,
};

const okBox = {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#ecfdf3",
    color: "#047857",
    fontSize: "0.9rem",
    marginBottom: 12,
    fontWeight: "600",
};

const footer = { textAlign: "center", marginTop: 28 };

const link = { color: "#007aff", fontWeight: "600", textDecoration: "none" };

export default LogWeight;
