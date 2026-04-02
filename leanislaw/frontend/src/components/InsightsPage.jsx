import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { kgToDisplayWeight } from "../units";
import { useUnits } from "../contexts/UnitsContext";
import { useDashboardTrend } from "../hooks/useDashboardTrend";
import { MiniChart } from "./InsightsCharts";

const page = {
    minHeight: "100vh",
    boxSizing: "border-box",
    backgroundColor: "#f2f2f7",
    padding:
        "calc(12px + env(safe-area-inset-top, 0px)) 16px calc(28px + 62px + env(safe-area-inset-bottom, 0px))",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const header = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 18,
};

const backBtn = {
    border: "none",
    background: "none",
    color: "#007aff",
    fontSize: "1rem",
    fontWeight: "600",
    cursor: "pointer",
    padding: "8px 0",
};

const title = {
    margin: 0,
    fontSize: "1.1rem",
    fontWeight: "800",
    color: "#000",
    textAlign: "center",
    flex: 1,
};

const lead = {
    margin: "0 0 16px",
    fontSize: "0.85rem",
    color: "#636366",
    lineHeight: 1.45,
};

const card = {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: "14px 14px 12px",
    marginBottom: 14,
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    boxSizing: "border-box",
    overflow: "visible",
};
const cardLink = { textDecoration: "none", color: "inherit", display: "block" };
const cardHint = { margin: "8px 0 0", fontSize: "0.72rem", color: "#8e8e93", fontWeight: "700" };

const cardTop = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
};

const kicker = {
    margin: "0 0 4px",
    fontSize: "0.68rem",
    fontWeight: "800",
    color: "#8e8e93",
    letterSpacing: "0.4px",
    textTransform: "uppercase",
};

const range = { margin: 0, fontSize: "0.78rem", color: "#636366" };

const stat = { fontSize: "1.05rem", fontWeight: "800", color: "#000", textAlign: "right" };

const tableWrap = {
    width: "100%",
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
    borderRadius: 12,
    border: "0.5px solid #e5e5ea",
    backgroundColor: "#fff",
    marginBottom: 8,
};

const table = {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "0.78rem",
    minWidth: 520,
};

const th = {
    textAlign: "left",
    padding: "10px 8px",
    backgroundColor: "#f2f2f7",
    color: "#636366",
    fontWeight: "700",
    borderBottom: "0.5px solid #e5e5ea",
    whiteSpace: "nowrap",
};

const td = {
    padding: "9px 8px",
    borderBottom: "0.5px solid #f2f2f7",
    color: "#000",
    verticalAlign: "middle",
};

const rowLink = {
    color: "#007aff",
    fontWeight: "600",
    textDecoration: "none",
    whiteSpace: "nowrap",
};

const foot = {
    marginTop: 10,
    textAlign: "center",
    fontSize: "0.78rem",
    color: "#8e8e93",
};

const footLink = { color: "#007aff", fontWeight: "600", textDecoration: "none" };

