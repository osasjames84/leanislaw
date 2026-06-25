import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authBearerHeaders, authJsonHeaders } from "../apiHeaders";

/**
 * Client coaching hub: plan, tasks/habits, meal plan, progress (measurements +
 * photos), forms, resources/documents, check-in + support. iOS-styled.
 */

const page = {
    minHeight: "100vh", background: "#f2f2f7",
    padding: "calc(20px + env(safe-area-inset-top, 0px)) 16px calc(96px + env(safe-area-inset-bottom, 0px))",
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
};
const card = { background: "#fff", borderRadius: 16, padding: 18, border: "0.5px solid #e5e5ea", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 14 };
const h2 = { margin: "0 0 4px", fontSize: "1.05rem", fontWeight: 800, color: "#1c1c1e" };
const small = { margin: "0 0 12px", color: "#8e8e93", fontSize: "0.82rem" };
const inp = { width: "100%", padding: 10, borderRadius: 10, border: "1px solid #d1d1d6", fontFamily: "inherit", fontSize: "0.92rem", boxSizing: "border-box" };
const WSTATUS = {
    assigned: { label: "To do", color: "#007aff", bg: "rgba(0,122,255,0.1)" },
    completed: { label: "Done", color: "#30a46c", bg: "rgba(48,164,108,0.12)" },
    skipped: { label: "Skipped", color: "#8e8e93", bg: "rgba(142,142,147,0.14)" },
};
function Tag({ status }) { const s = WSTATUS[status] || WSTATUS.assigned; return <span style={{ background: s.bg, color: s.color, borderRadius: 999, padding: "3px 10px", fontSize: "0.74rem", fontWeight: 700 }}>{s.label}</span>; }

