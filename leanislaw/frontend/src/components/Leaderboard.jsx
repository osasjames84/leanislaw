import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authBearerHeaders } from "../apiHeaders";

const accent = "#007aff";
const bgPage = "#f2f2f7";
const card = "#fff";
const border = "#e5e5ea";
const borderStrong = "#d1d1d6";
const textLabel = "#3a3a3c";
const textSecondary = "#636366";

function Avatar({ src, name, size = 44 }) {
    const [broken, setBroken] = useState(false);
    const initials = String(name || "?")
        .split(/\s+/)
        .map((s) => s[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
    if (broken) {
        return (
            <div
                style={{
                    width: size,
                    height: size,
                    borderRadius: 6,
                    background: "#e5e5ea",
                    border: `2px solid ${borderStrong}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: size > 40 ? "0.75rem" : "0.65rem",
                    fontWeight: "800",
                    color: accent,
                    flexShrink: 0,
                }}
                aria-hidden
            >
                {initials}
            </div>
        );
    }
    return (
        <img
            src={src}
            alt=""
            width={size}
            height={size}
            style={{
                width: size,
                height: size,
                borderRadius: 6,
                objectFit: "cover",
                border: `2px solid ${borderStrong}`,
                flexShrink: 0,
                background: "#e5e5ea",
            }}
            onError={() => setBroken(true)}
        />
    );
}

const Leaderboard = () => {
    const navigate = useNavigate();
    const { token } = useAuth();
    const [scope, setScope] = useState("global");
    const [data, setData] = useState(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        if (!token) {
            setData(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`/api/v1/leaderboard/global`, {
                headers: authBearerHeaders(token),
            });
            const j = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(j.error || "Could not load leaderboard");
            setData(j);
        } catch (e) {
            setError(e.message);
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        load();
    }, [load]);

    const fmtSteps = (score) => Number(score || 0).toLocaleString();

    const subtitle = data
        ? `Sum of logged steps — last ${data.windowDays} days · Global`
        : "Global steps leaderboard";

    return (
        <div style={page}>
            <header style={topBar}>
                <button type="button" style={homeBtn} onClick={() => navigate("/dashboard")} aria-label="Home">
                    Home
                </button>
                <h1 style={topTitle}>Leaderboard</h1>
                <button
                    type="button"
                    style={helpBtn}
                    title="Rank uses the sum of daily step entries in your log over the window."
                    aria-label="Help"
                >
                    ?
                </button>
            </header>

            <div style={bodyRow}>
                <main style={mainPanel}>
                    <div style={tabRow}>
                        <button
                            type="button"
                            style={{ ...tabBtn, ...(scope === "global" ? tabBtnOn : {}) }}
                            onClick={() => setScope("global")}
                        >
                            Global
                        </button>
                        <button
                            type="button"
                            style={{ ...tabBtn, ...(scope === "regional" ? tabBtnOn : {}) }}
                            onClick={() => setScope("regional")}
                        >
                            Regional ▸
                        </button>
                    </div>
                    <p style={subMuted}>{subtitle}</p>

                    {loading ? <p style={muted}>Loading…</p> : null}
                    {error ? <div style={errBox}>{error}</div> : null}

                    {!loading && !error && scope === "regional" ? (
                        <div style={emptyRegional}>
                            <p style={emptyTitle}>Regional leaderboards</p>
                            <p style={emptyText}>Not set up yet — check back later.</p>
                        </div>
                    ) : null}

                    {!loading && !error && scope === "global" && data ? (
                        <>
                            <div style={tableScroll}>
                                <div style={tableHead}>
                                    <span style={thRank}>Rank</span>
                                    <span style={thPlayer}>Player</span>
                                    <span style={thSteps}>Steps</span>
                                </div>
                                <ul style={tableList}>
                                    {data.entries.length === 0 ? (
                                        <li style={emptyRow}>No users yet.</li>
                                    ) : (
                                        data.entries.map((e) => (
                                            <li
                                                key={e.userId}
                                                style={{
                                                    ...tableRow,
                                                    ...(e.isYou ? tableRowYou : {}),
                                                }}
                                            >
                                                <span style={rankCell}>{e.rank}</span>
                                                <div style={playerCell}>
                                                    <Avatar src={e.avatarUrl} name={e.displayName} />
                                                    <div style={playerText}>
                                                        <span style={playerName}>{e.displayName}</span>
                                                        {e.isYou ? <span style={youTag}>You</span> : null}
                                                    </div>
                                                </div>
                                                <div style={scoreCell}>
                                                    <span style={scoreBadge} aria-hidden>
                                                        ◆
                                                    </span>
                                                    <span style={scoreNum}>{fmtSteps(e.score)}</span>
                                                </div>
                                            </li>
                                        ))
                                    )}
                                </ul>
                            </div>
                            {data.totalRanked > data.entries.length ? (
                                <p style={topHint}>
                                    Showing top {data.entries.length} of {data.totalRanked} athletes.
                                </p>
                            ) : null}
                        </>
                    ) : null}

                    {data?.me && scope === "global" ? (
                        <footer style={meBar}>
                            <div style={meInner}>
                                <span style={meRankLabel}>
                                    {data.me.rank != null ? `#${data.me.rank}` : "—"}
                                </span>
                                <Avatar src={data.me.avatarUrl} name={data.me.displayName} size={40} />
                                <div style={meText}>
                                    <span style={meName}>{data.me.displayName}</span>
                                    <span style={meSub}>Your rank · Global</span>
                                </div>
                                <div style={meScoreBlock}>
                                    <span style={meScoreLabel}>Steps</span>
                                    <span style={meScoreBig}>{fmtSteps(data.me.score)}</span>
                                </div>
                            </div>
                        </footer>
                    ) : null}
                </main>
            </div>
        </div>
    );
};

const page = {
    minHeight: "100vh",
    boxSizing: "border-box",
    backgroundColor: bgPage,
    color: "#000",
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif',
    paddingBottom: "calc(16px + 62px + env(safe-area-inset-bottom, 0px))",
};

const topBar = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "calc(12px + env(safe-area-inset-top, 0px)) 16px 12px",
    borderBottom: `1px solid ${border}`,
    background: card,
};

const topTitle = {
    margin: 0,
    fontSize: "1rem",
    fontWeight: "700",
    color: "#000",
    flex: 1,
    textAlign: "center",
};

const homeBtn = {
    padding: "6px 10px",
    borderRadius: 8,
    border: "none",
    background: "transparent",
    color: accent,
    fontWeight: "600",
    fontSize: "1rem",
    cursor: "pointer",
    flexShrink: 0,
    WebkitTapHighlightColor: "transparent",
};

const helpBtn = {
    width: 28,
    height: 28,
    borderRadius: 6,
    border: `1px solid ${border}`,
    background: "#f2f2f7",
    color: accent,
    fontWeight: "700",
    fontSize: "0.85rem",
    cursor: "help",
    flexShrink: 0,
};

const bodyRow = {
    display: "flex",
    flex: 1,
    minHeight: 0,
    alignItems: "stretch",
};

const mainPanel = {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    padding: "10px 12px 0",
};

const tabRow = {
    display: "flex",
    gap: 8,
    marginBottom: 8,
};

const tabBtn = {
    padding: "8px 14px",
    borderRadius: 8,
    border: `1px solid ${border}`,
    background: card,
    color: textSecondary,
    fontSize: "0.8rem",
    fontWeight: "600",
    cursor: "pointer",
};

const tabBtnOn = {
    background: "rgba(0, 122, 255, 0.12)",
    color: accent,
    borderColor: "rgba(0, 122, 255, 0.35)",
};

const subMuted = {
    margin: "0 0 10px",
    fontSize: "0.75rem",
    color: textSecondary,
    lineHeight: 1.35,
};

const muted = { color: textSecondary, fontSize: "0.85rem", padding: "10px 0" };

const errBox = {
    padding: 10,
    borderRadius: 8,
    background: "rgba(255, 59, 48, 0.1)",
    border: "1px solid rgba(255, 59, 48, 0.25)",
    color: "#c00",
    fontSize: "0.82rem",
    marginBottom: 10,
};

const tableScroll = {
    flex: 1,
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    border: `1px solid ${border}`,
    borderRadius: 12,
    background: card,
    maxHeight: "calc(100vh - 280px)",
};

const tableHead = {
    display: "grid",
    gridTemplateColumns: "44px 1fr 88px",
    gap: 8,
    padding: "10px 12px",
    borderBottom: `1px solid ${border}`,
    fontSize: "0.65rem",
    fontWeight: "600",
    letterSpacing: "0.02em",
    textTransform: "uppercase",
    color: textLabel,
    position: "sticky",
    top: 0,
    background: card,
    zIndex: 1,
};

const thRank = { textAlign: "left" };
const thPlayer = { textAlign: "left" };
const thSteps = { textAlign: "right" };

const tableList = {
    listStyle: "none",
    margin: 0,
    padding: 0,
};

const tableRow = {
    display: "grid",
    gridTemplateColumns: "44px 1fr 88px",
    gap: 8,
    alignItems: "center",
    padding: "10px 12px",
    borderBottom: `1px solid ${border}`,
};

const tableRowYou = {
    background: "rgba(0, 122, 255, 0.08)",
};

const rankCell = {
    fontSize: "1.05rem",
    fontWeight: "800",
    color: "#000",
    fontVariantNumeric: "tabular-nums",
};

const playerCell = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
};

const playerText = {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
};

const playerName = {
    fontSize: "0.82rem",
    fontWeight: "600",
    color: "#000",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

const youTag = {
    fontSize: "0.58rem",
    fontWeight: "700",
    color: accent,
    letterSpacing: "0.04em",
};

const scoreCell = {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
};

const scoreBadge = {
    fontSize: "0.65rem",
    color: textSecondary,
    opacity: 0.95,
};

const scoreNum = {
    fontSize: "0.88rem",
    fontWeight: "700",
    color: accent,
    fontVariantNumeric: "tabular-nums",
};

const emptyRow = {
    padding: 24,
    textAlign: "center",
    color: textSecondary,
    fontSize: "0.88rem",
};

const emptyRegional = {
    padding: 36,
    textAlign: "center",
    border: `1px dashed ${borderStrong}`,
    borderRadius: 12,
    marginTop: 8,
    background: card,
};

const emptyTitle = {
    margin: "0 0 8px",
    fontWeight: "700",
    color: "#000",
    fontSize: "0.9rem",
};

const emptyText = { margin: 0, color: textSecondary, fontSize: "0.82rem" };

const topHint = {
    margin: "8px 0 0",
    fontSize: "0.65rem",
    color: textSecondary,
    textAlign: "center",
};

const meBar = {
    marginTop: "auto",
    paddingTop: 10,
    paddingBottom: 4,
};

const meInner = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 12px",
    border: `1px solid ${border}`,
    borderRadius: 12,
    background: card,
};

const meRankLabel = {
    fontSize: "0.95rem",
    fontWeight: "800",
    color: accent,
    minWidth: 36,
    fontVariantNumeric: "tabular-nums",
};

const meText = { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 };

const meName = {
    fontSize: "0.85rem",
    fontWeight: "700",
    color: "#000",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

const meSub = { fontSize: "0.62rem", color: textSecondary, fontWeight: "600" };

const meScoreBlock = { textAlign: "right" };

const meScoreLabel = {
    display: "block",
    fontSize: "0.55rem",
    fontWeight: "700",
    letterSpacing: "0.06em",
    color: textSecondary,
    textTransform: "uppercase",
};

const meScoreBig = {
    fontSize: "1.1rem",
    fontWeight: "800",
    color: accent,
    fontVariantNumeric: "tabular-nums",
};

export default Leaderboard;
