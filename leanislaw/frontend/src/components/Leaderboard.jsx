import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authBearerHeaders } from "../apiHeaders";

const Leaderboard = () => {
    const navigate = useNavigate();
    const { token } = useAuth();
    const [data, setData] = useState(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!token) {
            setData(null);
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        setError("");
        fetch("/api/v1/leaderboard/workouts", { headers: authBearerHeaders(token) })
            .then(async (res) => {
                const j = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(j.error || "Could not load leaderboard");
                if (!cancelled) setData(j);
            })
            .catch((e) => {
                if (!cancelled) setError(e.message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [token]);

    return (
        <div style={page}>
            <header style={header}>
                <button type="button" onClick={() => navigate("/dashboard")} style={backBtn}>
                    ← Home
                </button>
                <h1 style={title}>Leaderboard</h1>
                <div style={{ width: 72 }} />
            </header>

            <div style={content}>
                <p style={lead}>Completed workouts (templates excluded). Keep training to climb the ranks.</p>

                {loading ? <p style={muted}>Loading…</p> : null}
                {error ? <div style={errBox}>{error}</div> : null}

                {data && !loading ? (
                    <>
                        <div style={youCard}>
                            <p style={youLabel}>You</p>
                            <p style={youBig}>
                                {data.myWorkoutCount}{" "}
                                <span style={youSub}>workout{data.myWorkoutCount === 1 ? "" : "s"}</span>
                            </p>
                            {data.myRank != null ? (
                                <p style={youRank}>Rank #{data.myRank}</p>
                            ) : (
                                <p style={youRankMuted}>Log a workout to get ranked</p>
                            )}
                        </div>

                        <p style={listKicker}>Top 50</p>
                        <ul style={list}>
                            {data.entries.length === 0 ? (
                                <li style={emptyRow}>No finished workouts yet. Start from the dashboard.</li>
                            ) : (
                                data.entries.map((e) => (
                                    <li
                                        key={e.userId}
                                        style={{
                                            ...row,
                                            backgroundColor: e.isYou ? "rgba(0, 122, 255, 0.08)" : "#fff",
                                            borderColor: e.isYou ? "#007aff" : "#e5e5ea",
                                        }}
                                    >
                                        <span style={rankBadge}>{e.rank}</span>
                                        <span style={name}>{e.displayName}</span>
                                        <span style={count}>{e.workoutCount}</span>
                                    </li>
                                ))
                            )}
                        </ul>
                    </>
                ) : null}

                <p style={footer}>
                    <Link to="/workoutSessions" style={link}>
                        Start a workout
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
    padding: "calc(14px + env(safe-area-inset-top, 0px)) 16px 14px",
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

const lead = {
    margin: "0 0 18px",
    fontSize: "0.92rem",
    color: "#636366",
    lineHeight: 1.45,
};

const muted = { color: "#8e8e93", textAlign: "center", padding: "16px 0" };

const errBox = {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
    fontSize: "0.9rem",
    marginBottom: 14,
};

const youCard = {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
    border: "1px solid #e5e5ea",
};

const youLabel = {
    margin: 0,
    fontSize: "0.65rem",
    fontWeight: "800",
    color: "#8e8e93",
    letterSpacing: "1px",
    textTransform: "uppercase",
};

const youBig = {
    margin: "8px 0 0",
    fontSize: "1.75rem",
    fontWeight: "900",
    letterSpacing: "-0.5px",
};

const youSub = { fontSize: "0.95rem", fontWeight: "700", color: "#8e8e93" };

const youRank = { margin: "6px 0 0", fontSize: "0.95rem", fontWeight: "700", color: "#007aff" };

const youRankMuted = { margin: "6px 0 0", fontSize: "0.88rem", color: "#8e8e93" };

const listKicker = {
    margin: "0 0 10px",
    fontSize: "0.65rem",
    fontWeight: "800",
    color: "#8e8e93",
    letterSpacing: "1px",
    textTransform: "uppercase",
};

const list = { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 };

const row = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 14px",
    borderRadius: 14,
    border: "1px solid #e5e5ea",
};

const emptyRow = {
    ...row,
    color: "#636366",
    fontSize: "0.92rem",
    justifyContent: "center",
};

const rankBadge = {
    minWidth: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#f2f2f7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "800",
    fontSize: "0.85rem",
};

const name = { flex: 1, fontWeight: "700", fontSize: "0.95rem" };

const count = { fontWeight: "800", color: "#007aff", fontSize: "0.95rem" };

const footer = { textAlign: "center", marginTop: 28 };

const link = { color: "#007aff", fontWeight: "600", textDecoration: "none" };

export default Leaderboard;
