import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authBearerHeaders, authJsonHeaders } from "../apiHeaders";

/**
 * Client coaching hub: this week's plan (assigned workouts), forms to complete,
 * resources from the coach, and quick links to the weekly check-in + support.
 * iOS-styled to match the rest of the client app.
 */

const page = {
    minHeight: "100vh",
    background: "#f2f2f7",
    padding: "calc(20px + env(safe-area-inset-top, 0px)) 16px calc(96px + env(safe-area-inset-bottom, 0px))",
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
};
const card = { background: "#fff", borderRadius: 16, padding: 18, border: "0.5px solid #e5e5ea", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14 };
const h2 = { margin: "0 0 4px", fontSize: "1.05rem", fontWeight: 800, color: "#1c1c1e" };
const WSTATUS = {
    assigned: { label: "To do", color: "#007aff", bg: "rgba(0,122,255,0.1)" },
    completed: { label: "Done", color: "#30a46c", bg: "rgba(48,164,108,0.12)" },
    skipped: { label: "Skipped", color: "#8e8e93", bg: "rgba(142,142,147,0.14)" },
};

function Tag({ status }) {
    const s = WSTATUS[status] || WSTATUS.assigned;
    return <span style={{ background: s.bg, color: s.color, borderRadius: 999, padding: "3px 10px", fontSize: "0.74rem", fontWeight: 700 }}>{s.label}</span>;
}