const InsightsPage = () => {
    const navigate = useNavigate();
    const { token } = useAuth();
    const { units } = useUnits();
    const { data, err, loading, series, stepsVals, weightVals, tdeeVals, rangeLabel, reload } =
        useDashboardTrend(token, 35);

    const rowsDesc = useMemo(() => {
        if (!series.length) return [];
        const out = series.map((d, i) => ({
            date: d.date,
            steps: d.steps ?? 0,
            calories: d.calories,
            weightKg: weightVals[i],
            tdee: tdeeVals[i],
        }));
        return out.reverse();
    }, [series, weightVals, tdeeVals]);

    const lastSteps = stepsVals[stepsVals.length - 1];
    const lastWkg = series.length ? series[series.length - 1]?.weight_kg : null;
    const lastWkgNum = lastWkg != null ? Number(lastWkg) : null;
    const lastTdee = useMemo(
        () => [...tdeeVals].reverse().find((v) => v != null),
        [tdeeVals]
    );

    const wDisplay =
        lastWkgNum != null
            ? `${kgToDisplayWeight(lastWkgNum, units)} ${units === "imperial" ? "lb" : "kg"}`
            : "—";

    if (!token) return null;

    return (
        <div style={page}>
            <header style={header}>
                <button type="button" style={backBtn} onClick={() => navigate("/dashboard")}>
                    ← Dashboard
                </button>
                <h1 style={title}>Insights</h1>
                <button
                    type="button"
                    style={{ ...backBtn, opacity: loading ? 0.5 : 1 }}
                    onClick={() => reload()}
                    disabled={loading}
                >
                    Refresh
                </button>
            </header>

            <p style={lead}>
                Scroll charts sideways to see the full range ({rangeLabel || "…"}). Open a day to
                edit calories, steps, or weight.
            </p>

            {err ? (
                <p style={{ color: "#b45309", fontSize: "0.9rem" }}>{err}</p>
            ) : loading && !data ? (
                <p style={{ color: "#636366", fontSize: "0.9rem" }}>Loading…</p>
            ) : !data || series.length === 0 ? (
                <p style={{ color: "#636366", fontSize: "0.9rem" }}>No trend data yet.</p>
            ) : (
                <>
                    <Link to="/insights/steps" style={cardLink}>
                    <div style={card}>
                        <div style={cardTop}>
                            <div>
                                <p style={kicker}>Steps</p>
                                <p style={range}>{rangeLabel}</p>
                            </div>
                            <div style={stat}>
                                {lastSteps != null ? lastSteps.toLocaleString() : "—"}
                            </div>
                        </div>
                        <MiniChart
                            values={stepsVals}
                            color="#34c759"
                            fillColor="#34c759"
                            height={72}
                            minPixelWidth={340}
                        />
                        <p style={cardHint}>Tap for detailed chart view</p>
                    </div>
                    </Link>

                    <Link to="/insights/weight" style={cardLink}>
                    <div style={card}>
                        <div style={cardTop}>
                            <div>
                                <p style={kicker}>Weight</p>
                                <p style={range}>{rangeLabel}</p>
                            </div>
                            <div style={stat}>{wDisplay}</div>
                        </div>
                        <MiniChart
                            values={weightVals}
                            color="#5856d6"
                            fillColor="#5856d6"
                            height={72}
                            minPixelWidth={340}
                        />
                        <p style={cardHint}>Tap for detailed chart view</p>
                    </div>
                    </Link>

                    <Link to="/insights/tdee" style={cardLink}>
                    <div style={card}>
                        <div style={cardTop}>
                            <div>
                                <p style={kicker}>TDEE (expenditure)</p>
                                <p style={range}>{rangeLabel}</p>
                            </div>
                            <div style={stat}>
                                {lastTdee != null ? `${lastTdee} kcal` : "—"}
                            </div>
                        </div>
                        <MiniChart
                            values={tdeeVals}
                            color="#ff9500"
                            fillColor="#ff9500"
                            height={72}
                            minPixelWidth={340}
                        />
                        {data?.ema_tdee != null ? (
                            <p
                                style={{
                                    margin: "10px 0 0",
                                    fontSize: "0.72rem",
                                    color: "#8e8e93",
                                    fontWeight: "600",
                                }}
                            >
                                EMA estimate (from intake &amp; trend): {data.ema_tdee} kcal
                            </p>
                        ) : null}
                        <p style={cardHint}>Tap for detailed chart view</p>
                    </div>
                    </Link>

                    <h2
                        style={{
                            fontSize: "0.95rem",
                            fontWeight: "800",
                            margin: "20px 0 10px",
                            color: "#000",
                        }}
                    >
                        Day log
                    </h2>
                    <div style={tableWrap}>
                        <table style={table}>
                            <thead>
                                <tr>
                                    <th style={th}>Date</th>
                                    <th style={{ ...th, textAlign: "right" }}>Steps</th>
                                    <th style={{ ...th, textAlign: "right" }}>Calories</th>
                                    <th style={{ ...th, textAlign: "right" }}>
                                        {units === "imperial" ? "Weight (lb)" : "Weight (kg)"}
                                    </th>
                                    <th style={{ ...th, textAlign: "right" }}>TDEE</th>
                                    <th style={th}>Open</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rowsDesc.map((r) => (
                                    <tr key={r.date}>
                                        <td style={td}>
                                            {new Date(r.date + "T12:00:00").toLocaleDateString(
                                                undefined,
                                                {
                                                    weekday: "short",
                                                    month: "short",
                                                    day: "numeric",
                                                }
                                            )}
                                        </td>
                                        <td style={{ ...td, textAlign: "right" }}>
                                            {r.steps.toLocaleString()}
                                        </td>
                                        <td style={{ ...td, textAlign: "right" }}>
                                            {r.calories != null ? Math.round(r.calories) : "—"}
                                        </td>
                                        <td style={{ ...td, textAlign: "right" }}>
                                            {r.weightKg != null
                                                ? kgToDisplayWeight(r.weightKg, units)
                                                : "—"}
                                        </td>
                                        <td style={{ ...td, textAlign: "right" }}>
                                            {r.tdee != null
                                                ? `${Math.round(r.tdee)}`
                                                : "—"}
                                        </td>
                                        <td style={td}>
                                            <Link
                                                to={`/log/calories?date=${encodeURIComponent(r.date)}`}
                                                style={rowLink}
                                            >
                                                Day
                                            </Link>
                                            {" · "}
                                            <Link
                                                to={`/log/weight?date=${encodeURIComponent(r.date)}`}
                                                style={rowLink}
                                            >
                                                Weight
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            <p style={foot}>
                <Link to="/log/calories" style={footLink}>
                    Log day
                </Link>
                <span style={{ color: "#c7c7cc" }}> · </span>
                <Link to="/log/weight" style={footLink}>
                    Log weight
                </Link>
                <span style={{ color: "#c7c7cc" }}> · </span>
                <Link to="/tdee" style={footLink}>
                    TDEE detail
                </Link>
            </p>
        </div>
    );
};

export default InsightsPage;
