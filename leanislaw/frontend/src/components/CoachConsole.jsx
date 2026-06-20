import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authBearerHeaders, authJsonHeaders } from "../apiHeaders";

const STATUS = {
    needs_attention: { label: "Needs attention", color: "#a32d2d", bg: "#fceaea" },
    watch: { label: "Watch", color: "#854f0b", bg: "#faeeda" },
    on_track: { label: "On track", color: "#0f6e56", bg: "#e1f5ee" },
};

const ACCENT = "#185fa5";
const ACCENT_BG = "#e6f1fb";
const PAGE_BG = "#f6f6f4";
const BORDER = "#e7e7e3";
const TXT = "#1d1d1b";
const TXT2 = "#5f5e5a";
const TXT3 = "#8a8a84";
const PANEL2 = "#f3f3f0";

const SHELL = {
    minHeight: "100vh",
    display: "flex",
    background: PAGE_BG,
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Segoe UI, sans-serif',
    color: TXT,
};

function statusColor(p) {
    if (p == null) return TXT3;
    return p >= 80 ? "#0f6e56" : p >= 50 ? "#854f0b" : "#a32d2d";
}

function initials(name = "") {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase();
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

function Bar({ pct }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, height: 6, borderRadius: 4, background: "#eceef1", overflow: "hidden", minWidth: 56 }}>
                <div style={{ height: "100%", width: `${Math.min(100, pct ?? 0)}%`, background: statusColor(pct) }} />
            </div>
            <span style={{ color: "#636366", fontSize: "0.78rem", width: 32 }}>{pct ?? "—"}%</span>
        </div>
    );
}

function Pill({ status }) {
    const s = STATUS[status] || { label: status, color: "#8e8e93", bg: "#eee" };
    return (
        <span style={{ background: s.bg, color: s.color, borderRadius: 999, padding: "3px 10px", fontSize: "0.74rem", fontWeight: 500, whiteSpace: "nowrap" }}>
            {s.label}
        </span>
    );
}

function Avatar({ name, status, size = 34 }) {
    const s = STATUS[status] || { color: "#3a6ea5", bg: "#e8eef6" };
    return (
        <div
            style={{
                width: size,
                height: size,
                borderRadius: "50%",
                background: s.bg,
                color: s.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: size < 32 ? "0.7rem" : "0.8rem",
                fontWeight: 500,
                flexShrink: 0,
            }}
        >
            {initials(name)}
        </div>
    );
}

const sidebarItem = (active, muted) => ({
    display: "flex",
    alignItems: "center",
    gap: 11,
    padding: "9px 12px",
    fontSize: "0.86rem",
    fontWeight: 500,
    color: active ? ACCENT : muted ? TXT3 : TXT2,
    background: active ? ACCENT_BG : "transparent",
    borderRadius: 8,
    cursor: active ? "default" : "pointer",
    textAlign: "left",
    border: "none",
    width: "100%",
});