const ClientCoaching = () => {
    const navigate = useNavigate();
    const { token } = useAuth();
    const [plan, setPlan] = useState(null);
    const [forms, setForms] = useState([]);
    const [tutorials, setTutorials] = useState([]);
    const [sg, setSg] = useState(null);
    const [err, setErr] = useState("");

    const load = useCallback(async () => {
        try {
            const [p, f, t, s] = await Promise.all([
                fetch("/api/v1/programs/my/workouts", { headers: authBearerHeaders(token) }).then((r) => r.json()),
                fetch("/api/v1/forms/my", { headers: authBearerHeaders(token) }).then((r) => r.json()),
                fetch("/api/v1/tutorials/my", { headers: authBearerHeaders(token) }).then((r) => r.json()),
                fetch("/api/v1/safeguarding/me", { headers: authBearerHeaders(token) }).then((r) => r.json()),
            ]);
            if (!p.error) setPlan(p);
            if (Array.isArray(f)) setForms(f);
            if (Array.isArray(t)) setTutorials(t);
            if (!s.error) setSg(s);
        } catch { setErr("Could not load your coaching."); }
    }, [token]);

    useEffect(() => { if (token) load(); }, [token, load]);

    const setStatus = async (id, action) => {
        try {
            await fetch(`/api/v1/programs/my/workouts/${id}/${action}`, { method: "POST", headers: authJsonHeaders(token) });
            load();
        } catch { setErr("Could not update that workout."); }
    };

    const workouts = plan?.workouts || [];
    const pendingForms = forms.filter((f) => f.status !== "completed");

    return (
        <div style={page}>
            <h1 style={{ margin: "4px 0 2px", fontSize: "1.6rem", fontWeight: 800 }}>Coaching</h1>
            <p style={{ margin: "0 0 16px", color: "#8e8e93", fontSize: "0.9rem" }}>
                {plan?.coach ? `Coached by ${plan.coach}` : "Your plan, check-ins and resources"}
            </p>

            {err ? <div style={{ ...card, color: "#b42318" }}>{err}</div> : null}

            {sg && !sg.screen_completed ? (
                <button type="button" onClick={() => navigate("/setup/intake")} style={{ ...card, width: "100%", textAlign: "left", cursor: "pointer", background: "#fff3cd", border: "0.5px solid #ffe69c" }}>
                    <div style={{ fontWeight: 700, color: "#7a5b00" }}>Complete your intake</div>
                    <div style={{ fontSize: "0.85rem", color: "#7a5b00", marginTop: 2 }}>A quick health screen so your coach can train you safely. Tap to start.</div>
                </button>
            ) : null}

            {/* This week's plan */}
            <div style={card}>
                <h2 style={h2}>This week's plan</h2>
                <p style={{ margin: "0 0 12px", color: "#8e8e93", fontSize: "0.82rem" }}>Workouts your coach assigned for this week.</p>
                {workouts.length === 0 ? (
                    <p style={{ margin: 0, color: "#636366", fontSize: "0.9rem" }}>No workouts assigned yet. Your coach will add them here.</p>
                ) : (
                    workouts.map((w) => (
                        <div key={w.id} style={{ borderTop: "1px solid #f0f0f3", paddingTop: 12, marginTop: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontWeight: 700, color: "#1c1c1e" }}>{w.title}</div>
                                    <div style={{ fontSize: "0.78rem", color: "#8e8e93" }}>{w.scheduled_date || "Anytime this week"}</div>
                                </div>
                                <Tag status={w.status} />
                            </div>
                            {w.exercises?.length ? (
                                <div style={{ marginTop: 8 }}>
                                    {w.exercises.map((e, i) => (
                                        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "#3a3a3c", padding: "3px 0" }}>
                                            <span>{e.name}</span>
                                            <span style={{ color: "#8e8e93" }}>{[e.sets && `${e.sets}×`, e.reps, e.weight].filter(Boolean).join(" ")}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                            {w.notes ? <p style={{ margin: "8px 0 0", fontSize: "0.82rem", color: "#8e8e93", fontStyle: "italic" }}>{w.notes}</p> : null}
                            {w.status !== "completed" ? (
                                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                                    <button type="button" onClick={() => setStatus(w.id, "complete")} style={{ flex: 1, padding: 10, borderRadius: 10, border: "none", background: "#007aff", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Mark done</button>
                                    <button type="button" onClick={() => setStatus(w.id, "skip")} style={{ padding: "10px 14px", borderRadius: 10, border: "0.5px solid #d1d1d6", background: "#fff", color: "#636366", fontWeight: 600, cursor: "pointer" }}>Skip</button>
                                </div>
                            ) : null}
                        </div>
                    ))
                )}
            </div>

            {/* Forms */}
            {forms.length ? (
                <div style={card}>
                    <h2 style={h2}>Forms{pendingForms.length ? ` · ${pendingForms.length} to do` : ""}</h2>
                    {forms.map((f) => (
                        <button key={f.id} type="button" onClick={() => navigate(`/coaching/forms/${f.id}`)} style={{ width: "100%", textAlign: "left", border: "none", background: "none", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: "1px solid #f0f0f3", cursor: "pointer" }}>
                            <div>
                                <div style={{ fontWeight: 600, color: "#1c1c1e" }}>{f.title}</div>
                                {f.description ? <div style={{ fontSize: "0.8rem", color: "#8e8e93" }}>{f.description}</div> : null}
                            </div>
                            <span style={{ color: f.status === "completed" ? "#30a46c" : "#007aff", fontWeight: 700, fontSize: "0.82rem" }}>{f.status === "completed" ? "Done" : "Fill in →"}</span>
                        </button>
                    ))}
                </div>
            ) : null}

            {/* Tutorials */}
            {tutorials.length ? (
                <div style={card}>
                    <h2 style={h2}>From your coach</h2>
                    {tutorials.map((t) => (
                        <a key={t.id} href={t.url || "#"} target="_blank" rel="noreferrer" style={{ display: "block", padding: "10px 0", borderTop: "1px solid #f0f0f3", textDecoration: "none" }}>
                            {t.category ? <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#007aff", textTransform: "uppercase", letterSpacing: 0.4 }}>{t.category}</div> : null}
                            <div style={{ fontWeight: 600, color: "#1c1c1e" }}>{t.title}</div>
                            {t.description ? <div style={{ fontSize: "0.8rem", color: "#8e8e93", marginTop: 2 }}>{t.description}</div> : null}
                        </a>
                    ))}
                </div>
            ) : null}

            {/* Quick links */}
            <div style={card}>
                <button type="button" onClick={() => navigate("/me/week")} style={{ width: "100%", textAlign: "left", border: "none", background: "none", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", cursor: "pointer" }}>
                    <span style={{ fontWeight: 600, color: "#1c1c1e" }}>Weekly check-in</span>
                    <span style={{ color: "#c7c7cc" }}>›</span>
                </button>
                <button type="button" onClick={() => navigate("/support")} style={{ width: "100%", textAlign: "left", border: "none", background: "none", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid #f0f0f3", cursor: "pointer" }}>
                    <span style={{ fontWeight: 600, color: "#1c1c1e" }}>Support &amp; wellbeing</span>
                    <span style={{ color: "#c7c7cc" }}>›</span>
                </button>
            </div>
        </div>
    );
};

export default ClientCoaching;