const ClientCoaching = () => {
    const navigate = useNavigate();
    const { token } = useAuth();
    const [plan, setPlan] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [forms, setForms] = useState([]);
    const [tutorials, setTutorials] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [mealPlan, setMealPlan] = useState(null);
    const [prof, setProf] = useState(null);
    const [sg, setSg] = useState(null);
    const [err, setErr] = useState("");
    const [measure, setMeasure] = useState({ metric: "Weight", value: "", unit: "kg" });
    const fileRef = useRef(null);

    const J = useCallback((u) => fetch(u, { headers: authBearerHeaders(token) }).then((r) => r.json()), [token]);

    const load = useCallback(async () => {
        try {
            const [p, tk, f, t, d, mp, pr, s] = await Promise.all([
                J("/api/v1/programs/my/workouts"), J("/api/v1/tasks/my"), J("/api/v1/forms/my"),
                J("/api/v1/tutorials/my"), J("/api/v1/content/my/documents"), J("/api/v1/content/my/meal-plan"),
                J("/api/v1/profile/me/profile"), J("/api/v1/safeguarding/me"),
            ]);
            if (!p.error) setPlan(p);
            if (Array.isArray(tk)) setTasks(tk);
            if (Array.isArray(f)) setForms(f);
            if (Array.isArray(t)) setTutorials(t);
            if (Array.isArray(d)) setDocuments(d);
            if (mp && !mp.error) setMealPlan(mp);
            if (pr && !pr.error) setProf(pr);
            if (s && !s.error) setSg(s);
        } catch { setErr("Could not load your coaching."); }
    }, [J]);

    useEffect(() => { if (token) load(); }, [token, load]);

    const setStatus = async (id, action) => { await fetch(`/api/v1/programs/my/workouts/${id}/${action}`, { method: "POST", headers: authJsonHeaders(token) }); load(); };
    const toggleTask = async (id) => { await fetch(`/api/v1/tasks/my/${id}/toggle`, { method: "POST", headers: authJsonHeaders(token) }); load(); };
    const addMeasurement = async () => {
        if (!measure.value) return;
        await fetch("/api/v1/profile/me/measurements", { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify({ ...measure, value: Number(measure.value) }) });
        setMeasure((s) => ({ ...s, value: "" })); load();
    };
    const onPhoto = async (e) => {
        const file = e.target.files?.[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
            await fetch("/api/v1/profile/me/photos", { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify({ image_base64: reader.result, image_mime: file.type }) });
            load();
        };
        reader.readAsDataURL(file);
    };

    const workouts = plan?.workouts || [];
    const pendingForms = forms.filter((f) => f.status !== "completed");
    const photos = prof?.photos || [];

    return (
        <div style={page}>
            <h1 style={{ margin: "4px 0 2px", fontSize: "1.6rem", fontWeight: 800 }}>Coaching</h1>
            <p style={{ margin: "0 0 16px", color: "#8e8e93", fontSize: "0.9rem" }}>{plan?.coach ? `Coached by ${plan.coach}` : "Your plan, check-ins and resources"}</p>
            {err ? <div style={{ ...card, color: "#b42318" }}>{err}</div> : null}

            <button type="button" onClick={() => navigate("/ascend")} style={{ ...card, width: "100%", textAlign: "left", cursor: "pointer", border: "none", color: "#fff", background: "linear-gradient(135deg,#ff375f,#ff9f0a)", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: "1.6rem" }}>⚡</span>
                <span style={{ flex: 1 }}>
                    <span style={{ display: "block", fontWeight: 800, fontSize: "1.05rem" }}>Your Ascension</span>
                    <span style={{ display: "block", fontSize: "0.82rem", opacity: 0.9 }}>Looksmax score, streak, daily quests &amp; rank</span>
                </span>
                <span style={{ fontSize: "1.2rem", opacity: 0.9 }}>›</span>
            </button>

            {prof?.profile?.goal_text ? (
                <div style={{ ...card, background: "linear-gradient(135deg,#007aff,#0a84ff)", color: "#fff", border: "none" }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, opacity: 0.85, textTransform: "uppercase", letterSpacing: 0.5 }}>Your goal</div>
                    <div style={{ fontSize: "1.05rem", fontWeight: 700, marginTop: 4 }}>{prof.profile.goal_text}</div>
                    {prof.profile.goal_date ? <div style={{ fontSize: "0.82rem", opacity: 0.9, marginTop: 4 }}>Target: {prof.profile.goal_date}</div> : null}
                </div>
            ) : null}

            {sg && !sg.screen_completed ? (
                <button type="button" onClick={() => navigate("/setup/intake")} style={{ ...card, width: "100%", textAlign: "left", cursor: "pointer", background: "#fff3cd", border: "0.5px solid #ffe69c" }}>
                    <div style={{ fontWeight: 700, color: "#7a5b00" }}>Complete your intake</div>
                    <div style={{ fontSize: "0.85rem", color: "#7a5b00", marginTop: 2 }}>A quick health screen so your coach can train you safely. Tap to start.</div>
                </button>
            ) : null}

            {/* Tasks & habits */}
            {tasks.length ? (
                <div style={card}>
                    <h2 style={h2}>Today's tasks</h2>
                    <p style={small}>Tap to check off.</p>
                    {tasks.map((t) => (
                        <button key={t.id} type="button" onClick={() => toggleTask(t.id)} style={{ width: "100%", textAlign: "left", border: "none", background: "none", display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: "1px solid #f0f0f3", cursor: "pointer" }}>
                            <span style={{ width: 24, height: 24, borderRadius: "50%", border: t.done_today ? "none" : "2px solid #c7c7cc", background: t.done_today ? "#30a46c" : "transparent", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14 }}>{t.done_today ? "✓" : ""}</span>
                            <span style={{ flex: 1 }}>
                                <span style={{ fontWeight: 600, color: "#1c1c1e", textDecoration: t.done_today ? "line-through" : "none" }}>{t.title}</span>
                                <span style={{ display: "block", fontSize: "0.76rem", color: "#8e8e93" }}>{t.kind === "habit" ? "Daily habit" : t.due_date ? `Due ${t.due_date}` : "Task"}</span>
                            </span>
                        </button>
                    ))}
                </div>
            ) : null}

            {/* Plan */}
            <div style={card}>
                <h2 style={h2}>This week's plan</h2>
                <p style={small}>Workouts your coach assigned for this week.</p>
                {workouts.length === 0 ? <p style={{ margin: 0, color: "#636366", fontSize: "0.9rem" }}>No workouts assigned yet.</p> : workouts.map((w) => (
                    <div key={w.id} style={{ borderTop: "1px solid #f0f0f3", paddingTop: 12, marginTop: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div><div style={{ fontWeight: 700, color: "#1c1c1e" }}>{w.title}</div><div style={{ fontSize: "0.78rem", color: "#8e8e93" }}>{w.scheduled_date || "Anytime this week"}</div></div>
                            <Tag status={w.status} />
                        </div>
                        {w.exercises?.length ? <div style={{ marginTop: 8 }}>{w.exercises.map((e, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "#3a3a3c", padding: "3px 0" }}><span>{e.name}</span><span style={{ color: "#8e8e93" }}>{[e.sets && `${e.sets}×`, e.reps, e.weight].filter(Boolean).join(" ")}</span></div>)}</div> : null}
                        {w.notes ? <p style={{ margin: "8px 0 0", fontSize: "0.82rem", color: "#8e8e93", fontStyle: "italic" }}>{w.notes}</p> : null}
                        {w.status !== "completed" ? <div style={{ display: "flex", gap: 8, marginTop: 10 }}><button type="button" onClick={() => setStatus(w.id, "complete")} style={{ flex: 1, padding: 10, borderRadius: 10, border: "none", background: "#007aff", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Mark done</button><button type="button" onClick={() => setStatus(w.id, "skip")} style={{ padding: "10px 14px", borderRadius: 10, border: "0.5px solid #d1d1d6", background: "#fff", color: "#636366", fontWeight: 600, cursor: "pointer" }}>Skip</button></div> : null}
                    </div>
                ))}
            </div>

            {/* Meal plan */}
            {mealPlan ? (
                <div style={card}>
                    <h2 style={h2}>{mealPlan.title || "Meal plan"}</h2>
                    {mealPlan.target_calories ? <p style={small}>{mealPlan.target_calories} kcal · {mealPlan.target_protein_g || "—"}P / {mealPlan.target_carbs_g || "—"}C / {mealPlan.target_fat_g || "—"}F</p> : null}
                    {(mealPlan.meals || []).map((mm, i) => (
                        <div key={i} style={{ borderTop: "1px solid #f0f0f3", paddingTop: 10, marginTop: 10 }}>
                            <div style={{ fontWeight: 700, color: "#1c1c1e", fontSize: "0.92rem" }}>{mm.name}</div>
                            {(mm.items || []).map((it, k) => <div key={k} style={{ fontSize: "0.85rem", color: "#3a3a3c", padding: "1px 0" }}>• {it}</div>)}
                        </div>
                    ))}
                    {mealPlan.notes ? <p style={{ fontSize: "0.82rem", color: "#8e8e93", marginTop: 10 }}>{mealPlan.notes}</p> : null}
                </div>
            ) : null}

            {/* Progress: measurements + photos */}
            <div style={card}>
                <h2 style={h2}>Progress</h2>
                <p style={small}>Log a measurement so your coach can track it.</p>
                <div style={{ display: "flex", gap: 8 }}>
                    <select value={measure.metric} onChange={(e) => setMeasure((s) => ({ ...s, metric: e.target.value, unit: e.target.value === "Weight" ? "kg" : e.target.value === "Body fat" ? "%" : "cm" }))} style={{ ...inp, flex: 1.2 }}>
                        {["Weight", "Body fat", "Chest", "Shoulders", "Waist", "Hips", "Arm", "Thigh"].map((m) => <option key={m}>{m}</option>)}
                    </select>
                    <input type="number" value={measure.value} onChange={(e) => setMeasure((s) => ({ ...s, value: e.target.value }))} placeholder="Value" style={{ ...inp, flex: 1 }} />
                    <button type="button" onClick={addMeasurement} disabled={!measure.value} style={{ padding: "0 16px", borderRadius: 10, border: "none", background: "#007aff", color: "#fff", fontWeight: 700, cursor: "pointer", opacity: measure.value ? 1 : 0.5 }}>Log</button>
                </div>
                {prof?.measurements?.length ? (
                    <div style={{ marginTop: 12 }}>
                        {prof.measurements.map((mm) => <div key={mm.metric} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", padding: "5px 0", borderTop: "1px solid #f0f0f3" }}><span style={{ color: "#1c1c1e", fontWeight: 600 }}>{mm.metric}</span><span style={{ color: "#8e8e93" }}>{mm.latest?.value}{mm.unit}</span></div>)}
                    </div>
                ) : null}
                <div style={{ marginTop: 14 }}>
                    <input ref={fileRef} type="file" accept="image/*" onChange={onPhoto} style={{ display: "none" }} />
                    <button type="button" onClick={() => fileRef.current?.click()} style={{ width: "100%", padding: 11, borderRadius: 10, border: "0.5px dashed #c7c7cc", background: "#fafafa", color: "#007aff", fontWeight: 700, cursor: "pointer" }}>+ Add progress photo</button>
                    {photos.length ? (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 10 }}>
                            {photos.slice(0, 6).map((p) => <img key={p.id} src={p.image} alt="progress" style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: 8 }} />)}
                        </div>
                    ) : null}
                </div>
            </div>

            {/* Forms */}
            {forms.length ? (
                <div style={card}>
                    <h2 style={h2}>Forms{pendingForms.length ? ` · ${pendingForms.length} to do` : ""}</h2>
                    {forms.map((f) => (
                        <button key={f.id} type="button" onClick={() => navigate(`/coaching/forms/${f.id}`)} style={{ width: "100%", textAlign: "left", border: "none", background: "none", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: "1px solid #f0f0f3", cursor: "pointer" }}>
                            <div><div style={{ fontWeight: 600, color: "#1c1c1e" }}>{f.title}</div>{f.description ? <div style={{ fontSize: "0.8rem", color: "#8e8e93" }}>{f.description}</div> : null}</div>
                            <span style={{ color: f.status === "completed" ? "#30a46c" : "#007aff", fontWeight: 700, fontSize: "0.82rem" }}>{f.status === "completed" ? "Done" : "Fill in →"}</span>
                        </button>
                    ))}
                </div>
            ) : null}

            {/* Resources + documents */}
            {(tutorials.length || documents.length) ? (
                <div style={card}>
                    <h2 style={h2}>From your coach</h2>
                    {tutorials.map((t) => (
                        <a key={`t${t.id}`} href={t.url || "#"} target="_blank" rel="noreferrer" style={{ display: "block", padding: "10px 0", borderTop: "1px solid #f0f0f3", textDecoration: "none" }}>
                            {t.category ? <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#007aff", textTransform: "uppercase", letterSpacing: 0.4 }}>{t.category}</div> : null}
                            <div style={{ fontWeight: 600, color: "#1c1c1e" }}>{t.title}</div>
                            {t.description ? <div style={{ fontSize: "0.8rem", color: "#8e8e93", marginTop: 2 }}>{t.description}</div> : null}
                        </a>
                    ))}
                    {documents.map((d) => (
                        <a key={`d${d.id}`} href={d.url || "#"} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderTop: "1px solid #f0f0f3", textDecoration: "none" }}>
                            <span style={{ fontSize: "1rem" }}>📄</span>
                            <div style={{ flex: 1 }}><div style={{ fontWeight: 600, color: "#1c1c1e" }}>{d.title}</div>{d.note ? <div style={{ fontSize: "0.8rem", color: "#8e8e93" }}>{d.note}</div> : null}</div>
                        </a>
                    ))}
                </div>
            ) : null}

            {/* Quick links */}
            <div style={card}>
                <button type="button" onClick={() => navigate("/me/week")} style={{ width: "100%", textAlign: "left", border: "none", background: "none", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", cursor: "pointer" }}><span style={{ fontWeight: 600, color: "#1c1c1e" }}>Weekly check-in</span><span style={{ color: "#c7c7cc" }}>›</span></button>
                <button type="button" onClick={() => navigate("/support")} style={{ width: "100%", textAlign: "left", border: "none", background: "none", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid #f0f0f3", cursor: "pointer" }}><span style={{ fontWeight: 600, color: "#1c1c1e" }}>Support &amp; wellbeing</span><span style={{ color: "#c7c7cc" }}>›</span></button>
            </div>
        </div>
    );
};

export default ClientCoaching;
