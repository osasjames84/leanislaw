import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authBearerHeaders, authJsonHeaders } from "../apiHeaders";
import CoachExerciseLibrary from "./CoachExerciseLibrary";

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

// True minus sign (U+2212) for negative numbers.
const minusSign = (n) => `${n}`.replace("-", "−");
const signed = (n) => `${n > 0 ? "+" : ""}${minusSign(n)}`;

// Shorten the fast-drop coaching flag to "(−4.9%)" and use a true minus elsewhere.
function displayFlag(flag, trend) {
    if (!flag) return flag;
    if (/fast weekly drop/i.test(flag) && trend) {
        const pct = Math.round(trend.pct_change * 10) / 10;
        return `Fast weekly drop (${minusSign(pct)}%) — check in before pushing the deficit`;
    }
    return flag.replace(/-/g, "−");
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

function Pill({ status }) {
    const s = STATUS[status] || { label: status, bg: "var(--cc-panel2)", fg: "var(--cc-text2)" };
    return (
        <span style={{ background: s.bg, color: s.fg, borderRadius: 999, padding: "5px 12px", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
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
            <div style={{ flex: 1, height: 12, borderRadius: 999, background: "var(--cc-track)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(100, pct ?? 0)}%`, background: statusColor(pct), borderRadius: 999 }} />
            </div>
            <span style={{ color: "var(--cc-text2)", fontSize: 12, fontWeight: 500, width: 30, textAlign: "right" }}>{pct ?? "—"}%</span>
        </div>
    );
}

function StatCard({ label, value, color }) {
    return (
        <div style={{ background: "var(--cc-tile)", border: "1px solid var(--cc-border)", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, color: "var(--cc-text2)", fontWeight: 500 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: color || "var(--cc-text)", marginTop: 6, letterSpacing: -0.2 }}>{value}</div>
        </div>
    );
}

function AlertBanner({ text }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "var(--cc-alert-bg)", border: "1px solid var(--cc-alert-border)", color: "var(--cc-alert-fg)", borderRadius: 12, padding: "12px 16px", fontSize: 12.5, fontWeight: 500 }}>
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

function Sidebar({ active }) {
    const navigate = useNavigate();
    const { user } = useAuth();
    const nav = [
        { key: "clients", label: "Clients", icon: "ti-users", to: "/coach" },
        { key: "metrics", label: "Metrics", icon: "ti-chart-line", to: "/coach/metrics" },
        { key: "library", label: "Exercise library", icon: "ti-barbell", to: "/coach/library" },
        { key: "forms", label: "Forms", icon: "ti-clipboard-text", to: "/coach/forms" },
        { key: "tutorials", label: "Tutorials", icon: "ti-school", to: "/coach/tutorials" },
    ];
    return (
        <aside style={{ width: 248, flexShrink: 0, background: "transparent", display: "flex", flexDirection: "column", padding: 12 }}>
            <div style={{ padding: "6px 8px 12px" }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: "var(--cc-text)" }}>Lean is Law</span>
            </div>
            <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {nav.map((it) => (
                    <button key={it.key} type="button" className="cc-nav" style={navStyle(active === it.key)} onClick={() => navigate(it.to)}>
                        <i className={`ti ${it.icon}`} aria-hidden="true" style={{ fontSize: 17, width: 17 }} />
                        {it.label}
                    </button>
                ))}
            </nav>

            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px" }}>
                <Avatar name={`${user?.first_name || ""} ${user?.last_name || ""}`} size={32} />
                <div style={{ minWidth: 0, flex: 1, lineHeight: 1.25 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--cc-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {user?.first_name} {user?.last_name}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--cc-text3)" }}>Coach</div>
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

    // Sits on the shared surface, separated from the table by a top border.
    const card = { background: "transparent", borderTop: "1px solid var(--cc-border)", padding: 16 };

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
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <Avatar name={m.name} status={data.status} size={34} />
                <div style={{ minWidth: 0, lineHeight: 1.25 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: "var(--cc-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: "var(--cc-text3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.goal} · profile preview</div>
                </div>
            </div>

            <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--cc-border)", marginBottom: 14 }}>
                {TABS.map((t) => (
                    <button key={t} type="button" onClick={() => setTab(t)} style={{ border: "none", background: "none", padding: "7px 10px", fontSize: 13, fontWeight: tab === t ? 600 : 500, color: tab === t ? "var(--cc-accent)" : "var(--cc-text2)", borderBottom: tab === t ? "2px solid var(--cc-accent)" : "2px solid transparent", cursor: "pointer", marginBottom: -1 }}>
                        {t}
                    </button>
                ))}
            </div>

            {tab === "Overview" ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                    <StatCard label="Weight Δ" value={m.body?.trend ? `${signed(m.body.trend.change)} kg` : "—"} />
                    <StatCard label="Sessions" value={`${m.training?.completed ?? 0} / ${m.training?.assigned ?? 0}`} />
                    <StatCard label="Logged days" value={`${m.nutrition?.logged_days ?? 0} / ${m.nutrition?.target_days ?? 7}`} />
                </div>
            ) : null}

            {tab === "Metrics" ? (
                <div>
                    <MiniWeight series={m.body?.weight_series} />
                    {m.body?.trend ? (
                        <p style={{ fontSize: 13, color: "var(--cc-text2)", marginTop: 8 }}>
                            {m.body.trend.start} → {m.body.trend.end} {m.body.unit} ({signed(m.body.trend.change)}, {minusSign(m.body.trend.pct_change)}%)
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
                            <Pill status={h.status} />
                            <span style={{ flex: 1, fontSize: 13, color: "var(--cc-text)" }}>Week of {h.week_start}</span>
                            {h.has_pdf ? (
                                <button type="button" onClick={() => openBlob(`/api/v1/reports/${h.report_id}/pdf`, token, onErr)} style={{ border: "none", background: "none", color: "var(--cc-accent)", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>PDF</button>
                            ) : <span style={{ color: "var(--cc-text3)" }}>—</span>}
                        </div>
                    )) : <Empty text="No reports generated yet." />}
                </div>
            ) : null}

            {topFlag ? <div style={{ marginTop: 16 }}><AlertBanner text={displayFlag(topFlag, m.body?.trend)} /></div> : null}
        </div>
    );
}

/* ---------------- dashboard ---------------- */

function Dashboard({ token, routeClientId }) {
    const navigate = useNavigate();
    const week = "";
    const [roster, setRoster] = useState(null);
    const [err, setErr] = useState("");
    const [busy, setBusy] = useState(false);
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

    const s = roster?.summary;
    const rows = [...(roster?.clients || [])]
        .filter((c) => !query || String(c.name).toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) || String(a.name).localeCompare(String(b.name)));
    const selectedId = routeClientId != null ? Number(routeClientId) : rows[0]?.client_id ?? null;

    const ctrl = { background: "var(--cc-panel)", border: "1px solid var(--cc-border)", borderRadius: 8, color: "var(--cc-text)", fontSize: 13 };
    const kpiCards = s ? [["needs_attention", "Needs attention", s.needs_attention], ["watch", "Watch", s.watch], ["on_track", "On track", s.on_track]] : [];

    return (
        <main style={{ flex: 1, minWidth: 0, height: "100%", overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
            {/* header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, rowGap: 8, flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", color: "var(--cc-text)" }}>Clients</h1>
                <div style={{ flex: 1 }} />
                <div style={{ display: "flex", alignItems: "center", gap: 6, ...ctrl, padding: "0 8px" }}>
                    <i className="ti ti-search" aria-hidden="true" style={{ fontSize: 15, color: "var(--cc-text3)" }} />
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" style={{ border: "none", outline: "none", background: "transparent", color: "var(--cc-text)", fontSize: 13, padding: "7px 0", width: 140 }} />
                </div>
                <button type="button" onClick={runReports} disabled={busy} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--cc-accent-bg)", color: "var(--cc-accent)", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1, whiteSpace: "nowrap" }}>
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

            {/* client table + inset profile preview (on the shared surface) */}
            <div>
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", minWidth: 600, borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                            <tr>
                                {["Client", "Status", "Training", "Nutrition", "Report"].map((h) => (
                                    <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontSize: 15, fontWeight: 600, color: "var(--cc-text2)", textTransform: "none", letterSpacing: 0, borderBottom: "1px solid var(--cc-border)" }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((c) => (
                                <tr key={c.report_id} className="cc-row" onClick={() => navigate(`/coach/clients/${c.client_id}${qs}`)} style={{ cursor: "pointer", borderBottom: "1px solid var(--cc-border-soft)", background: selectedId === c.client_id ? "var(--cc-rowsel)" : "transparent" }}>
                                    <td style={{ padding: "12px 16px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                                            <Avatar name={c.name} status={c.status} />
                                            <div style={{ lineHeight: 1.2 }}>
                                                <div style={{ fontWeight: 600, color: "var(--cc-text)" }}>{c.name}</div>
                                                <div style={{ fontSize: 11.5, color: "var(--cc-text3)" }}>{c.goal}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: "12px 16px" }}><Pill status={c.status} /></td>
                                    <td style={{ padding: "12px 16px" }}><Bar pct={c.training_adherence} /></td>
                                    <td style={{ padding: "12px 16px" }}><Bar pct={c.log_adherence} /></td>
                                    <td style={{ padding: "12px 16px" }}>
                                        {c.has_pdf ? (
                                            <button type="button" onClick={(e) => { e.stopPropagation(); openBlob(`/api/v1/reports/${c.report_id}/pdf`, token, setErr); }} style={{ display: "inline-flex", alignItems: "center", gap: 5, border: "none", background: "none", color: "var(--cc-accent)", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
                                                <i className="ti ti-download" aria-hidden="true" style={{ fontSize: 14 }} /> PDF
                                            </button>
                                        ) : <span style={{ color: "var(--cc-text3)" }}>—</span>}
                                    </td>
                                </tr>
                            ))}
                            {!rows.length ? (
                                <tr><td colSpan={5} style={{ padding: 20, textAlign: "center", color: "var(--cc-text3)", fontSize: 13 }}>
                                    {roster ? "No reports this week — add clients, then Generate reports." : "Loading…"}
                                </td></tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>

                {/* inset profile preview, inside the same card */}
                {selectedId != null ? <DetailsPanel token={token} clientId={selectedId} weekParam={week} onErr={setErr} /> : null}
            </div>
        </main>
    );
}

function SectionStub({ icon, title, desc }) {
    return (
        <main style={{ flex: 1, minWidth: 0, height: "100%", overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", color: "var(--cc-text)" }}>{title}</h1>
            <div style={{ background: "var(--cc-panel)", border: "1px solid var(--cc-border)", borderRadius: 14, padding: 20, display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--cc-accent-bg)", color: "var(--cc-accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                    <i className={`ti ${icon}`} aria-hidden="true" />
                </div>
                <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "var(--cc-text)" }}>Coming next</div>
                    <div style={{ fontSize: 13, color: "var(--cc-text2)", marginTop: 2, lineHeight: 1.5 }}>{desc}</div>
                </div>
            </div>
        </main>
    );
}

const SECTIONS = {
    metrics: { icon: "ti-chart-line", title: "Metrics", desc: "Aggregate client metrics — bodyweight & body-fat trends, adherence over time, and exercise progression (bench/squat/hinge week-over-week) built from logged sets." },
    forms: { icon: "ti-clipboard-text", title: "Forms", desc: "Build custom intake (PAR-Q) and weekly check-in questionnaires, assign them to clients, and review responses." },
    tutorials: { icon: "ti-school", title: "Tutorials", desc: "A resource library — share technique videos, guides, and documents with your clients." },
};

const CoachConsole = ({ section = "clients" }) => {
    const { token } = useAuth();
    const { clientId } = useParams();

    return (
        <div className="cc-root" data-theme="dark" style={{ minHeight: "100vh", background: "var(--cc-page)", color: "var(--cc-text)", padding: 14, boxSizing: "border-box" }}>
            <div style={{ display: "flex", height: "calc(100vh - 28px)", background: "var(--cc-surface)", border: "1px solid var(--cc-border)", borderRadius: 16, overflow: "hidden" }}>
                <Sidebar active={section} />
                {section === "clients" ? <Dashboard token={token} routeClientId={clientId} /> : null}
                {section === "library" ? <CoachExerciseLibrary token={token} /> : null}
                {SECTIONS[section] ? <SectionStub {...SECTIONS[section]} /> : null}
            </div>
        </div>
    );
};

export default CoachConsole;
