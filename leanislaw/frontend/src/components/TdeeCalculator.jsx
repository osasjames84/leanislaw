import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useUnits } from "../contexts/UnitsContext";
import { authBearerHeaders } from "../apiHeaders";
import { formatSignedDeltaLb } from "../units";

const STRENGTH_LEVEL_ACCENTS = {
    Beginner: { bg: "#ececef", fg: "#3a3a3c" },
    Novice: { bg: "#e8f4fc", fg: "#0b5cab" },
    Intermediate: { bg: "#f3e8ff", fg: "#6b21a8" },
    Advanced: { bg: "#fff4e6", fg: "#b45309" },
    Elite: { bg: "#ecfdf3", fg: "#047857" },
};

function strengthLevelAccent(level) {
    return STRENGTH_LEVEL_ACCENTS[level] ?? { bg: "#ececef", fg: "#3a3a3c" };
}

function StrengthInsightsBlock({ st, styles: s }) {
    const overall = strengthLevelAccent(st.overall_level);
    const chip = (lvl) => {
        const a = strengthLevelAccent(lvl);
        return { ...s.chip, backgroundColor: a.bg, color: a.fg };
    };
    return (
        <>
            <div style={s.divider} />
            <p style={s.kicker}>Strength (vs bodyweight)</p>
            <div
                style={{
                    ...s.badge,
                    backgroundColor: overall.bg,
                    color: overall.fg,
                }}
            >
                {st.overall_level}
            </div>
            <p style={s.hint}>Bench, squat, and hinge vs your weight (from your setup lifts).</p>
            <div style={s.chipRow}>
                <span style={chip(st.bench_level)}>Bench · {st.bench_level ?? "—"}</span>
                <span style={chip(st.squat_level)}>Squat · {st.squat_level ?? "—"}</span>
                <span style={chip(st.hinge_level)}>Hinge · {st.hinge_level ?? "—"}</span>
            </div>
            {st.avg_pct_vs_baseline != null && st.avg_pct_vs_baseline !== 0 ? (
                <p style={s.line}>
                    Since setup:{" "}
                    <strong>
                        {st.avg_pct_vs_baseline > 0 ? "+" : ""}
                        {st.avg_pct_vs_baseline}%
                    </strong>{" "}
                    avg on the big 3
                </p>
            ) : null}
        </>
    );
}

