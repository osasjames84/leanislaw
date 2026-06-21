import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authBearerHeaders, authJsonHeaders } from "../apiHeaders";
import { Avatar, AlertBanner } from "./coachShared";

/* All Clients table — structural dupe of the Everfit clients screen (frame 01)
   in our warm-charcoal style: filter-list panel + dense table with the exact
   columns (Last Activity, 7d/30d Training %, 7d Tasks %, Category, Status). */

function relTime(iso) {
    if (!iso) return "—";
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m`;
    if (s < 86400) return `${Math.round(s / 3600)}h`;
    if (s < 7 * 86400) return `${Math.round(s / 86400)}d`;
    if (s < 30 * 86400) return `${Math.round(s / (7 * 86400))}w`;
    return `${Math.round(s / (30 * 86400))}mo`;
}

const FILTERS = [
    { key: "all", label: "All Clients" },
    { key: "connected", label: "Connected" },
    { key: "pending", label: "Pending" },
    { key: "offline", label: "Offline" },
    { key: "need_programming", label: "Need Programming" },
    { key: "archived", label: "Archived" },
];

const ctrl = { background: "var(--cc-panel)", border: "1px solid var(--cc-border)", borderRadius: 8, color: "var(--cc-text2)", fontSize: 13, padding: "8px 12px", cursor: "pointer" };
const input = { background: "var(--cc-panel2)", border: "1px solid var(--cc-border)", borderRadius: 8, color: "var(--cc-text)", fontSize: 13, padding: "10px 12px", width: "100%", boxSizing: "border-box" };

function AddClientModal({ token, onClose, onAdded }) {
    const [username, setUsername] = useState("");
    const [target, setTarget] = useState(4);
    const [err, setErr] = useState("");
    const [busy, setBusy] = useState(false);
    const submit = async () => {
        setBusy(true); setErr("");
        try {
            const d = await fetch("/api/v1/reports/clients", { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify({ username: username.replace(/^@/, ""), weekly_training_target: Number(target) }) }).then((r) => r.json());
            if (d.error) setErr(d.error); else { onAdded(); onClose(); }
        } catch { setErr("Could not add that client."); } finally { setBusy(false); }
    };
    return (
        <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: 380, maxWidth: "100%", background: "var(--cc-surface)", border: "1px solid var(--cc-border)", borderRadius: 16, padding: 20 }}>
                <h2 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700, color: "var(--cc-text)" }}>Add client</h2>
                <p style={{ margin: "0 0 16px", fontSize: 12.5, color: "var(--cc-text3)" }}>Add an existing user to your roster by their @username.</p>
                {err ? <div style={{ marginBottom: 12 }}><AlertBanner text={err} /></div> : null}
                <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@username" style={{ ...input, marginBottom: 12 }} />
                <input type="number" min={0} max={14} value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Weekly training target" style={{ ...input, marginBottom: 18 }} />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button type="button" onClick={onClose} style={{ ...ctrl, background: "transparent" }}>Cancel</button>
                    <button type="button" onClick={submit} disabled={busy || !username.trim()} style={{ border: "none", background: "var(--cc-accent-bg)", color: "var(--cc-accent)", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: username.trim() ? 1 : 0.5 }}>{busy ? "Adding…" : "Add client"}</button>
                </div>
            </div>
        </div>
    );
}

function PctCell({ v }) {
    return <td style={{ padding: "14px 16px", fontSize: 13, color: v == null ? "var(--cc-text3)" : "var(--cc-text)", fontWeight: v == null ? 400 : 500 }}>{v == null ? "—" : `${v}%`}</td>;
}

export default function CoachClients({ token }) {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [filter, setFilter] = useState("all");
    const [query, setQuery] = useState("");
    const [err, setErr] = useState("");
    const [adding, setAdding] = useState(false);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setErr("");
        try {
            const d = await fetch("/api/v1/reports/clients/overview", { headers: authBearerHeaders(token) }).then((r) => r.json());
            if (d.error) setErr(d.error); else setData(d);
        } catch { setErr("Could not load clients."); }
    }, [token]);
    useEffect(() => { load(); }, [load]);

    const runReports = async () => {
        setBusy(true); setErr("");
        try { const d = await fetch("/api/v1/reports/run", { method: "POST", headers: authJsonHeaders(token), body: "{}" }).then((r) => r.json()); if (d.error) setErr(d.error); else await load(); }
        catch { setErr("Report run failed."); } finally { setBusy(false); }
    };

    const counts = data?.counts || {};
    const all = data?.clients || [];
    const byFilter = all.filter((c) => {
        if (filter === "connected") return c.status === "Connected";
        if (filter === "offline") return !c.online && c.status === "Connected";
        if (filter === "need_programming") return c.need_programming;
        if (filter === "archived") return c.status === "Archived";
        if (filter === "pending") return false;
        return true;
    });
    const rows = byFilter.filter((c) => !query || c.name.toLowerCase().includes(query.toLowerCase()));
    const title = FILTERS.find((f) => f.key === filter)?.label || "All Clients";

    return (
        <div style={{ flex: 1, minWidth: 0, display: "flex", height: "100%" }}>
            {adding ? <AddClientModal token={token} onClose={() => setAdding(false)} onAdded={load} /> : null}

            {/* secondary panel: filter list */}
            <aside style={{ width: 240, flexShrink: 0, borderRight: "1px solid var(--cc-border)", padding: 16, display: "flex", flexDirection: "column", overflowY: "auto" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <span style={{ fontWeight: 800, fontSize: 18, color: "var(--cc-text)" }}>Clients</span>
                    <i className="ti ti-settings" aria-hidden="true" style={{ color: "var(--cc-text3)", fontSize: 17 }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {FILTERS.map((f) => {
                        const on = filter === f.key;
                        return (
                            <button key={f.key} type="button" onClick={() => setFilter(f.key)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "none", cursor: "pointer", borderRadius: 8, padding: "9px 11px", fontSize: 13.5, fontWeight: on ? 600 : 500, background: on ? "var(--cc-accent-bg)" : "transparent", color: on ? "var(--cc-accent)" : "var(--cc-text2)" }}>
                                <span>{f.label}</span>
                                <span style={{ fontSize: 12.5, color: on ? "var(--cc-accent)" : "var(--cc-text3)" }}>{counts[f.key] ?? 0}</span>
                            </button>
                        );
                    })}
                </div>
                <div style={{ flex: 1 }} />
                <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--cc-text3)", letterSpacing: 0.6, marginBottom: 6 }}>YOUR INVITE LINK</div>
                    <div style={{ background: "var(--cc-panel2)", border: "1px solid var(--cc-border)", borderRadius: 8, padding: "8px 10px", fontSize: 11.5, color: "var(--cc-text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>leanislaw.app/invite/{(token || "").slice(-6) || "coach"}</div>
                </div>
            </aside>

            {/* main: table */}
            <main style={{ flex: 1, minWidth: 0, height: "100%", overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-0.4px", color: "var(--cc-text)" }}>{title} <span style={{ color: "var(--cc-text3)", fontWeight: 700 }}>({rows.length})</span></h1>
                    <div style={{ flex: 1 }} />
                    <button type="button" onClick={runReports} disabled={busy} style={{ ...ctrl, display: "inline-flex", alignItems: "center", gap: 6, opacity: busy ? 0.6 : 1 }}><i className="ti ti-chart-bar" aria-hidden="true" /> {busy ? "Generating…" : "Workout Analytics"}</button>
                    <button type="button" onClick={() => setAdding(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--cc-accent-bg)", color: "var(--cc-accent)", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}><i className="ti ti-user-plus" aria-hidden="true" /> Add Client</button>
                </div>

                {/* filter row */}
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={ctrl}>Category: All ▾</span>
                    <span style={ctrl}>Status: All ▾</span>
                    <span style={ctrl}>Last Activity ▾</span>
                    <span style={ctrl}>Last Assigned Workout ▾</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--cc-panel)", border: "1px solid var(--cc-border)", borderRadius: 8, padding: "0 10px", maxWidth: 360 }}>
                    <i className="ti ti-search" aria-hidden="true" style={{ fontSize: 15, color: "var(--cc-text3)" }} />
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search client" style={{ border: "none", outline: "none", background: "transparent", color: "var(--cc-text)", fontSize: 13, padding: "9px 0", flex: 1 }} />
                </div>

                {err ? <AlertBanner text={err} /> : null}

                <div style={{ overflowX: "auto", border: "1px solid var(--cc-border)", borderRadius: 12 }}>
                    <table style={{ width: "100%", minWidth: 860, borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: "var(--cc-panel)" }}>
                                {["Name", "Last Activity", "Last 7d Training", "Last 30d Training", "Last 7d Tasks", "Category", "Status"].map((h) => (
                                    <th key={h} style={{ textAlign: "left", padding: "11px 16px", fontSize: 12, fontWeight: 600, color: "var(--cc-text3)", borderBottom: "1px solid var(--cc-border)", whiteSpace: "nowrap" }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((c) => (
                                <tr key={c.client_id} className="cc-row" onClick={() => navigate(`/coach/clients/${c.client_id}`)} style={{ cursor: "pointer", borderBottom: "1px solid var(--cc-border-soft)" }}>
                                    <td style={{ padding: "12px 16px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                            <Avatar name={c.name} size={30} />
                                            <span style={{ fontWeight: 600, color: "var(--cc-text)" }}>{c.name}</span>
                                            {c.need_programming ? <span title="Needs programming" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--cc-warning)" }} /> : null}
                                        </div>
                                    </td>
                                    <td style={{ padding: "14px 16px", color: "var(--cc-text2)", whiteSpace: "nowrap" }}>{relTime(c.last_activity)}</td>
                                    <PctCell v={c.last_7d_training} />
                                    <PctCell v={c.last_30d_training} />
                                    <PctCell v={c.last_7d_tasks} />
                                    <td style={{ padding: "14px 16px", color: "var(--cc-text2)", whiteSpace: "nowrap" }}>{c.category}</td>
                                    <td style={{ padding: "14px 16px" }}>
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--cc-text2)" }}>
                                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.online ? "var(--cc-success)" : "var(--cc-text3)" }} />
                                            {c.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {!rows.length ? <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--cc-text3)" }}>{data ? "No clients in this view." : "Loading…"}</td></tr> : null}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
}