function Sidebar({ active, onOpenDashboard }) {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const items = [
        { key: "clients", label: "Clients", icon: "ti-users", onClick: () => navigate("/coach") },
        { key: "reports", label: "Reports", icon: "ti-file-text", onClick: onOpenDashboard },
        { key: "checkins", label: "Check-ins", icon: "ti-clipboard-check", muted: true },
        { key: "messages", label: "Messages", icon: "ti-message", muted: true },
        { key: "settings", label: "Settings", icon: "ti-settings", muted: true },
    ];
    return (
        <aside
            style={{
                width: 224,
                flexShrink: 0,
                background: "#fff",
                borderRight: `1px solid ${BORDER}`,
                padding: "calc(18px + env(safe-area-inset-top,0px)) 12px 18px",
                display: "flex",
                flexDirection: "column",
                gap: 3,
                position: "sticky",
                top: 0,
                height: "100vh",
            }}
        >
            <div style={{ padding: "4px 12px 16px", fontWeight: 500, fontSize: "0.95rem", letterSpacing: 0.2 }}>
                Lean is Law
            </div>
            {items.map((it) => (
                <button
                    key={it.key}
                    type="button"
                    style={sidebarItem(active === it.key, it.muted)}
                    onClick={it.onClick || (() => {})}
                >
                    <i className={`ti ${it.icon}`} aria-hidden="true" style={{ fontSize: 18, width: 18 }} />
                    {it.label}
                </button>
            ))}
            <div style={{ marginTop: "auto", borderTop: `1px solid ${BORDER}`, paddingTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar name={`${user?.first_name || ""} ${user?.last_name || ""}`} size={32} />
                <div style={{ lineHeight: 1.25, minWidth: 0 }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {user?.first_name} {user?.last_name}
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            logout();
                            navigate("/login", { replace: true });
                        }}
                        style={{ border: "none", background: "none", color: "#a32d2d", fontSize: "0.74rem", padding: 0, cursor: "pointer" }}
                    >
                        Log out
                    </button>
                </div>
            </div>
        </aside>
    );
}

/* ---------------- Roster view ---------------- */

function Roster({ token }) {
    const navigate = useNavigate();
    const [week, setWeek] = useState("");
    const [roster, setRoster] = useState(null);
    const [clients, setClients] = useState([]);
    const [err, setErr] = useState("");
    const [busy, setBusy] = useState(false);
    const [addOpen, setAddOpen] = useState(false);
    const [newClient, setNewClient] = useState("");
    const [query, setQuery] = useState("");
    const qs = week ? `?week=${encodeURIComponent(week)}` : "";

    const loadRoster = useCallback(async () => {
        setErr("");
        try {
            const r = await fetch(`/api/v1/reports/roster${qs}`, { headers: authBearerHeaders(token) });
            const d = await r.json();
            if (d.error) setErr(d.error);
            else setRoster(d);
        } catch {
            setErr("Could not load roster.");
        }
    }, [token, qs]);

    const loadClients = useCallback(async () => {
        try {
            const r = await fetch("/api/v1/reports/clients", { headers: authBearerHeaders(token) });
            const d = await r.json();
            if (Array.isArray(d)) setClients(d);
        } catch { /* non-fatal */ }
    }, [token]);

    useEffect(() => {
        loadRoster();
        loadClients();
    }, [loadRoster, loadClients]);

    const runReports = async () => {
        setBusy(true);
        setErr("");
        try {
            const r = await fetch("/api/v1/reports/run", {
                method: "POST",
                headers: authJsonHeaders(token),
                body: JSON.stringify(week ? { week_start: week } : {}),
            });
            const d = await r.json();
            if (d.error) setErr(d.error);
            else await loadRoster();
        } catch {
            setErr("Report run failed.");
        } finally {
            setBusy(false);
        }
    };

    const addClient = async () => {
        const val = newClient.trim();
        if (!val) return;
        const body = /^\d+$/.test(val) ? { client_id: Number(val) } : { username: val };
        const r = await fetch("/api/v1/reports/clients", {
            method: "POST",
            headers: authJsonHeaders(token),
            body: JSON.stringify(body),
        });
        const d = await r.json();
        if (d.error) setErr(d.error);
        else {
            setNewClient("");
            setAddOpen(false);
            await loadClients();
        }
    };

    const s = roster?.summary;
    const rows = (roster?.clients || []).filter((c) =>
        !query || String(c.name).toLowerCase().includes(query.toLowerCase())
    );
    const onRoster = new Set(rows.map((c) => c.client_id));
    const notYet = clients.filter((c) => !onRoster.has(c.client_id));

    return (
        <div style={{ flex: 1, minWidth: 0, padding: "22px 26px 60px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 500 }}>Clients</h1>
                <span style={{ color: TXT3, fontSize: "0.85rem" }}>
                    {roster ? `Week of ${roster.week_start} → ${roster.week_end}` : "Loading…"}
                </span>
                <div style={{ flex: 1 }} />
                <div style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 10px", background: "#fff" }}>
                    <i className="ti ti-search" aria-hidden="true" style={{ fontSize: 16, color: TXT3 }} />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search clients"
                        style={{ border: "none", outline: "none", padding: "8px 0", fontSize: "0.85rem", width: 140, background: "transparent" }}
                    />
                </div>
                <input
                    type="date"
                    value={week}
                    onChange={(e) => setWeek(e.target.value)}
                    onBlur={loadRoster}
                    style={{ padding: 8, borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: "0.85rem", background: "#fff" }}
                />
                <button type="button" onClick={runReports} disabled={busy} style={primaryBtn(busy)}>
                    <i className="ti ti-refresh" aria-hidden="true" style={{ fontSize: 15, marginRight: 6, verticalAlign: "-2px" }} />
                    {busy ? "Generating…" : "Generate reports"}
                </button>
            </div>

            {err ? <div style={{ ...cardStyle, marginBottom: 14, color: "#b42318" }}>{err}</div> : null}

            {s ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 12, marginBottom: 18 }}>
                    {[["needs_attention", s.needs_attention], ["watch", s.watch], ["on_track", s.on_track], ["total", s.total]].map(([k, n]) => (
                        <div key={k} style={{ background: PANEL2, borderRadius: 10, padding: 14 }}>
                            <div style={{ fontSize: "1.6rem", fontWeight: 500, color: STATUS[k]?.color || TXT }}>{n}</div>
                            <div style={{ fontSize: "0.78rem", color: TXT2, marginTop: 2 }}>
                                {k === "total" ? "Total clients" : STATUS[k].label}
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}

            <div style={{ ...cardStyle, padding: 0, overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse", fontSize: "0.86rem" }}>
                    <thead>
                        <tr style={{ color: TXT3, textAlign: "left", background: PANEL2 }}>
                            {["Client", "Status", "Training", "Nutrition", "Weight Δ", "Report"].map((h) => (
                                <th key={h} style={{ padding: "10px 16px", fontWeight: 500, fontSize: "0.76rem", borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((c) => (
                            <tr
                                key={c.report_id}
                                onClick={() => navigate(`/coach/clients/${c.client_id}${qs}`)}
                                style={{ cursor: "pointer", borderBottom: "1px solid #f2f3f5" }}
                            >
                                <td style={{ padding: "12px 16px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <Avatar name={c.name} status={c.status} />
                                        <div style={{ lineHeight: 1.25 }}>
                                            <div style={{ fontWeight: 500 }}>{c.name}</div>
                                            <div style={{ fontSize: "0.74rem", color: "#8e8e93" }}>{c.goal}</div>
                                        </div>
                                    </div>
                                </td>
                                <td style={{ padding: "12px 16px" }}><Pill status={c.status} /></td>
                                <td style={{ padding: "12px 16px", minWidth: 120 }}><Bar pct={c.training_adherence} /></td>
                                <td style={{ padding: "12px 16px", minWidth: 120 }}><Bar pct={c.log_adherence} /></td>
                                <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                                    {c.weight_trend ? `${c.weight_trend.change > 0 ? "+" : ""}${c.weight_trend.change}kg` : "—"}
                                </td>
                                <td style={{ padding: "12px 16px" }}>
                                    {c.has_pdf ? (
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); openBlob(`/api/v1/reports/${c.report_id}/pdf`, token, setErr); }}
                                            style={{ display: "inline-flex", alignItems: "center", gap: 5, border: "none", background: "none", color: ACCENT, fontWeight: 500, cursor: "pointer" }}
                                        >
                                            <i className="ti ti-download" aria-hidden="true" style={{ fontSize: 15 }} /> PDF
                                        </button>
                                    ) : <span style={{ color: "#c4c7cc" }}>—</span>}
                                </td>
                            </tr>
                        ))}
                        {!rows.length ? (
                            <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#8e8e93" }}>
                                {roster ? "No reports for this week yet — add clients, then Generate reports." : "Loading…"}
                            </td></tr>
                        ) : null}
                    </tbody>
                </table>
            </div>

            <div style={{ marginTop: 16 }}>
                <button type="button" onClick={() => setAddOpen((o) => !o)} style={{ border: "none", background: "none", color: "#185fa5", fontWeight: 500, cursor: "pointer", padding: 0 }}>
                    {addOpen ? "− Close" : "+ Add client"}
                </button>
                {addOpen ? (
                    <div style={{ ...cardStyle, marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
                        <input value={newClient} onChange={(e) => setNewClient(e.target.value)} placeholder="@username or user id" style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid #d8dadf" }} />
                        <button type="button" onClick={addClient} style={primaryBtn(false)}>Add</button>
                    </div>
                ) : null}
                {notYet.length ? (
                    <p style={{ fontSize: "0.78rem", color: "#8e8e93", marginTop: 8 }}>
                        On roster, no report yet this week: {notYet.map((c) => c.name).join(", ")}
                    </p>
                ) : null}
            </div>
        </div>
    );
}

/* ---------------- Client profile ---------------- */

function MiniWeight({ series }) {
    const pts = (series || []).filter((p) => p.weight != null);
    if (pts.length < 2) return <Empty text="Not enough weight data this week" />;
    const w = 340, h = 130, pad = 26;
    const vals = pts.map((p) => p.weight);
    const min = Math.min(...vals), max = Math.max(...vals), rng = max - min || 1;
    const x = (i) => pad + (i * (w - 2 * pad)) / (pts.length - 1);
    const y = (v) => h - pad - ((v - min) / rng) * (h - 2 * pad);
    const d = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.weight).toFixed(1)}`).join(" ");
    return (
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", maxWidth: 380 }}>
            <path d={d} fill="none" stroke="#185fa5" strokeWidth="2" />
            {pts.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.weight)} r="3" fill="#185fa5" />)}
            <text x={pad} y={14} fontSize="10" fill="#8e8e93">{max}kg</text>
            <text x={pad} y={h - 6} fontSize="10" fill="#8e8e93">{min}kg</text>
        </svg>
    );
}

function MiniNutrition({ days, target }) {
    if (!days || !days.length) return <Empty text="No nutrition logged this week" />;
    const w = 340, h = 130, pad = 26;
    const max = Math.max(target || 0, ...days.map((d) => d.calories)) * 1.12 || 1;
    const bw = (w - 2 * pad) / days.length;
    const ty = target ? h - pad - (target / max) * (h - 2 * pad) : null;
    return (
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", maxWidth: 380 }}>
            {days.map((d, i) => {
                const bh = (d.calories / max) * (h - 2 * pad);
                const over = target && d.calories > target;
                return <rect key={i} x={pad + i * bw + 3} y={h - pad - bh} width={bw - 6} height={bh} rx="2" fill={over ? "#e5484d" : "#1a7f4b"} />;
            })}
            {ty != null ? <line x1={pad} y1={ty} x2={w - pad} y2={ty} stroke="#8e8e93" strokeDasharray="4 3" /> : null}
            {ty != null ? <text x={w - pad} y={ty - 4} fontSize="10" fill="#8e8e93" textAnchor="end">target {target}</text> : null}
        </svg>
    );
}

function Empty({ text }) {
    return <p style={{ color: "#8e8e93", fontSize: "0.85rem", padding: "10px 0" }}>{text}</p>;
}

function Metric({ label, value }) {
    return (
        <div style={{ background: "#f7f8fa", borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: "0.72rem", color: "#8e8e93" }}>{label}</div>
            <div style={{ fontSize: "1.15rem", fontWeight: 500 }}>{value}</div>
        </div>
    );
}

const TABS = ["Overview", "Metrics", "Nutrition", "Check-ins", "Reports"];

function Profile({ token }) {
    const { clientId } = useParams();
    const [params] = useSearchParams();
    const week = params.get("week") || "";
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [sg, setSg] = useState(null);
    const [history, setHistory] = useState([]);
    const [tab, setTab] = useState("Overview");
    const [err, setErr] = useState("");
    const qs = week ? `?week=${encodeURIComponent(week)}` : "";

    const load = useCallback(async () => {
        setErr("");
        try {
            const [rep, safe, hist] = await Promise.all([
                fetch(`/api/v1/reports/clients/${clientId}/report${qs}`, { headers: authBearerHeaders(token) }).then((r) => r.json()),
                fetch(`/api/v1/reports/clients/${clientId}/safeguarding`, { headers: authBearerHeaders(token) }).then((r) => r.json()),
                fetch(`/api/v1/reports/clients/${clientId}/reports`, { headers: authBearerHeaders(token) }).then((r) => r.json()),
            ]);
            if (rep.error) setErr(rep.error);
            else setData(rep);
            if (!safe.error) setSg(safe);
            if (Array.isArray(hist)) setHistory(hist);
        } catch {
            setErr("Could not load this client.");
        }
    }, [token, clientId, qs]);

    useEffect(() => { load(); }, [load]);

    const saveSafe = async (patch) => {
        await fetch(`/api/v1/reports/clients/${clientId}/safeguarding`, {
            method: "PUT",
            headers: authJsonHeaders(token),
            body: JSON.stringify(patch),
        });
        const r = await fetch(`/api/v1/reports/clients/${clientId}/safeguarding`, { headers: authBearerHeaders(token) });
        const d = await r.json();
        if (!d.error) setSg(d);
    };

    const saveTarget = async (val) => {
        await fetch(`/api/v1/reports/clients/${clientId}`, {
            method: "PATCH",
            headers: authJsonHeaders(token),
            body: JSON.stringify({ weekly_training_target: Number(val) }),
        });
    };

    const m = data?.model;
    const name = m?.name || `Client ${clientId}`;

    return (
        <div style={{ flex: 1, minWidth: 0, padding: "22px 26px 60px" }}>
            <button type="button" onClick={() => navigate(`/coach${qs}`)} style={{ border: "none", background: "none", color: "#185fa5", fontWeight: 500, cursor: "pointer", padding: 0 }}>
                ← Clients
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "14px 0 16px" }}>
                <Avatar name={name} status={data?.status} size={48} />
                <div>
                    <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 500 }}>{name}</h1>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}>
                        {data?.status ? <Pill status={data.status} /> : null}
                        <span style={{ color: "#8e8e93", fontSize: "0.85rem" }}>{m?.goal} · week of {data?.week_start}</span>
                    </div>
                </div>
                <div style={{ flex: 1 }} />
                {data?.has_pdf ? (
                    <button type="button" onClick={() => openBlob(`/api/v1/reports/${data.report_id}/pdf`, token, setErr)} style={primaryBtn(false)}>
                        Download PDF ↗
                    </button>
                ) : null}
            </div>

            {err ? <div style={{ ...cardStyle, marginBottom: 14, color: "#b42318" }}>{err}</div> : null}

            <div style={{ display: "flex", gap: 6, borderBottom: "1px solid #e6e8ec", marginBottom: 16, flexWrap: "wrap" }}>
                {TABS.map((t) => (
                    <button
                        key={t}
                        type="button"
                        onClick={() => setTab(t)}
                        style={{
                            border: "none",
                            background: "none",
                            padding: "8px 12px",
                            fontSize: "0.88rem",
                            fontWeight: tab === t ? 700 : 500,
                            color: tab === t ? "#185fa5" : "#636366",
                            borderBottom: tab === t ? "2px solid #185fa5" : "2px solid transparent",
                            cursor: "pointer",
                        }}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {!data ? <Empty text="Loading…" /> : !data.has_report ? (
                <div style={cardStyle}>
                    <p style={{ margin: 0, color: "#636366" }}>
                        No report for this client for the week of {data.week_start}. Go to Clients and tap <strong>Generate reports</strong>.
                    </p>
                </div>
            ) : (
                <>
                    {tab === "Overview" ? (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
                            <div style={cardStyle}>
                                <h3 style={cardH}>This week at a glance</h3>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                    <Metric label="Weight Δ" value={m.body?.trend ? `${m.body.trend.change > 0 ? "+" : ""}${m.body.trend.change} kg` : "—"} />
                                    <Metric label="Sessions" value={`${m.training?.completed ?? 0} / ${m.training?.assigned ?? 0}`} />
                                    <Metric label="Logged days" value={`${m.nutrition?.logged_days ?? 0} / ${m.nutrition?.target_days ?? 7}`} />
                                    <Metric label="Protein hit" value={`${m.nutrition?.protein_hit_rate ?? 0}%`} />
                                </div>
                            </div>
                            <div style={cardStyle}>
                                <h3 style={cardH}>Coach flags</h3>
                                <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.86rem", lineHeight: 1.6, color: "#3c3c43" }}>
                                    {(data.flags || []).map((f, i) => <li key={i}>{f}</li>)}
                                </ul>
                                {m.training?.notes ? <p style={{ fontStyle: "italic", color: "#8e8e93", fontSize: "0.82rem", marginTop: 10 }}>Training: {m.training.notes}</p> : null}
                            </div>
                        </div>
                    ) : null}

                    {tab === "Metrics" ? (
                        <div style={cardStyle}>
                            <h3 style={cardH}>Weight trend ({m.body?.unit || "kg"})</h3>
                            <MiniWeight series={m.body?.weight_series} />
                            {m.body?.trend ? (
                                <p style={{ fontSize: "0.85rem", color: "#636366", marginTop: 8 }}>
                                    {m.body.trend.start} → {m.body.trend.end} {m.body.unit} ({m.body.trend.change > 0 ? "+" : ""}{m.body.trend.change}, {m.body.trend.pct_change}%)
                                </p>
                            ) : null}
                            {m.body?.measurements?.body_fat_pct != null ? (
                                <p style={{ fontSize: "0.85rem", color: "#636366" }}>Body fat: {m.body.measurements.body_fat_pct}%</p>
                            ) : null}
                        </div>
                    ) : null}

                    {tab === "Nutrition" ? (
                        <div style={cardStyle}>
                            <h3 style={cardH}>Daily calories vs target</h3>
                            <MiniNutrition days={m.nutrition?.days} target={m.nutrition?.target_calories} />
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8, marginTop: 12 }}>
                                <Metric label="Target calories" value={m.nutrition?.target_calories ?? "—"} />
                                <Metric label="Avg calories" value={m.nutrition?.avg_calories ?? "—"} />
                                <Metric label="Protein target" value={m.nutrition?.target_protein_g ? `${m.nutrition.target_protein_g} g` : "—"} />
                                <Metric label="Logging" value={`${m.nutrition?.log_adherence ?? 0}%`} />
                            </div>
                        </div>
                    ) : null}

                    {tab === "Check-ins" ? (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
                            <div style={cardStyle}>
                                <h3 style={cardH}>Weekly check-in</h3>
                                {m.checkin?.submitted ? (
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                        <Metric label="Sleep" value={`${m.checkin.sleep_h ?? "—"} h`} />
                                        <Metric label="Energy" value={`${m.checkin.energy_1to5 ?? "—"} / 5`} />
                                        <Metric label="Stress" value={`${m.checkin.stress_1to5 ?? "—"} / 5`} />
                                        <Metric label="Steps avg" value={m.checkin.steps_avg ?? "—"} />
                                    </div>
                                ) : <Empty text="No check-in submitted this week." />}
                                {m.checkin?.notes ? <p style={{ fontStyle: "italic", color: "#636366", fontSize: "0.85rem", marginTop: 10 }}>“{m.checkin.notes}”</p> : null}
                            </div>
                            <div style={cardStyle}>
                                <h3 style={cardH}>Duty of care</h3>
                                {sg ? (
                                    <>
                                        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
                                            <span style={{ fontSize: "0.86rem" }}>Hide raw numbers in client app</span>
                                            <input type="checkbox" checked={!!sg.hide_raw_numbers} onChange={(e) => saveSafe({ hide_raw_numbers: e.target.checked })} />
                                        </label>
                                        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
                                            <span style={{ fontSize: "0.86rem" }}>Support region</span>
                                            <select value={sg.support_region || "UK"} onChange={(e) => saveSafe({ support_region: e.target.value })} style={{ padding: 6, borderRadius: 8, border: "1px solid #d8dadf" }}>
                                                <option value="UK">UK</option><option value="US">US</option><option value="AU">AU</option>
                                            </select>
                                        </label>
                                        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
                                            <span style={{ fontSize: "0.86rem" }}>Weekly training target</span>
                                            <input type="number" min={0} max={14} defaultValue={m.training?.assigned ?? 4} onBlur={(e) => saveTarget(e.target.value)} style={{ width: 56, padding: 6, borderRadius: 8, border: "1px solid #d8dadf" }} />
                                        </label>
                                        <p style={{ fontSize: "0.74rem", color: "#8e8e93", marginTop: 8 }}>
                                            Intake screen {sg.screen_completed ? "completed" : "not completed"}.
                                        </p>
                                    </>
                                ) : <Empty text="Loading…" />}
                            </div>
                        </div>
                    ) : null}

                    {tab === "Reports" ? (
                        <div style={cardStyle}>
                            <h3 style={cardH}>Report history</h3>
                            {history.length ? history.map((h) => (
                                <div key={h.report_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #f2f3f5" }}>
                                    <Pill status={h.status} />
                                    <span style={{ flex: 1, fontSize: "0.86rem" }}>Week of {h.week_start}</span>
                                    {h.has_pdf ? (
                                        <button type="button" onClick={() => openBlob(`/api/v1/reports/${h.report_id}/pdf`, token, setErr)} style={{ border: "none", background: "none", color: "#185fa5", fontWeight: 500, cursor: "pointer" }}>PDF ↗</button>
                                    ) : <span style={{ color: "#c4c7cc" }}>—</span>}
                                </div>
                            )) : <Empty text="No reports generated yet." />}
                        </div>
                    ) : null}
                </>
            )}
        </div>
    );
}

const cardStyle = {
    background: "#fff",
    borderRadius: 12,
    padding: "16px 18px",
    border: `1px solid ${BORDER}`,
};
const cardH = { margin: "0 0 12px", fontSize: "0.82rem", fontWeight: 500, color: TXT2 };
const primaryBtn = (busy) => ({
    padding: "9px 16px",
    borderRadius: 8,
    border: "none",
    background: busy ? "#9cbcd8" : ACCENT,
    color: "#fff",
    fontWeight: 500,
    fontSize: "0.85rem",
    cursor: busy ? "default" : "pointer",
    whiteSpace: "nowrap",
});

const CoachConsole = () => {
    const { token } = useAuth();
    const { clientId } = useParams();
    const openDashboard = () => openBlob("/api/v1/reports/dashboard", token);

    return (
        <div style={SHELL}>
            <Sidebar active="clients" onOpenDashboard={openDashboard} />
            {clientId ? <Profile token={token} /> : <Roster token={token} />}
        </div>
    );
};

export default CoachConsole;
