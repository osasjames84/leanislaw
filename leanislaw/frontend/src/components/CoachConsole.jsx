import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authBearerHeaders, authJsonHeaders } from "../apiHeaders";
import CoachExerciseLibrary from "./CoachExerciseLibrary";
import CoachClientProfile from "./CoachClientProfile";
import CoachForms from "./CoachForms";
import CoachTutorials from "./CoachTutorials";
import {
    STATUS, STATUS_ORDER, Avatar, Pill, Bar, AlertBanner, openBlob,
} from "./coachShared";

/* ---------------- sidebar ---------------- */

const navStyle = (active) => ({
    display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", fontSize: 13.5,
    fontWeight: active ? 600 : 500, color: active ? "var(--cc-accent)" : "var(--cc-text2)",
    background: active ? "var(--cc-accent-bg)" : "transparent", borderRadius: 8, cursor: "pointer",
    border: "none", width: "100%", textAlign: "left",
});

function Sidebar({ active }) {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
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
            <nav style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
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
                <button type="button" onClick={logout} title="Log out" style={{ border: "none", background: "none", color: "var(--cc-text3)", cursor: "pointer", fontSize: 17, padding: 4 }}>
                    <i className="ti ti-logout" aria-hidden="true" />
                </button>
            </div>
        </aside>
    );
}

/* ---------------- add-client modal ---------------- */

function AddClientModal({ token, onClose, onAdded }) {
    const [username, setUsername] = useState("");
    const [target, setTarget] = useState(4);
    const [err, setErr] = useState("");
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        setBusy(true); setErr("");
        try {
            const d = await fetch("/api/v1/reports/clients", {
                method: "POST", headers: authJsonHeaders(token),
                body: JSON.stringify({ username: username.replace(/^@/, ""), weekly_training_target: Number(target) }),
            }).then((r) => r.json());
            if (d.error) setErr(d.error);
            else { onAdded(); onClose(); }
        } catch { setErr("Could not add that client."); }
        finally { setBusy(false); }
    };

    const input = { background: "var(--cc-panel2)", border: "1px solid var(--cc-border)", borderRadius: 8, color: "var(--cc-text)", fontSize: 13, padding: "10px 12px", width: "100%", boxSizing: "border-box" };
    return (
        <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: 380, maxWidth: "100%", background: "var(--cc-surface)", border: "1px solid var(--cc-border)", borderRadius: 16, padding: 20 }}>
                <h2 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700, color: "var(--cc-text)" }}>Add client</h2>
                <p style={{ margin: "0 0 16px", fontSize: 12.5, color: "var(--cc-text3)" }}>Add an existing user to your roster by their @username.</p>
                {err ? <div style={{ marginBottom: 12 }}><AlertBanner text={err} /></div> : null}
                <label style={{ fontSize: 12, color: "var(--cc-text2)", fontWeight: 600 }}>Username</label>
                <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@username" style={{ ...input, margin: "6px 0 14px" }} />
                <label style={{ fontSize: 12, color: "var(--cc-text2)", fontWeight: 600 }}>Weekly training target</label>
                <input type="number" min={0} max={14} value={target} onChange={(e) => setTarget(e.target.value)} style={{ ...input, margin: "6px 0 18px" }} />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button type="button" onClick={onClose} style={{ border: "1px solid var(--cc-border)", background: "transparent", color: "var(--cc-text2)", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                    <button type="button" onClick={submit} disabled={busy || !username.trim()} style={{ border: "none", background: "var(--cc-accent-bg)", color: "var(--cc-accent)", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: username.trim() ? 1 : 0.5 }}>{busy ? "Adding…" : "Add client"}</button>
                </div>
            </div>
        </div>
    );
}

/* ---------------- clients roster ---------------- */

