import { Link, useNavigate, useParams } from "react-router-dom";
import { useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useUnits } from "../contexts/UnitsContext";
import { useDashboardTrend } from "../hooks/useDashboardTrend";
import { MiniChart } from "./InsightsCharts";
import { kgToDisplayWeight } from "../units";

const pageWrap = {
    minHeight: "100vh",
    boxSizing: "border-box",
    backgroundColor: "#f2f2f7",
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
    paddingBottom: "calc(24px + 62px + env(safe-area-inset-bottom, 0px))",
};

const navBar = {
    position: "sticky",
    top: 0,
    zIndex: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: "calc(14px + env(safe-area-inset-top, 0px)) 12px 12px",
    backgroundColor: "#fff",
    borderBottom: "0.5px solid #d1d1d6",
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

const navTitle = {
    margin: 0,
    fontSize: "1.05rem",
    fontWeight: "800",
    letterSpacing: "-0.2px",
    color: "#000",
    textAlign: "center",
    flex: 1,
    minWidth: 0,
};

const navSpacer = { width: 80, flexShrink: 0 };

const content = {
    padding: "12px 16px 0",
};

const METRICS = {
    steps: {
        title: "Steps",
        color: "#34c759",
        fill: "#34c759",
        unit: "steps",
        help: "Daily step count from day logs and TDEE inputs.",
        link: "/log/calories",
        linkLabel: "Log steps",
    },
    weight: {
        title: "Weight",
        color: "#5856d6",
        fill: "#5856d6",
        unit: "weight",
        help: "Bodyweight trend from your daily weigh-ins.",
        link: "/log/weight",
        linkLabel: "Log weight",
    },
    tdee: {
        title: "TDEE (expenditure)",
        color: "#ff9500",
        fill: "#ff9500",
        unit: "kcal",
        help: "Estimated expenditure based on weight, body fat %, and steps.",
        link: "/tdee",
        linkLabel: "Open TDEE detail",
    },
};

const InsightDetailPage = () => {
    const navigate = useNavigate();
    const { metric } = useParams();
    const key = METRICS[metric] ? metric : "steps";
    const cfg = METRICS[key];
    const { token } = useAuth();
    const { units } = useUnits();
    const { series, stepsVals, weightVals, tdeeVals, rangeLabel } = useDashboardTrend(token, 35);

    const values = key === "steps" ? stepsVals : key === "weight" ? weightVals : tdeeVals;
    const lastIndex = values.length - 1;

    const lastValue = useMemo(() => {
        if (!values.length) return null;
        for (let i = values.length - 1; i >= 0; i--) {
            if (values[i] != null) return values[i];
        }
        return null;
    }, [values]);

    const recentRows = useMemo(() => {
        return series
            .map((row, i) => ({
                date: row.date,
                value: key === "steps" ? row.steps : key === "weight" ? weightVals[i] : tdeeVals[i],
            }))
            .reverse()
            .slice(0, 14);
    }, [series, key, weightVals, tdeeVals]);

    function fmt(v) {
        if (v == null) return "—";
        if (key === "weight") return `${kgToDisplayWeight(v, units)} ${units === "imperial" ? "lb" : "kg"}`;
        if (key === "steps") return `${Math.round(v).toLocaleString()} steps`;
        return `${Math.round(v)} kcal`;
    }

    return (
        <div style={pageWrap}>
            <header style={navBar}>
                <button type="button" onClick={() => navigate("/insights")} style={backBtn} aria-label="Back to Insights">
                    ← Insights
                </button>
                <h1 style={navTitle}>{cfg.title}</h1>
                <span style={navSpacer} aria-hidden />
            </header>

            <div style={content}>
            <div style={{ background: "#fff", borderRadius: 16, padding: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                <p style={{ margin: "0 0 4px", fontSize: "0.72rem", color: "#8e8e93", fontWeight: 800, letterSpacing: "0.4px", textTransform: "uppercase" }}>
                    {cfg.title}
                </p>
                <p style={{ margin: "0 0 10px", color: "#636366", fontSize: "0.8rem" }}>{rangeLabel}</p>
                <p style={{ margin: "0 0 12px", color: "#000", fontSize: "1.2rem", fontWeight: 800 }}>{fmt(lastValue)}</p>
                <MiniChart
                    values={values}
                    color={cfg.color}
                    fillColor={cfg.fill}
                    height={190}
                    minPixelWidth={700}
                    activeIndex={lastIndex}
                />
                <p style={{ margin: "10px 0 0", color: "#636366", fontSize: "0.82rem", lineHeight: 1.45 }}>
                    {cfg.help}
                </p>
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                <Link to={cfg.link} style={{ flex: 1, textAlign: "center", textDecoration: "none", background: "#fff", color: "#007aff", fontWeight: 700, padding: "12px 10px", borderRadius: 12, border: "1px solid #d1d1d6" }}>
                    {cfg.linkLabel}
                </Link>
                <Link to="/insights" style={{ flex: 1, textAlign: "center", textDecoration: "none", background: "#fff", color: "#1c1c1e", fontWeight: 700, padding: "12px 10px", borderRadius: 12, border: "1px solid #d1d1d6" }}>
                    All charts
                </Link>
            </div>

            <h2 style={{ margin: "18px 0 8px", fontSize: "0.95rem", fontWeight: 800 }}>Recent entries</h2>
            <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", border: "0.5px solid #e5e5ea" }}>
                {recentRows.map((row, idx) => {
                    return (
                        <div key={`${row.date}-${idx}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderBottom: idx === 13 ? "none" : "0.5px solid #f2f2f7" }}>
                            <span style={{ color: "#636366", fontSize: "0.78rem" }}>{new Date(row.date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
                            <span style={{ fontWeight: 700, fontSize: "0.84rem" }}>{fmt(row.value)}</span>
                        </div>
                    );
                })}
            </div>
            </div>
        </div>
    );
};

export default InsightDetailPage;
