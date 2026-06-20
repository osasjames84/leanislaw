import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authBearerHeaders, authJsonHeaders } from "../apiHeaders";

const STATUS = {
    needs_attention: { label: "Needs attention", bg: "var(--cc-na-bg)", fg: "var(--cc-na-fg)" },
    watch: { label: "Watch", bg: "var(--cc-watch-bg)", fg: "var(--cc-watch-fg)" },
    on_track: { label: "On track", bg: "var(--cc-ot-bg)", fg: "var(--cc-ot-fg)" },
};
const STATUS_ORDER = { needs_attention: 0, watch: 1, on_track: 2 };

function statusColor(p) {
    if (p == null) return "var(--cc-text3)";
    return p >= 80 ? "var(--cc-success)" : p >= 50 ? "var(--cc-warning)" : "var(--cc-danger)";
}

function initials(name = "") {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

async function openBlob(url, token, onErr) {
    try {
        const r = await fetch(url, { headers: authBearerHeaders(token) });
        if (!r.ok) return onErr && onErr("Could not open that file.");
        const u = URL.createObjectURL(await r.blob());
        window.open(u, "_blank");
        setTimeout(() => URL.revokeObjectURL(u), 60000);
    } catch {
        onErr && onErr("Could not open that file.");
    }
}

/* ---------------- shared UI ---------------- */

function Pill({ status, small }) {
    const s = STATUS[status] || { label: status, bg: "var(--cc-panel2)", fg: "var(--cc-text2)" };
    return (
        <span style={{ background: s.bg, color: s.fg, borderRadius: 999, padding: small ? "2px 8px" : "3px 9px", fontSize: small ? 11 : 12, fontWeight: 600, whiteSpace: "nowrap", letterSpacing: 0.1 }}>
            {s.label}
        </span>
    );
}

function Avatar({ name, status, size = 28 }) {
    const s = STATUS[status] || { bg: "var(--cc-accent-bg)", fg: "var(--cc-accent)" };
    return (
        <div style={{ width: size, height: size, borderRadius: "50%", background: s.bg, color: s.fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size < 30 ? 11 : 13, fontWeight: 600, flexShrink: 0 }}>
            {initials(name)}
        </div>
    );
}

function Bar({ pct }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 110 }}>
            <div style={{ flex: 1, height: 8, borderRadius: 999, background: "var(--cc-track)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(100, pct ?? 0)}%`, background: statusColor(pct), borderRadius: 999 }} />
            </div>
            <span style={{ color: "var(--cc-text2)", fontSize: 12, fontWeight: 500, width: 30, textAlign: "right" }}>{pct ?? "—"}%</span>
        </div>
    );
}

function StatCard({ label, value, color }) {
    return (
        <div style={{ background: "var(--cc-panel2)", border: "1px solid var(--cc-border)", borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 12, color: "var(--cc-text2)", fontWeight: 500 }}>{label}</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: color || "var(--cc-text)", marginTop: 4 }}>{value}</div>
        </div>
    );
}

function AlertBanner({ text }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--cc-na-bg)", border: "1px solid var(--cc-danger)", color: "var(--cc-na-fg)", borderRadius: 10, padding: "10px 12px", fontSize: 13, fontWeight: 500 }}>
            <i className="ti ti-alert-triangle" aria-hidden="true" style={{ fontSize: 16, flexShrink: 0 }} />
            {text}
        </div>
    );
}

function Empty({ text }) {
    return <p style={{ color: "var(--cc-text3)", fontSize: 13, margin: "6px 0" }}>{text}</p>;
}

