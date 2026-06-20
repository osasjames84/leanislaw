import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authBearerHeaders, authJsonHeaders } from "../apiHeaders";

const STATUS = {
    needs_attention: { label: "Needs attention", color: "#e5484d" },
    watch: { label: "Watch", color: "#f5a623" },
    on_track: { label: "On track", color: "#30a46c" },
};

function statusColor(p) {
    if (p == null) return "#8e8e93";
    return p >= 80 ? "#30a46c" : p >= 50 ? "#f5a623" : "#e5484d";
}

const card = {
    background: "#fff",
    borderRadius: 16,
    padding: 16,
    border: "0.5px solid #e5e5ea",
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
};

const CoachRoster = () => {
    const navigate = useNavigate();
    const { token } = useAuth();
    const [week, setWeek] = useState("");
    const [roster, setRoster] = useState(null);
    const [clients, setClients] = useState([]);
    const [err, setErr] = useState("");
    const [busy, setBusy] = useState(false);
    const [manage, setManage] = useState(false);
    const [newClient, setNewClient] = useState("");

    const qs = week ? `?week=${encodeURIComponent(week)}` : "";

    const loadRoster = useCallback(async () => {
        setErr("");
        try {
            const r = await fetch(`/api/v1/reports/roster${qs}`, {
                headers: authBearerHeaders(token),
            });
            const data = await r.json();
            if (data.error) setErr(data.error);
            else setRoster(data);
        } catch {
            setErr("Could not load roster.");
        }
    }, [token, qs]);

    const loadClients = useCallback(async () => {
        try {
            const r = await fetch("/api/v1/reports/clients", { headers: authBearerHeaders(token) });
            const data = await r.json();
            if (Array.isArray(data)) setClients(data);
        } catch {
            /* non-fatal */
        }
    }, [token]);

    useEffect(() => {
        if (token) {
            loadRoster();
            loadClients();
        }
    }, [token, loadRoster, loadClients]);

    const runReports = async () => {
        setBusy(true);
        setErr("");
        try {
            const r = await fetch("/api/v1/reports/run", {
                method: "POST",
                headers: authJsonHeaders(token),
                body: JSON.stringify(week ? { week_start: week } : {}),
            });
            const data = await r.json();
            if (data.error) setErr(data.error);
            else await loadRoster();
        } catch {
            setErr("Report run failed.");
        } finally {
            setBusy(false);
        }
    };

    const openBlob = async (url) => {
        try {
            const r = await fetch(url, { headers: authBearerHeaders(token) });
            if (!r.ok) {
                setErr("Could not open that file.");
                return;
            }
            const u = URL.createObjectURL(await r.blob());
            window.open(u, "_blank");
            setTimeout(() => URL.revokeObjectURL(u), 60000);
        } catch {
            setErr("Could not open that file.");
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
        const data = await r.json();
        if (data.error) setErr(data.error);
        else {
            setNewClient("");
            await loadClients();
        }
    };

    const updateTarget = async (clientId, target) => {
        await fetch(`/api/v1/reports/clients/${clientId}`, {
            method: "PATCH",
            headers: authJsonHeaders(token),
            body: JSON.stringify({ weekly_training_target: Number(target) }),
        });
        await loadClients();
    };

    const toggleHide = async (clientId, current) => {
        await fetch(`/api/v1/reports/clients/${clientId}/safeguarding`, {
            method: "PUT",
            headers: authJsonHeaders(token),
            body: JSON.stringify({ hide_raw_numbers: !current }),
        });
        await loadClients();
    };

    const s = roster?.summary;

    return (
        <div
            style={{
                minHeight: "100vh",
                background: "#f2f2f7",
                padding:
                    "calc(20px + env(safe-area-inset-top, 0px)) 16px calc(88px + env(safe-area-inset-bottom, 0px))",
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
            }}
        >
            <header style={{ marginBottom: 16 }}>
                <button
                    type="button"
                    onClick={() => navigate("/coach")}
                    style={{ border: "none", background: "none", color: "#007aff", fontWeight: 700, cursor: "pointer", padding: 0 }}
                >
                    ← Coach
                </button>
                <h1 style={{ margin: "10px 0 2px", fontSize: "1.5rem", fontWeight: 800 }}>Weekly reports</h1>
                <p style={{ margin: 0, color: "#8e8e93", fontSize: "0.9rem" }}>
                    {roster ? `Week of ${roster.week_start} → ${roster.week_end}` : "Loading…"}
                </p>
            </header>

            <div style={{ ...card, marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <label style={{ fontSize: "0.85rem", color: "#636366" }}>Week</label>
                <input
                    type="date"
                    value={week}
                    onChange={(e) => setWeek(e.target.value)}
                    onBlur={loadRoster}
                    style={{ padding: 8, borderRadius: 10, border: "1px solid #d1d1d6", fontSize: "0.9rem" }}
                />
                <button
                    type="button"
                    onClick={runReports}
                    disabled={busy}
                    style={{
                        marginLeft: "auto",
                        padding: "10px 16px",
                        borderRadius: 12,
                        border: "none",
                        background: busy ? "#9bc4ff" : "#007aff",
                        color: "#fff",
                        fontWeight: 700,
                        cursor: busy ? "default" : "pointer",
                    }}
                >
                    {busy ? "Generating…" : "Generate reports"}
                </button>
            </div>

            {err ? (
                <div style={{ ...card, marginBottom: 14, color: "#b42318", borderColor: "#fdd" }}>{err}</div>
            ) : null}

            {s ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 14 }}>
                    {[
                        ["needs_attention", s.needs_attention],
                        ["watch", s.watch],
                        ["on_track", s.on_track],
                    ].map(([k, n]) => (
                        <div key={k} style={{ ...card, textAlign: "center", padding: 14 }}>
                            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: STATUS[k].color }}>{n}</div>
                            <div style={{ fontSize: "0.72rem", color: "#8e8e93", textTransform: "uppercase", letterSpacing: 0.4 }}>
                                {STATUS[k].label}
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}

            {roster && roster.clients.length === 0 ? (
                <div style={{ ...card, marginBottom: 14, color: "#636366" }}>
                    No reports for this week yet. Add clients below, then tap <strong>Generate reports</strong>.
                </div>
            ) : null}

            {roster?.clients?.map((c) => (
                <div key={c.report_id} style={{ ...card, marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span
                            style={{
                                background: `${STATUS[c.status]?.color}22`,
                                color: STATUS[c.status]?.color,
                                borderRadius: 999,
                                padding: "3px 10px",
                                fontSize: "0.72rem",
                                fontWeight: 700,
                            }}
                        >
                            {STATUS[c.status]?.label}
                        </span>
                        <strong style={{ flex: 1 }}>{c.name}</strong>
                        {c.has_pdf ? (
                            <button
                                type="button"
                                onClick={() => openBlob(`/api/v1/reports/${c.report_id}/pdf`)}
                                style={{ border: "none", background: "none", color: "#007aff", fontWeight: 700, cursor: "pointer" }}
                            >
                                PDF ↗
                            </button>
                        ) : null}
                    </div>
                    <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: "0.82rem", color: "#636366" }}>
                        <span>
                            Training <strong style={{ color: statusColor(c.training_adherence) }}>{c.training_adherence ?? "—"}%</strong>
                        </span>
                        <span>
                            Logging <strong style={{ color: statusColor(c.log_adherence) }}>{c.log_adherence ?? "—"}%</strong>
                        </span>
                        <span>
                            Weight{" "}
                            <strong>
                                {c.weight_trend
                                    ? `${c.weight_trend.change > 0 ? "+" : ""}${c.weight_trend.change}kg (${c.weight_trend.pct_change}%)`
                                    : "—"}
                            </strong>
                        </span>
                    </div>
                    {c.flags?.length ? (
                        <ul style={{ margin: "8px 0 0", paddingLeft: 16, fontSize: "0.8rem", color: "#8a6d00" }}>
                            {c.flags.map((f, i) => (
                                <li key={i}>{f}</li>
                            ))}
                        </ul>
                    ) : null}
                </div>
            ))}

            {roster?.clients?.length ? (
                <button
                    type="button"
                    onClick={() => openBlob(`/api/v1/reports/dashboard${qs}`)}
                    style={{
                        width: "100%",
                        marginTop: 6,
                        padding: 12,
                        borderRadius: 12,
                        border: "1px solid #007aff",
                        background: "transparent",
                        color: "#007aff",
                        fontWeight: 700,
                        cursor: "pointer",
                    }}
                >
                    Open full dashboard ↗
                </button>
            ) : null}

            <button
                type="button"
                onClick={() => setManage((m) => !m)}
                style={{ marginTop: 20, border: "none", background: "none", color: "#007aff", fontWeight: 700, cursor: "pointer", padding: 0 }}
            >
                {manage ? "Hide client management" : "Manage clients"}
            </button>

            {manage ? (
                <div style={{ ...card, marginTop: 10 }}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                        <input
                            value={newClient}
                            onChange={(e) => setNewClient(e.target.value)}
                            placeholder="@username or user id"
                            style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid #d1d1d6" }}
                        />
                        <button
                            type="button"
                            onClick={addClient}
                            style={{ padding: "10px 14px", borderRadius: 10, border: "none", background: "#007aff", color: "#fff", fontWeight: 700, cursor: "pointer" }}
                        >
                            Add
                        </button>
                    </div>
                    {clients.length === 0 ? (
                        <p style={{ color: "#8e8e93", margin: 0 }}>No clients on your roster yet.</p>
                    ) : (
                        clients.map((cl) => (
                            <div
                                key={cl.client_id}
                                style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid #f0f0f3" }}
                            >
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600 }}>{cl.name}</div>
                                    <div style={{ fontSize: "0.75rem", color: "#8e8e93" }}>
                                        {cl.username ? `@${cl.username}` : `id ${cl.client_id}`}
                                    </div>
                                </div>
                                <label style={{ fontSize: "0.72rem", color: "#636366" }}>
                                    /wk
                                    <input
                                        type="number"
                                        min={0}
                                        max={14}
                                        defaultValue={cl.weekly_training_target}
                                        onBlur={(e) => updateTarget(cl.client_id, e.target.value)}
                                        style={{ width: 46, marginLeft: 4, padding: 4, borderRadius: 8, border: "1px solid #d1d1d6" }}
                                    />
                                </label>
                                <button
                                    type="button"
                                    onClick={() => toggleHide(cl.client_id, cl.hide_raw_numbers)}
                                    title="Hide raw numbers in the client's own app"
                                    style={{
                                        padding: "6px 10px",
                                        borderRadius: 8,
                                        border: "1px solid #d1d1d6",
                                        background: cl.hide_raw_numbers ? "#30a46c" : "#fff",
                                        color: cl.hide_raw_numbers ? "#fff" : "#636366",
                                        fontSize: "0.72rem",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                    }}
                                >
                                    {cl.hide_raw_numbers ? "Numbers hidden" : "Hide numbers"}
                                </button>
                            </div>
                        ))
                    )}
                </div>
            ) : null}
        </div>
    );
};

export default CoachRoster;