const TdeeCalculator = () => {
    const navigate = useNavigate();
    const { token } = useAuth();
    const { units } = useUnits();
    const [insights, setInsights] = useState(null);
    const [loadError, setLoadError] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!token) {
            setInsights(null);
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        setLoadError("");
        fetch("/api/v1/tdee/insights", { headers: authBearerHeaders(token) })
            .then(async (res) => {
                const data = await res.json().catch(() => ({}));
                if (cancelled) return;
                if (!res.ok) throw new Error(data.error || "Could not load TDEE stats.");
                setInsights(data && !data.error ? data : null);
            })
            .catch((e) => {
                if (!cancelled) {
                    setLoadError(e.message);
                    setInsights(null);
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [token]);

    const ui = insightStyles;

    return (
        <div style={page}>
            <header style={header}>
                <button type="button" onClick={() => navigate("/dashboard")} style={backBtn}>
                    ← Back
                </button>
                <h1 style={title}>TDEE</h1>
                <div style={{ width: 56 }} />
            </header>

            <div style={content}>
                {loading ? (
                    <p style={mutedCenter}>Loading…</p>
                ) : loadError ? (
                    <div style={errBox}>{loadError}</div>
                ) : insights?.dynamicTdee == null ? (
                    <div style={card}>
                        <p style={emptyTitle}>No TDEE stats yet</p>
                        <p style={emptyText}>
                            Finish energy setup and log weight so we can show your live estimate and trends here.
                        </p>
                        <Link to="/dashboard" style={linkBtn}>
                            Back to dashboard
                        </Link>
                    </div>
                ) : (
                    <div style={card}>
                        <p style={ui.kicker}>Metabolism</p>
                        <div style={tdeeHero}>
                            {Math.round(insights.dynamicTdee).toLocaleString()}{" "}
                            <span style={tdeeHeroUnit}>kcal/day</span>
                        </div>
                        <p style={ui.muted}>Live estimate from your logs (not the day-one formula).</p>
                        {insights.metabolic ? (
                            <div style={metaGrid}>
                                {insights.metabolic.baseline_tdee != null ? (
                                    <p style={ui.line}>
                                        Starting baseline:{" "}
                                        <strong>{Math.round(insights.metabolic.baseline_tdee).toLocaleString()}</strong>{" "}
                                        kcal/day
                                    </p>
                                ) : null}
                                {insights.metabolic.ema_tdee != null &&
                                Number(insights.metabolic.ema_tdee) > 0 &&
                                Math.round(insights.metabolic.ema_tdee) !==
                                    Math.round(insights.dynamicTdee) ? (
                                    <p style={ui.line}>
                                        EMA TDEE:{" "}
                                        <strong>
                                            {Math.round(insights.metabolic.ema_tdee).toLocaleString()}
                                        </strong>{" "}
                                        kcal/day
                                    </p>
                                ) : null}
                                {insights.metabolic.ema_intake != null ? (
                                    <p style={ui.line}>
                                        Smoothed intake ≈{" "}
                                        <strong>
                                            {Math.round(insights.metabolic.ema_intake).toLocaleString()}
                                        </strong>{" "}
                                        kcal/day
                                    </p>
                                ) : null}
                            </div>
                        ) : null}

                        <div style={ui.divider} />
                        <p style={ui.kicker}>This month</p>
                        {insights.monthly ? (
                            <>
                                <p style={ui.line}>
                                    Weight trend ≈ {formatSignedDeltaLb(insights.monthly.weight_delta_lb, units)}
                                    {insights.monthly.log_days != null ? (
                                        <span style={subtle}>
                                            {" "}
                                            ({insights.monthly.log_days} weigh-in
                                            {insights.monthly.log_days === 1 ? "" : "s"})
                                        </span>
                                    ) : null}
                                </p>
                                <p style={ui.line}>
                                    Est. muscle {formatSignedDeltaLb(insights.monthly.estimated_muscle_lb, units)} ·
                                    fat {formatSignedDeltaLb(insights.monthly.estimated_fat_lb, units)}
                                </p>
                                {insights.monthly.note ? (
                                    <p style={{ ...ui.muted, marginTop: 10 }}>{insights.monthly.note}</p>
                                ) : null}
                            </>
                        ) : null}

                        {insights.strength ? (
                            <StrengthInsightsBlock st={insights.strength} styles={ui} />
                        ) : null}
                    </div>
                )}

                <p style={{ textAlign: "center", marginTop: 24, lineHeight: 1.8 }}>
                    <Link to="/dashboard" style={link}>
                        Dashboard
                    </Link>
                    <span style={{ color: "#c7c7cc" }}> · </span>
                    <Link to="/macros" style={link}>
                        Macros
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

const content = { padding: "20px 16px 40px", maxWidth: 480, margin: "0 auto" };

const mutedCenter = { color: "#8e8e93", textAlign: "center", padding: "24px 0" };

const errBox = {
    padding: 14,
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
    borderRadius: 14,
    fontSize: "0.9rem",
};

const card = {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
};

const tdeeHero = {
    fontSize: "2rem",
    fontWeight: "900",
    letterSpacing: "-0.5px",
    margin: "4px 0 0",
};

const tdeeHeroUnit = { fontSize: "0.9rem", fontWeight: "700", color: "#8e8e93" };

const metaGrid = { marginTop: 4 };

const subtle = { color: "#8e8e93", fontWeight: "600", fontSize: "0.85rem" };

const emptyTitle = { margin: "0 0 8px", fontSize: "1.1rem", fontWeight: "800" };

const emptyText = { margin: 0, color: "#636366", lineHeight: 1.45, fontSize: "0.95rem" };

const linkBtn = {
    display: "inline-block",
    marginTop: 16,
    color: "#007aff",
    fontWeight: "700",
    textDecoration: "none",
};

const link = { color: "#007aff", fontWeight: "600", textDecoration: "none" };

const insightStyles = {
    kicker: {
        fontSize: "0.65rem",
        fontWeight: "800",
        color: "#8e8e93",
        letterSpacing: "1px",
        textTransform: "uppercase",
        margin: "0 0 8px",
    },
    muted: {
        fontSize: "0.85rem",
        color: "#636366",
        margin: "8px 0 0",
        lineHeight: 1.4,
    },
    line: {
        fontSize: "0.9rem",
        color: "#1c1c1e",
        margin: "6px 0 0",
        lineHeight: 1.35,
    },
    divider: { height: 1, background: "#f2f2f7", margin: "14px 0" },
    badge: {
        display: "inline-block",
        padding: "10px 16px",
        borderRadius: 12,
        fontSize: "1.2rem",
        fontWeight: "900",
        letterSpacing: "-0.3px",
        marginTop: 2,
    },
    hint: {
        fontSize: "0.82rem",
        color: "#636366",
        margin: "10px 0 12px",
        lineHeight: 1.4,
    },
    chipRow: { display: "flex", flexWrap: "wrap", gap: 8 },
    chip: {
        padding: "7px 11px",
        borderRadius: 999,
        fontSize: "0.78rem",
        fontWeight: "700",
    },
};

export default TdeeCalculator;
