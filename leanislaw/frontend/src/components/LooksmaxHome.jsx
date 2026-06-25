import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authBearerHeaders } from "../apiHeaders";

/**
 * The Ascension screen — the gamified home. Looksmax score ring, Sub-5 → GODCHAD
 * rank, streak flame, XP/level, daily quests, AI coach line, pillar breakdown,
 * and achievements. Bold dark "game" theme (stands apart from the iOS-light app).
 */

const TIER_COLORS = ["#8e8e93", "#5ac8fa", "#30d158", "#ffd60a", "#ff9f0a", "#ff375f"];
const QUEST_ROUTES = { log_workout: "/workout", log_food: "/macros", log_weight: "/log/weight", checkin: "/me/week" };

const page = {
    minHeight: "100vh",
    background: "radial-gradient(1200px 600px at 50% -10%, #1b2233 0%, #0b0d12 55%, #07080b 100%)",
    color: "#fff",
    padding: "calc(20px + env(safe-area-inset-top, 0px)) 16px calc(100px + env(safe-area-inset-bottom, 0px))",
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
};
const glass = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 18, padding: 16, marginBottom: 14, backdropFilter: "blur(6px)" };
const label = { fontSize: "0.7rem", fontWeight: 800, letterSpacing: 1, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" };

function ScoreRing({ score, color }) {
    const r = 88, c = 2 * Math.PI * r;
    const off = c * (1 - Math.max(0, Math.min(100, score)) / 100);
    return (
        <svg viewBox="0 0 200 200" style={{ width: 220, height: 220 }}>
            <defs>
                <linearGradient id="lm-grad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={color} />
                    <stop offset="100%" stopColor="#fff" stopOpacity="0.85" />
                </linearGradient>
            </defs>
            <circle cx="100" cy="100" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="14" />
            <circle cx="100" cy="100" r={r} fill="none" stroke="url(#lm-grad)" strokeWidth="14" strokeLinecap="round"
                strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 100 100)" style={{ transition: "stroke-dashoffset 1s ease" }} />
            <text x="100" y="96" textAnchor="middle" fontSize="56" fontWeight="800" fill="#fff">{score}</text>
            <text x="100" y="124" textAnchor="middle" fontSize="13" fontWeight="700" fill="rgba(255,255,255,0.55)" letterSpacing="2">LOOKSMAX</text>
        </svg>
    );
}

