import { useMemo } from "react";
import { Link } from "react-router-dom";
import { kgToDisplayWeight } from "../units";
import { useUnits } from "../contexts/UnitsContext";
import { useDashboardTrend } from "../hooks/useDashboardTrend";
import { MiniChart } from "./InsightsCharts";

const wrap = {
    margin: "20px 0 8px",
};

const headRow = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
};

const headTitle = {
    margin: 0,
    fontSize: "1.05rem",
    fontWeight: "800",
    color: "#000",
    flex: 1,
    minWidth: 0,
};

const viewAllLink = {
    flexShrink: 0,
    fontSize: "0.82rem",
    fontWeight: "700",
    color: "#007aff",
    textDecoration: "none",
    paddingTop: 2,
};

const stack = {
    display: "flex",
    flexDirection: "column",
    gap: 14,
};

const lightCard = {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: "16px 16px 12px",
    border: "none",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    boxSizing: "border-box",
    overflow: "visible",
};
const cardLink = { textDecoration: "none", color: "inherit", display: "block" };

const topRow = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
};

const labelCol = {
    flex: 1,
    minWidth: 0,
};

const cardKicker = {
    margin: "0 0 4px",
    fontSize: "0.7rem",
    fontWeight: "800",
    color: "#8e8e93",
    letterSpacing: "0.4px",
    textTransform: "uppercase",
};

const cardRange = {
    margin: 0,
    fontSize: "0.78rem",
    color: "#636366",
    lineHeight: 1.3,
};

const statCol = {
    textAlign: "right",
    flexShrink: 0,
};

const cardValue = {
    fontSize: "1.15rem",
    fontWeight: "800",
    color: "#000",
    letterSpacing: "-0.3px",
    lineHeight: 1.2,
};

const emaSub = {
    marginTop: 6,
    fontSize: "0.72rem",
    color: "#8e8e93",
    fontWeight: "600",
};

const foot = {
    marginTop: 14,
    textAlign: "center",
    fontSize: "0.78rem",
    color: "#8e8e93",
};

const footLink = { color: "#007aff", fontWeight: "600", textDecoration: "none" };

const DashboardInsights = ({ token }) => {
    const { units } = useUnits();
    const { data, err, series, stepsVals, weightVals, tdeeVals, rangeLabel } =
        useDashboardTrend(token, 35);
    const sparseHint = data?.sparse_data_hint;

    const lastSteps = stepsVals[stepsVals.length - 1];
    const lastWkg = series.length ? series[series.length - 1]?.weight_kg : null;
    const lastWkgNum = lastWkg != null ? Number(lastWkg) : null;
    const lastTdee = useMemo(
        () => [...tdeeVals].reverse().find((v) => v != null),
        [tdeeVals]
    );

    const weightDisplay =
        lastWkgNum != null
            ? `${kgToDisplayWeight(lastWkgNum, units)} ${units === "imperial" ? "lb" : "kg"}`
            : "—";

    if (!token) return null;
    if (err) {
        return (
            <div style={wrap}>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#b45309" }}>{err}</p>
                <p style={{ ...foot, marginTop: 8 }}>
                    <Link to="/log/calories" style={footLink}>
                        Log calories &amp; steps
                    </Link>
                </p>
            </div>
        );
    }
    if (!data || series.length === 0) return null;

    return (
        <div style={wrap}>
            <div style={headRow}>
                <h2 style={headTitle}>Insights &amp; analytics</h2>
                <Link to="/insights" style={viewAllLink}>
                    Full view
                </Link>
            </div>
            <div style={stack}>
                <Link to="/insights/steps" style={cardLink}>
                <div style={lightCard}>
                    <div style={topRow}>
                        <div style={labelCol}>
                            <p style={cardKicker}>Steps</p>
                            <p style={cardRange}>{rangeLabel}</p>
                        </div>
                        <div style={statCol}>
                            <div style={cardValue}>
                                {lastSteps != null ? `${lastSteps.toLocaleString()}` : "—"}
                            </div>
                            <div style={{ ...cardRange, marginTop: 2 }}>steps</div>
                        </div>
                    </div>
                    <MiniChart values={stepsVals} color="#34c759" fillColor="#34c759" height={58} />
                    <p style={{ margin: "8px 0 0", fontSize: "0.72rem", color: "#8e8e93", fontWeight: "700" }}>
                        Tap chart for detailed view
                    </p>
                </div>
                </Link>

                <Link to="/insights/weight" style={cardLink}>
                <div style={lightCard}>
                    <div style={topRow}>
                        <div style={labelCol}>
                            <p style={cardKicker}>Weight</p>
                            <p style={cardRange}>{rangeLabel}</p>
                        </div>
                        <div style={statCol}>
                            <div style={cardValue}>{weightDisplay}</div>
                        </div>
                    </div>
                    <MiniChart values={weightVals} color="#5856d6" fillColor="#5856d6" height={58} />
                    <p style={{ margin: "8px 0 0", fontSize: "0.72rem", color: "#8e8e93", fontWeight: "700" }}>
                        Tap chart for detailed view
                    </p>
                </div>
                </Link>

                <Link to="/insights/tdee" style={cardLink}>
                <div style={lightCard}>
                    <div style={topRow}>
                        <div style={labelCol}>
                            <p style={cardKicker}>TDEE (expenditure)</p>
                            <p style={cardRange}>
                                From weight, body fat % &amp; steps · {rangeLabel}
                            </p>
                        </div>
                        <div style={statCol}>
                            <div style={cardValue}>
                                {lastTdee != null ? `${lastTdee} kcal` : "—"}
                            </div>
                        </div>
                    </div>
                    <MiniChart values={tdeeVals} color="#ff9500" fillColor="#ff9500" height={58} />
                    {data?.ema_tdee != null ? (
                        <p style={emaSub}>
                            EMA estimate (from intake &amp; trend): {data.ema_tdee} kcal
                        </p>
                    ) : null}
                    <p style={{ margin: "8px 0 0", fontSize: "0.72rem", color: "#8e8e93", fontWeight: "700" }}>
                        Tap chart for detailed view
                    </p>
                </div>
                </Link>
            </div>
            {sparseHint ? (
                <p
                    style={{
                        margin: "0 0 10px",
                        fontSize: "0.78rem",
                        color: "#8a5a00",
                        lineHeight: 1.4,
                    }}
                >
                    {sparseHint}
                </p>
            ) : null}
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

export default DashboardInsights;