function MiniWeight({ series }) {
    const pts = (series || []).filter((p) => p.weight != null);
    if (pts.length < 2) return <Empty text="Not enough weight data this week" />;
    const w = 520, h = 150, pad = 28;
    const vals = pts.map((p) => p.weight);
    const min = Math.min(...vals), max = Math.max(...vals), rng = max - min || 1;
    const x = (i) => pad + (i * (w - 2 * pad)) / (pts.length - 1);
    const y = (v) => h - pad - ((v - min) / rng) * (h - 2 * pad);
    const d = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.weight).toFixed(1)}`).join(" ");
    return (
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%" }}>
            <path d={d} fill="none" strokeWidth="2.5" style={{ stroke: "var(--cc-accent)" }} />
            {pts.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.weight)} r="3" style={{ fill: "var(--cc-accent)" }} />)}
            <text x={pad} y={15} fontSize="11" style={{ fill: "var(--cc-text3)" }}>{max}kg</text>
            <text x={pad} y={h - 8} fontSize="11" style={{ fill: "var(--cc-text3)" }}>{min}kg</text>
        </svg>
    );
}

function MiniNutrition({ days, target }) {
    if (!days || !days.length) return <Empty text="No nutrition logged this week" />;
    const w = 520, h = 150, pad = 28;
    const max = Math.max(target || 0, ...days.map((d) => d.calories)) * 1.12 || 1;
    const bw = (w - 2 * pad) / days.length;
    const ty = target ? h - pad - (target / max) * (h - 2 * pad) : null;
    return (
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%" }}>
            {days.map((d, i) => {
                const bh = (d.calories / max) * (h - 2 * pad);
                const over = target && d.calories > target;
                return <rect key={i} x={pad + i * bw + 4} y={h - pad - bh} width={bw - 8} height={bh} rx="3" style={{ fill: over ? "var(--cc-danger)" : "var(--cc-success)" }} />;
            })}
            {ty != null ? <line x1={pad} y1={ty} x2={w - pad} y2={ty} strokeDasharray="4 3" style={{ stroke: "var(--cc-text3)" }} /> : null}
            {ty != null ? <text x={w - pad} y={ty - 5} fontSize="11" textAnchor="end" style={{ fill: "var(--cc-text3)" }}>target {target}</text> : null}
        </svg>
    );
}

/* ---------------- sidebar ---------------- */

const THEME_META = {
    auto: { icon: "ti-device-desktop", label: "System theme" },
    dark: { icon: "ti-moon", label: "Dark" },
    light: { icon: "ti-sun", label: "Light" },
};

const navStyle = (active) => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    fontSize: 13.5,
    fontWeight: active ? 600 : 500,
    color: active ? "var(--cc-accent)" : "var(--cc-text2)",
    background: active ? "var(--cc-accent-bg)" : "transparent",
    borderRadius: 8,
    cursor: "pointer",
    border: "none",
    width: "100%",
    textAlign: "left",
});

function Sidebar({ active, onOpenDashboard, theme, onCycleTheme }) {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const tm = THEME_META[theme] || THEME_META.auto;
    const nav = [
        { key: "clients", label: "Clients", icon: "ti-users", onClick: () => navigate("/coach") },
        { key: "reports", label: "Reports", icon: "ti-file-text", onClick: onOpenDashboard },
        { key: "checkins", label: "Check-ins", icon: "ti-clipboard-check" },
        { key: "messages", label: "Messages", icon: "ti-message" },
        { key: "settings", label: "Settings", icon: "ti-settings" },
    ];
    return (
        <aside style={{ width: 248, flexShrink: 0, background: "var(--cc-sidebar)", borderRight: "1px solid var(--cc-border)", height: "100vh", position: "sticky", top: 0, display: "flex", flexDirection: "column", padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 8px 12px" }}>
                <div style={{ width: 24, height: 24, borderRadius: 7, background: "var(--cc-accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>L</div>
                <span style={{ fontWeight: 700, fontSize: 14, color: "var(--cc-text)" }}>Lean is Law</span>
            </div>
            <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {nav.map((it) => (
                    <button key={it.key} type="button" className="cc-nav" style={navStyle(active === it.key)} onClick={it.onClick || (() => {})}>
                        <i className={`ti ${it.icon}`} aria-hidden="true" style={{ fontSize: 17, width: 17 }} />
                        {it.label}
                    </button>
                ))}
            </nav>

            <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                <button type="button" className="cc-nav" style={navStyle(false)} onClick={onCycleTheme} aria-label={`Theme: ${tm.label}`}>
                    <i className={`ti ${tm.icon}`} aria-hidden="true" style={{ fontSize: 17, width: 17 }} />
                    {tm.label}
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px", borderTop: "1px solid var(--cc-border)", paddingTop: 12 }}>
                    <Avatar name={`${user?.first_name || ""} ${user?.last_name || ""}`} size={32} />
                    <div style={{ minWidth: 0, flex: 1, lineHeight: 1.25 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--cc-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {user?.first_name} {user?.last_name}
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--cc-text3)" }}>Coach</div>
                    </div>
                    <button type="button" onClick={() => { logout(); navigate("/login", { replace: true }); }} aria-label="Log out" style={{ border: "none", background: "none", color: "var(--cc-text3)", cursor: "pointer", padding: 4, fontSize: 16 }}>
                        <i className="ti ti-logout" aria-hidden="true" />
                    </button>
                </div>
            </div>
        </aside>
    );
}

/* ---------------- client details panel ---------------- */

const TABS = ["Overview", "Metrics", "Nutrition", "Check-ins", "Reports"];

function DetailsPanel({ token, clientId, weekParam, onErr }) {
    const [data, setData] = useState(null);
    const [sg, setSg] = useState(null);
    const [history, setHistory] = useState([]);
    const [tab, setTab] = useState("Overview");
    const qs = weekParam ? `?week=${encodeURIComponent(weekParam)}` : "";

    useEffect(() => {
        if (clientId == null) return;
        let cancelled = false;
        (async () => {
            try {
                const [rep, safe, hist] = await Promise.all([
                    fetch(`/api/v1/reports/clients/${clientId}/report${qs}`, { headers: authBearerHeaders(token) }).then((r) => r.json()),
                    fetch(`/api/v1/reports/clients/${clientId}/safeguarding`, { headers: authBearerHeaders(token) }).then((r) => r.json()),
                    fetch(`/api/v1/reports/clients/${clientId}/reports`, { headers: authBearerHeaders(token) }).then((r) => r.json()),
                ]);
                if (cancelled) return;
                setData(rep.error ? null : rep);
                if (!safe.error) setSg(safe);
                if (Array.isArray(hist)) setHistory(hist);
            } catch { /* non-fatal */ }
        })();
        return () => { cancelled = true; };
    }, [clientId, qs, token]);

    const saveSafe = async (patch) => {
        await fetch(`/api/v1/reports/clients/${clientId}/safeguarding`, { method: "PUT", headers: authJsonHeaders(token), body: JSON.stringify(patch) });
        const d = await fetch(`/api/v1/reports/clients/${clientId}/safeguarding`, { headers: authBearerHeaders(token) }).then((r) => r.json());
        if (!d.error) setSg(d);
    };

    const card = { background: "var(--cc-panel)", border: "1px solid var(--cc-border)", borderRadius: 14, padding: 16 };

    if (!data) {
        return <div style={card}><Empty text="Select a client to see details." /></div>;
    }
    if (!data.has_report) {
        return (
            <div style={card}>
                <p style={{ margin: 0, color: "var(--cc-text2)", fontSize: 13 }}>
                    No report for this client for the week of {data.week_start}. Tap <strong style={{ color: "var(--cc-text)" }}>Generate reports</strong>.
                </p>
            </div>
        );
    }

    const m = data.model;
    const topFlag = (data.flags || []).find((f) => /low|fast|no check|high stress/i.test(f));

    return (
        <div style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                <Avatar name={m.name} status={data.status} size={34} />
                <div style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: "var(--cc-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: "var(--cc-text3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.goal} · week of {data.week_start}</div>
                </div>
                <Pill status={data.status} />
                {data.has_pdf ? (
                    <button type="button" onClick={() => openBlob(`/api/v1/reports/${data.report_id}/pdf`, token, onErr)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--cc-accent)", color: "var(--cc-on-accent)", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        <i className="ti ti-download" aria-hidden="true" style={{ fontSize: 15 }} /> PDF
                    </button>
                ) : null}
            </div>

            <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--cc-border)", marginBottom: 14 }}>
                {TABS.map((t) => (
                    <button key={t} type="button" onClick={() => setTab(t)} style={{ border: "none", background: "none", padding: "7px 10px", fontSize: 13, fontWeight: tab === t ? 600 : 500, color: tab === t ? "var(--cc-accent)" : "var(--cc-text2)", borderBottom: tab === t ? "2px solid var(--cc-accent)" : "2px solid transparent", cursor: "pointer", marginBottom: -1 }}>
                        {t}
                    </button>
                ))}
            </div>

            {tab === "Overview" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {topFlag ? <AlertBanner text={topFlag} /> : null}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                        <StatCard label="Weight change" value={m.body?.trend ? `${m.body.trend.change > 0 ? "+" : ""}${m.body.trend.change} kg` : "—"} color={m.body?.trend && m.body.trend.pct_change <= -1.5 ? "var(--cc-danger)" : undefined} />
                        <StatCard label="Training sessions" value={`${m.training?.completed ?? 0} / ${m.training?.assigned ?? 0}`} />
                        <StatCard label="Nutrition compliance" value={`${m.nutrition?.log_adherence ?? 0}%`} />
                        <StatCard label="Logged days" value={`${m.nutrition?.logged_days ?? 0} / ${m.nutrition?.target_days ?? 7}`} />
                    </div>
                </div>
            ) : null}

            {tab === "Metrics" ? (
                <div>
                    <MiniWeight series={m.body?.weight_series} />
                    {m.body?.trend ? (
                        <p style={{ fontSize: 13, color: "var(--cc-text2)", marginTop: 8 }}>
                            {m.body.trend.start} → {m.body.trend.end} {m.body.unit} ({m.body.trend.change > 0 ? "+" : ""}{m.body.trend.change}, {m.body.trend.pct_change}%)
                        </p>
                    ) : null}
                </div>
            ) : null}

            {tab === "Nutrition" ? (
                <div>
                    <MiniNutrition days={m.nutrition?.days} target={m.nutrition?.target_calories} />
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 12 }}>
                        <StatCard label="Target calories" value={m.nutrition?.target_calories ?? "—"} />
                        <StatCard label="Avg calories" value={m.nutrition?.avg_calories ?? "—"} />
                        <StatCard label="Protein target" value={m.nutrition?.target_protein_g ? `${m.nutrition.target_protein_g} g` : "—"} />
                        <StatCard label="Protein hit-rate" value={`${m.nutrition?.protein_hit_rate ?? 0}%`} />
                    </div>
                </div>
            ) : null}

            {tab === "Check-ins" ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                        {m.checkin?.submitted ? (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                <StatCard label="Sleep" value={`${m.checkin.sleep_h ?? "—"} h`} />
                                <StatCard label="Energy" value={`${m.checkin.energy_1to5 ?? "—"} / 5`} />
                                <StatCard label="Stress" value={`${m.checkin.stress_1to5 ?? "—"} / 5`} />
                                <StatCard label="Steps avg" value={m.checkin.steps_avg ?? "—"} />
                            </div>
                        ) : <Empty text="No check-in submitted this week." />}
                        {m.checkin?.notes ? <p style={{ fontStyle: "italic", color: "var(--cc-text2)", fontSize: 13, marginTop: 10 }}>“{m.checkin.notes}”</p> : null}
                    </div>
                    <div style={{ background: "var(--cc-panel2)", border: "1px solid var(--cc-border)", borderRadius: 10, padding: 12 }}>
                        <div style={{ fontSize: 12, color: "var(--cc-text2)", fontWeight: 600, marginBottom: 6 }}>Duty of care</div>
                        {sg ? (
                            <>
                                <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", fontSize: 13, color: "var(--cc-text)" }}>
                                    Hide raw numbers (client app)
                                    <input type="checkbox" checked={!!sg.hide_raw_numbers} onChange={(e) => saveSafe({ hide_raw_numbers: e.target.checked })} />
                                </label>
                                <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", fontSize: 13, color: "var(--cc-text)" }}>
                                    Support region
                                    <select value={sg.support_region || "UK"} onChange={(e) => saveSafe({ support_region: e.target.value })} style={{ background: "var(--cc-panel)", color: "var(--cc-text)", border: "1px solid var(--cc-border)", borderRadius: 6, padding: "4px 6px", fontSize: 12 }}>
                                        <option value="UK">UK</option><option value="US">US</option><option value="AU">AU</option>
                                    </select>
                                </label>
                                <div style={{ fontSize: 11.5, color: "var(--cc-text3)", marginTop: 4 }}>
                                    Intake {sg.screen_completed ? "completed" : "not completed"}.
                                </div>
                            </>
                        ) : <Empty text="Loading…" />}
                    </div>
                </div>
            ) : null}

            {tab === "Reports" ? (
                <div>
                    {history.length ? history.map((h) => (
                        <div key={h.report_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--cc-border)" }}>
                            <Pill status={h.status} small />
                            <span style={{ flex: 1, fontSize: 13, color: "var(--cc-text)" }}>Week of {h.week_start}</span>
                            {h.has_pdf ? (
                                <button type="button" onClick={() => openBlob(`/api/v1/reports/${h.report_id}/pdf`, token, onErr)} style={{ border: "none", background: "none", color: "var(--cc-accent)", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>PDF</button>
                            ) : <span style={{ color: "var(--cc-text3)" }}>—</span>}
                        </div>
                    )) : <Empty text="No reports generated yet." />}
                </div>
            ) : null}
        </div>
    );
}

/* ---------------- dashboard ---------------- */

function Dashboard({ token, routeClientId }) {
    const navigate = useNavigate();
    const [week, setWeek] = useState("");
    const [roster, setRoster] = useState(null);
    const [err, setErr] = useState("");
    const [busy, setBusy] = useState(false);
    const [addOpen, setAddOpen] = useState(false);
    const [newClient, setNewClient] = useState("");
    const [query, setQuery] = useState("");
    const qs = week ? `?week=${encodeURIComponent(week)}` : "";

    const loadRoster = useCallback(async () => {
        setErr("");
        try {
            const d = await fetch(`/api/v1/reports/roster${qs}`, { headers: authBearerHeaders(token) }).then((r) => r.json());
            if (d.error) setErr(d.error); else setRoster(d);
        } catch { setErr("Could not load roster."); }
    }, [token, qs]);

    useEffect(() => { loadRoster(); }, [loadRoster]);

    const runReports = async () => {
        setBusy(true); setErr("");
        try {
            const d = await fetch("/api/v1/reports/run", { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify(week ? { week_start: week } : {}) }).then((r) => r.json());
            if (d.error) setErr(d.error); else await loadRoster();
        } catch { setErr("Report run failed."); } finally { setBusy(false); }
    };

    const addClient = async () => {
        const val = newClient.trim();
        if (!val) return;
        const body = /^\d+$/.test(val) ? { client_id: Number(val) } : { username: val };
        const d = await fetch("/api/v1/reports/clients", { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify(body) }).then((r) => r.json());
        if (d.error) setErr(d.error); else { setNewClient(""); setAddOpen(false); await loadRoster(); }
    };

    const s = roster?.summary;
    const rows = [...(roster?.clients || [])]
        .filter((c) => !query || String(c.name).toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) || String(a.name).localeCompare(String(b.name)));
    const selectedId = routeClientId != null ? Number(routeClientId) : rows[0]?.client_id ?? null;

    const ctrl = { background: "var(--cc-panel)", border: "1px solid var(--cc-border)", borderRadius: 8, color: "var(--cc-text)", fontSize: 13 };
    const kpiCards = s ? [["needs_attention", "Needs attention", s.needs_attention], ["watch", "Watch", s.watch], ["on_track", "On track", s.on_track]] : [];

    return (
        <main style={{ flex: 1, minWidth: 0, height: "100vh", overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
            {/* header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, rowGap: 8, flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--cc-text)" }}>Clients</h1>
                <span style={{ fontSize: 12.5, color: "var(--cc-text3)", whiteSpace: "nowrap" }}>{roster ? `${roster.week_start} → ${roster.week_end}` : "…"}</span>
                <div style={{ flex: 1 }} />
                <div style={{ display: "flex", alignItems: "center", gap: 6, ...ctrl, padding: "0 8px" }}>
                    <i className="ti ti-search" aria-hidden="true" style={{ fontSize: 15, color: "var(--cc-text3)" }} />
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" style={{ border: "none", outline: "none", background: "transparent", color: "var(--cc-text)", fontSize: 13, padding: "7px 0", width: 120 }} />
                </div>
                <input type="date" value={week} onChange={(e) => setWeek(e.target.value)} onBlur={loadRoster} style={{ ...ctrl, padding: "6px 8px" }} />
                <button type="button" onClick={runReports} disabled={busy} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--cc-accent)", color: "var(--cc-on-accent)", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1, whiteSpace: "nowrap" }}>
                    <i className="ti ti-refresh" aria-hidden="true" style={{ fontSize: 15 }} /> {busy ? "Generating…" : "Generate reports"}
                </button>
            </div>

            {err ? <AlertBanner text={err} /> : null}

            {/* KPI cards */}
            {s ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                    {kpiCards.map(([k, label, n]) => (
                        <div key={k} style={{ background: "var(--cc-panel)", border: "1px solid var(--cc-border)", borderRadius: 14, padding: 16, minHeight: 92, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                            <div style={{ fontSize: 12.5, color: "var(--cc-text2)", fontWeight: 500 }}>{label}</div>
                            <div style={{ fontSize: 30, fontWeight: 700, color: STATUS[k].fg, lineHeight: 1.1, marginTop: 6 }}>{n}</div>
                        </div>
                    ))}
                </div>
            ) : null}

            {/* table */}
            <div style={{ background: "var(--cc-panel)", border: "1px solid var(--cc-border)", borderRadius: 14, overflow: "hidden", overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 720, borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                        <tr style={{ background: "var(--cc-panel2)" }}>
                            {["Client", "Status", "Training", "Nutrition", "Weight Δ", "Report"].map((h) => (
                                <th key={h} style={{ textAlign: "left", padding: "10px 16px", fontSize: 11.5, fontWeight: 600, color: "var(--cc-text3)", textTransform: "uppercase", letterSpacing: 0.4, borderBottom: "1px solid var(--cc-border)" }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((c) => (
                            <tr key={c.report_id} className="cc-row" onClick={() => navigate(`/coach/clients/${c.client_id}${qs}`)} style={{ cursor: "pointer", borderBottom: "1px solid var(--cc-border)", background: selectedId === c.client_id ? "var(--cc-accent-bg)" : "transparent" }}>
                                <td style={{ padding: "10px 16px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                                        <Avatar name={c.name} status={c.status} />
                                        <div style={{ lineHeight: 1.2 }}>
                                            <div style={{ fontWeight: 600, color: "var(--cc-text)" }}>{c.name}</div>
                                            <div style={{ fontSize: 11.5, color: "var(--cc-text3)" }}>{c.goal}</div>
                                        </div>
                                    </div>
                                </td>
                                <td style={{ padding: "10px 16px" }}><Pill status={c.status} small /></td>
                                <td style={{ padding: "10px 16px" }}><Bar pct={c.training_adherence} /></td>
                                <td style={{ padding: "10px 16px" }}><Bar pct={c.log_adherence} /></td>
                                <td style={{ padding: "10px 16px", whiteSpace: "nowrap", color: "var(--cc-text)", fontWeight: 500 }}>
                                    {c.weight_trend ? `${c.weight_trend.change > 0 ? "+" : ""}${c.weight_trend.change} kg` : "—"}
                                </td>
                                <td style={{ padding: "10px 16px" }}>
                                    {c.has_pdf ? (
                                        <button type="button" onClick={(e) => { e.stopPropagation(); openBlob(`/api/v1/reports/${c.report_id}/pdf`, token, setErr); }} style={{ display: "inline-flex", alignItems: "center", gap: 5, border: "none", background: "none", color: "var(--cc-accent)", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
                                            <i className="ti ti-download" aria-hidden="true" style={{ fontSize: 14 }} /> PDF
                                        </button>
                                    ) : <span style={{ color: "var(--cc-text3)" }}>—</span>}
                                </td>
                            </tr>
                        ))}
                        {!rows.length ? (
                            <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: "var(--cc-text3)", fontSize: 13 }}>
                                {roster ? "No reports this week — add clients, then Generate reports." : "Loading…"}
                            </td></tr>
                        ) : null}
                    </tbody>
                </table>
            </div>

            {/* add client (compact inline) */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {addOpen ? (
                    <>
                        <input value={newClient} onChange={(e) => setNewClient(e.target.value)} placeholder="@username or user id" style={{ ...ctrl, padding: "7px 10px", width: 220 }} />
                        <button type="button" onClick={addClient} style={{ background: "var(--cc-accent)", color: "var(--cc-on-accent)", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Add</button>
                        <button type="button" onClick={() => setAddOpen(false)} style={{ border: "none", background: "none", color: "var(--cc-text3)", cursor: "pointer", fontSize: 13 }}>Cancel</button>
                    </>
                ) : (
                    <button type="button" onClick={() => setAddOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--cc-border)", background: "var(--cc-panel)", color: "var(--cc-text2)", borderRadius: 8, padding: "6px 10px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                        <i className="ti ti-plus" aria-hidden="true" style={{ fontSize: 14 }} /> Add client
                    </button>
                )}
            </div>

            {/* client details panel — fills the space under the table */}
            {selectedId != null ? <DetailsPanel token={token} clientId={selectedId} weekParam={week} onErr={setErr} /> : null}
        </main>
    );
}

const CoachConsole = () => {
    const { token } = useAuth();
    const { clientId } = useParams();
    const [theme, setTheme] = useState(() => localStorage.getItem("cc_theme") || "auto");
    useEffect(() => { localStorage.setItem("cc_theme", theme); }, [theme]);
    const cycleTheme = () => setTheme((t) => (t === "auto" ? "dark" : t === "dark" ? "light" : "auto"));
    const openDashboard = () => openBlob("/api/v1/reports/dashboard", token);

    return (
        <div className="cc-root" data-theme={theme === "auto" ? undefined : theme} style={{ minHeight: "100vh", display: "flex", background: "var(--cc-page)", color: "var(--cc-text)" }}>
            <Sidebar active="clients" onOpenDashboard={openDashboard} theme={theme} onCycleTheme={cycleTheme} />
            <Dashboard token={token} routeClientId={clientId} />
        </div>
    );
};

export default CoachConsole;