function PillarBar({ name, value, max, color }) {
    return (
        <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: 4 }}>
                <span style={{ color: "rgba(255,255,255,0.7)", textTransform: "capitalize" }}>{name}</span>
                <span style={{ color: "rgba(255,255,255,0.5)" }}>{value}/{max}</span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(value / max) * 100}%`, background: color, borderRadius: 999, transition: "width .8s ease" }} />
            </div>
        </div>
    );
}

export default function LooksmaxHome() {
    const navigate = useNavigate();
    const { token } = useAuth();
    const [j, setJ] = useState(null);
    const [err, setErr] = useState("");

    const load = useCallback(async () => {
        try {
            const d = await fetch("/api/v1/looksmax/me/journey", { headers: authBearerHeaders(token) }).then((r) => r.json());
            if (d.error) setErr(d.error); else setJ(d);
        } catch { setErr("Could not load your ascension."); }
    }, [token]);
    useEffect(() => { if (token) load(); }, [token, load]);

    if (err) return <div style={page}><div style={glass}>{err}</div></div>;
    if (!j) return <div style={{ ...page, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "rgba(255,255,255,0.5)" }}>Loading your ascension…</span></div>;

    const color = TIER_COLORS[j.rank.tier] || TIER_COLORS[0];
    const pillarColors = { training: "#ff375f", nutrition: "#30d158", body: "#5ac8fa", consistency: "#ffd60a" };
    const remaining = j.quests.filter((q) => !q.done);

    return (
        <div style={page}>
            <h1 style={{ margin: "4px 0 2px", fontSize: "1.5rem", fontWeight: 900, letterSpacing: -0.5 }}>Ascension</h1>
            <p style={{ margin: "0 0 14px", color: "rgba(255,255,255,0.45)", fontSize: "0.85rem" }}>Lose fat. Build muscle. Mog yesterday.</p>

            {/* unlocked toast */}
            {j.achievements_unlocked?.length ? (
                <div style={{ ...glass, background: "linear-gradient(135deg, rgba(255,55,95,0.25), rgba(255,159,10,0.2))", borderColor: "rgba(255,159,10,0.4)", display: "flex", alignItems: "center", gap: 10 }}>
                    <i className="ti ti-trophy" style={{ fontSize: 22, color: "#ffd60a" }} aria-hidden="true" />
                    <div><div style={{ fontWeight: 800 }}>Achievement unlocked!</div><div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.7)" }}>{j.achievements_unlocked.map((a) => a.label).join(" · ")}</div></div>
                </div>
            ) : null}

            {/* hero: ring + rank */}
            <div style={{ ...glass, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 22, paddingBottom: 18 }}>
                <ScoreRing score={j.score} color={color} />
                <div style={{ marginTop: 6, padding: "5px 16px", borderRadius: 999, background: `${color}22`, border: `1px solid ${color}66`, color, fontWeight: 800, letterSpacing: 1, fontSize: "1rem" }}>
                    {j.rank.name.toUpperCase()}
                </div>
                <div style={{ marginTop: 8, fontSize: "0.82rem", color: "rgba(255,255,255,0.6)", textAlign: "center" }}>{j.rank.blurb}</div>
                {j.rank.next ? (
                    <div style={{ marginTop: 10, fontSize: "0.78rem", color: "rgba(255,255,255,0.45)" }}>
                        {j.rank.next.at - j.score} pts to <b style={{ color: "rgba(255,255,255,0.8)" }}>{j.rank.next.name}</b>
                    </div>
                ) : <div style={{ marginTop: 10, fontSize: "0.78rem", color }}>Max rank. Untouchable.</div>}
            </div>

            {/* coach line */}
            {j.coach?.line ? (
                <div style={{ ...glass, display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <i className="ti ti-flame" style={{ fontSize: 20, color: "#ff9f0a", marginTop: 2 }} aria-hidden="true" />
                    <div>
                        <div style={{ ...label, marginBottom: 3 }}>Coach{j.coach.ai ? " · Claude" : ""}</div>
                        <div style={{ fontSize: "0.95rem", lineHeight: 1.4, fontWeight: 600 }}>{j.coach.line}</div>
                    </div>
                </div>
            ) : null}

            {/* streak + level row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div style={{ ...glass, margin: 0, textAlign: "center" }}>
                    <div style={{ fontSize: "2.2rem", fontWeight: 900, lineHeight: 1 }}>🔥 {j.streak}</div>
                    <div style={{ ...label, marginTop: 6 }}>Day streak</div>
                    <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", marginTop: 3 }}>Best {j.best_streak}</div>
                </div>
                <div style={{ ...glass, margin: 0, textAlign: "center" }}>
                    <div style={{ fontSize: "2.2rem", fontWeight: 900, lineHeight: 1 }}>LV {j.level}</div>
                    <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden", margin: "10px 4px 6px" }}>
                        <div style={{ height: "100%", width: `${(j.level_into / j.level_span) * 100}%`, background: "#5ac8fa", borderRadius: 999 }} />
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)" }}>{j.level_to_next} XP to LV {j.level + 1}</div>
                </div>
            </div>

            {/* quests */}
            <div style={glass}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <span style={label}>Today's quests</span>
                    <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)" }}>{j.quests.length - remaining.length}/{j.quests.length} done</span>
                </div>
                {j.quests.map((q) => (
                    <button key={q.key} type="button" onClick={() => navigate(QUEST_ROUTES[q.key] || "/dashboard")} style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: "1px solid rgba(255,255,255,0.07)", cursor: "pointer" }}>
                        <span style={{ width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: q.done ? "#30d15822" : "rgba(255,255,255,0.06)", color: q.done ? "#30d158" : "#fff", flexShrink: 0 }}>
                            <i className={`ti ${q.done ? "ti-check" : q.icon}`} aria-hidden="true" style={{ fontSize: 17 }} />
                        </span>
                        <span style={{ flex: 1 }}>
                            <span style={{ fontWeight: 700, color: q.done ? "rgba(255,255,255,0.5)" : "#fff", textDecoration: q.done ? "line-through" : "none" }}>{q.label}</span>
                        </span>
                        <span style={{ fontSize: "0.78rem", fontWeight: 800, color: q.done ? "rgba(255,255,255,0.3)" : "#ffd60a" }}>+{q.xp} XP</span>
                        {!q.done ? <i className="ti ti-chevron-right" aria-hidden="true" style={{ color: "rgba(255,255,255,0.3)" }} /> : null}
                    </button>
                ))}
            </div>

            {/* pillar breakdown */}
            <div style={glass}>
                <div style={{ ...label, marginBottom: 12 }}>Score breakdown</div>
                {Object.keys(j.breakdown).map((k) => <PillarBar key={k} name={k} value={j.breakdown[k]} max={j.max[k]} color={pillarColors[k]} />)}
            </div>

            {/* achievements */}
            <div style={glass}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <span style={label}>Achievements</span>
                    <button type="button" onClick={() => navigate("/leaderboard")} style={{ border: "none", background: "none", color: "#5ac8fa", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer" }}>Leaderboard →</button>
                </div>
                {j.achievements?.length ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))", gap: 10 }}>
                        {j.achievements.map((a) => (
                            <div key={a.code} title={a.desc} style={{ textAlign: "center" }}>
                                <div style={{ width: 48, height: 48, margin: "0 auto", borderRadius: 14, background: "linear-gradient(135deg, rgba(255,214,10,0.25), rgba(255,159,10,0.15))", border: "1px solid rgba(255,214,10,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <i className={`ti ${a.icon}`} aria-hidden="true" style={{ fontSize: 22, color: "#ffd60a" }} />
                                </div>
                                <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.6)", marginTop: 4, lineHeight: 1.15 }}>{a.label}</div>
                            </div>
                        ))}
                    </div>
                ) : <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.4)" }}>Complete quests to earn your first badge.</div>}
            </div>
        </div>
    );
}