function Dashboard({ token }) {
    const navigate = useNavigate();
    const week = "";
    const [roster, setRoster] = useState(null);
    const [err, setErr] = useState("");
    const [busy, setBusy] = useState(false);
    const [query, setQuery] = useState("");
    const [adding, setAdding] = useState(false);
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

    const ctrl = { background: "var(--cc-panel)", border: "1px solid var(--cc-border)", borderRadius: 8, color: "var(--cc-text)", fontSize: 13 };
    const kpiCards = s ? [["needs_attention", "Needs attention", s.needs_attention], ["watch", "Watch", s.watch], ["on_track", "On track", s.on_track]] : [];

    return (
        <main style={{ flex: 1, minWidth: 0, height: "100%", overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
            {adding ? <AddClientModal token={token} onClose={() => setAdding(false)} onAdded={loadRoster} /> : null}
            <div style={{ display: "flex", alignItems: "center", gap: 8, rowGap: 8, flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", color: "var(--cc-text)" }}>Clients</h1>
                <div style={{ flex: 1 }} />
                <div style={{ display: "flex", alignItems: "center", gap: 6, ...ctrl, padding: "0 8px" }}>
                    <i className="ti ti-search" aria-hidden="true" style={{ fontSize: 15, color: "var(--cc-text3)" }} />
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" style={{ border: "none", outline: "none", background: "transparent", color: "var(--cc-text)", fontSize: 13, padding: "7px 0", width: 140 }} />
                </div>
                <button type="button" onClick={() => setAdding(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--cc-panel)", color: "var(--cc-text)", border: "1px solid var(--cc-border)", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                    <i className="ti ti-user-plus" aria-hidden="true" style={{ fontSize: 15 }} /> Add client
                </button>
                <button type="button" onClick={runReports} disabled={busy} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--cc-accent-bg)", color: "var(--cc-accent)", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1, whiteSpace: "nowrap" }}>
                    <i className="ti ti-refresh" aria-hidden="true" style={{ fontSize: 15 }} /> {busy ? "Generating…" : "Generate reports"}
                </button>
            </div>

            {err ? <AlertBanner text={err} /> : null}

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

            <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 600, borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                        <tr>
                            {["Client", "Status", "Training", "Nutrition", "Report"].map((h) => (
                                <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontSize: 15, fontWeight: 600, color: "var(--cc-text2)", borderBottom: "1px solid var(--cc-border)" }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((c) => (
                            <tr key={c.report_id} className="cc-row" onClick={() => navigate(`/coach/clients/${c.client_id}${qs}`)} style={{ cursor: "pointer", borderBottom: "1px solid var(--cc-border-soft)" }}>
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
        </main>
    );
}

/* ---------------- aggregate metrics stub ---------------- */

function MetricsSection() {
    return (
        <main style={{ flex: 1, minWidth: 0, height: "100%", overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", color: "var(--cc-text)" }}>Metrics</h1>
            <div style={{ background: "var(--cc-panel)", border: "1px solid var(--cc-border)", borderRadius: 14, padding: 20, display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--cc-accent-bg)", color: "var(--cc-accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                    <i className="ti ti-chart-line" aria-hidden="true" />
                </div>
                <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "var(--cc-text)" }}>Per-client metrics are live</div>
                    <div style={{ fontSize: 13, color: "var(--cc-text2)", marginTop: 2, lineHeight: 1.5 }}>Open any client and use the <strong>Metrics</strong> tab for bodyweight/body-fat trends and exercise progression. Roster-wide aggregates land here next.</div>
                </div>
            </div>
        </main>
    );
}

const CoachConsole = ({ section = "clients" }) => {
    const { token } = useAuth();
    const { clientId } = useParams();

    return (
        <div className="cc-root" data-theme="dark" style={{ minHeight: "100vh", background: "var(--cc-page)", color: "var(--cc-text)", padding: 14, boxSizing: "border-box" }}>
            <div style={{ display: "flex", height: "calc(100vh - 28px)", background: "var(--cc-surface)", border: "1px solid var(--cc-border)", borderRadius: 16, overflow: "hidden" }}>
                <Sidebar active={section} />
                {section === "clients" && clientId ? <CoachClientProfile token={token} clientId={Number(clientId)} /> : null}
                {section === "clients" && !clientId ? <Dashboard token={token} /> : null}
                {section === "library" ? <CoachExerciseLibrary token={token} /> : null}
                {section === "metrics" ? <MetricsSection /> : null}
                {section === "forms" ? <CoachForms token={token} /> : null}
                {section === "tutorials" ? <CoachTutorials token={token} /> : null}
            </div>
        </div>
    );
};

export default CoachConsole;
