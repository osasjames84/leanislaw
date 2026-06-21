import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authBearerHeaders, authJsonHeaders } from "../apiHeaders";
import {
    Avatar, Pill, StatCard, Empty, AlertBanner, MetricLine, ProgressionItem, MiniNutrition,
    minusSign, signed, displayFlag, openBlob,
} from "./coachShared";

const TABS = ["Overview", "Program", "Tasks", "Metrics", "Nutrition", "Meal plan", "Photos", "Documents", "Check-ins", "Reports", "Settings"];
const WORKOUT_STATUS = {
    assigned: { label: "Assigned", color: "var(--cc-text2)" },
    completed: { label: "Completed", color: "var(--cc-success)" },
    skipped: { label: "Skipped", color: "var(--cc-danger)" },
};
const MEASURE_PRESETS = ["Weight", "Body fat", "Chest", "Shoulders", "Waist", "Hips", "Arm", "Thigh"];

const card = { background: "var(--cc-panel)", border: "1px solid var(--cc-border)", borderRadius: 14, padding: 18 };
const sectionTitle = { fontSize: 13, fontWeight: 700, color: "var(--cc-text)", margin: "0 0 12px", letterSpacing: 0.2 };
const input = { background: "var(--cc-panel2)", border: "1px solid var(--cc-border)", borderRadius: 8, color: "var(--cc-text)", fontSize: 13, padding: "9px 11px", boxSizing: "border-box" };

function daysUntil(dateStr) {
    if (!dateStr) return null;
    const d = Math.ceil((new Date(dateStr) - new Date()) / 86400000);
    return d;
}

/* ---------------- inline editable text block ---------------- */
function EditableBlock({ title, value, placeholder, onSave }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value || "");
    useEffect(() => { setDraft(value || ""); }, [value]);
    return (
        <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <h3 style={{ ...sectionTitle, margin: 0 }}>{title}</h3>
                {editing ? (
                    <span style={{ display: "flex", gap: 8 }}>
                        <button type="button" onClick={() => { onSave(draft); setEditing(false); }} style={{ border: "none", background: "var(--cc-accent-bg)", color: "var(--cc-accent)", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Save</button>
                        <button type="button" onClick={() => { setDraft(value || ""); setEditing(false); }} style={{ border: "none", background: "none", color: "var(--cc-text3)", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                    </span>
                ) : (
                    <button type="button" onClick={() => setEditing(true)} style={{ border: "none", background: "none", color: "var(--cc-accent)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Edit</button>
                )}
            </div>
            {editing ? (
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} style={{ ...input, width: "100%", resize: "vertical", fontFamily: "inherit" }} />
            ) : value ? (
                <p style={{ fontSize: 13, color: "var(--cc-text2)", lineHeight: 1.5, margin: 0, whiteSpace: "pre-wrap" }}>{value}</p>
            ) : <Empty text={placeholder} />}
        </div>
    );
}

/* ---------------- AI overview ---------------- */
function AiOverview({ data }) {
    if (!data) return <Empty text="Loading weekly overview…" />;
    if (data.has_report === false) return <Empty text="No report yet — generate this week's reports first." />;
    return (
        <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <i className="ti ti-sparkles" aria-hidden="true" style={{ color: "var(--cc-accent)", fontSize: 16 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--cc-text)" }}>AI weekly overview</span>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--cc-text3)", border: "1px solid var(--cc-border)", borderRadius: 999, padding: "2px 8px" }}>{data.ai ? `Claude · ${data.model}` : "Auto summary"}</span>
            </div>
            <p style={{ fontSize: 13.5, color: "var(--cc-text)", lineHeight: 1.55, margin: "0 0 12px" }}>{data.summary}</p>
            {data.actions?.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {data.actions.map((a, i) => (
                        <div key={i} style={{ display: "flex", gap: 8, fontSize: 12.5, color: "var(--cc-text2)" }}>
                            <i className="ti ti-arrow-right" aria-hidden="true" style={{ color: "var(--cc-accent)", fontSize: 14, marginTop: 2 }} /><span>{a}</span>
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

/* ---------------- program ---------------- */
function ExerciseRow({ ex, onChange, onRemove, names }) {
    const f = (k, v) => onChange({ ...ex, [k]: v });
    const i2 = { ...input, fontSize: 12.5, padding: "7px 9px" };
    return (
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 0.6fr 0.8fr 0.8fr 28px", gap: 8, alignItems: "center" }}>
            <input list="cc-ex-names" value={ex.name} onChange={(e) => f("name", e.target.value)} placeholder="Exercise" style={i2} />
            <input value={ex.sets ?? ""} onChange={(e) => f("sets", e.target.value)} placeholder="Sets" style={i2} />
            <input value={ex.reps ?? ""} onChange={(e) => f("reps", e.target.value)} placeholder="Reps" style={i2} />
            <input value={ex.weight ?? ""} onChange={(e) => f("weight", e.target.value)} placeholder="Load" style={i2} />
            <button type="button" onClick={onRemove} style={{ border: "none", background: "none", color: "var(--cc-text3)", cursor: "pointer", fontSize: 16 }}><i className="ti ti-x" aria-hidden="true" /></button>
            <datalist id="cc-ex-names">{(names || []).map((n) => <option key={n} value={n} />)}</datalist>
        </div>
    );
}
function AssignForm({ onSave, names, busy }) {
    const blank = { title: "", scheduled_date: "", notes: "", exercises: [{ name: "", sets: "", reps: "", weight: "" }] };
    const [form, setForm] = useState(blank);
    const setEx = (i, ex) => setForm((s) => ({ ...s, exercises: s.exercises.map((e, j) => (j === i ? ex : e)) }));
    const addEx = () => setForm((s) => ({ ...s, exercises: [...s.exercises, { name: "", sets: "", reps: "", weight: "" }] }));
    const rmEx = (i) => setForm((s) => ({ ...s, exercises: s.exercises.filter((_, j) => j !== i) }));
    const save = async () => { if (!form.title.trim()) return; const ok = await onSave({ ...form, exercises: form.exercises.filter((e) => e.name.trim()) }); if (ok) setForm(blank); };
    return (
        <div style={{ ...card, marginBottom: 16 }}>
            <h3 style={sectionTitle}>Assign a workout</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 10, marginBottom: 10 }}>
                <input value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} placeholder="Workout title (e.g. Upper A — Push)" style={input} />
                <input type="date" value={form.scheduled_date} onChange={(e) => setForm((s) => ({ ...s, scheduled_date: e.target.value }))} style={input} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {form.exercises.map((ex, i) => <ExerciseRow key={i} ex={ex} names={names} onChange={(e) => setEx(i, e)} onRemove={() => rmEx(i)} />)}
            </div>
            <button type="button" onClick={addEx} style={{ marginTop: 10, border: "1px dashed var(--cc-border)", background: "transparent", color: "var(--cc-text2)", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, cursor: "pointer" }}><i className="ti ti-plus" aria-hidden="true" /> Add exercise</button>
            <textarea value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} rows={2} placeholder="Notes for the client (optional)" style={{ ...input, width: "100%", marginTop: 10, resize: "vertical", fontFamily: "inherit" }} />
            <div style={{ marginTop: 12 }}>
                <button type="button" onClick={save} disabled={busy || !form.title.trim()} style={{ background: "var(--cc-accent-bg)", color: "var(--cc-accent)", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: form.title.trim() ? 1 : 0.5 }}>{busy ? "Saving…" : "Assign workout"}</button>
            </div>
        </div>
    );
}
function WorkoutCard({ w, onDelete }) {
    const st = WORKOUT_STATUS[w.status] || WORKOUT_STATUS.assigned;
    return (
        <div style={{ ...card, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "var(--cc-text)" }}>{w.title}</div>
                    <div style={{ fontSize: 11.5, color: "var(--cc-text3)" }}>{w.scheduled_date || "Unscheduled"}</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: st.color }}>{st.label}</span>
                <button type="button" onClick={onDelete} style={{ border: "none", background: "none", color: "var(--cc-text3)", cursor: "pointer", fontSize: 15 }}><i className="ti ti-trash" aria-hidden="true" /></button>
            </div>
            {w.exercises?.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {w.exercises.map((e, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--cc-text2)", padding: "3px 0", borderTop: i ? "1px solid var(--cc-border-soft)" : "none" }}>
                            <span style={{ color: "var(--cc-text)" }}>{e.name}</span>
                            <span>{[e.sets && `${e.sets}×`, e.reps, e.weight].filter(Boolean).join(" ") || "—"}</span>
                        </div>
                    ))}
                </div>
            ) : <Empty text="No exercises listed." />}
            {w.notes ? <p style={{ fontSize: 12, color: "var(--cc-text3)", fontStyle: "italic", margin: "8px 0 0" }}>{w.notes}</p> : null}
        </div>
    );
}

/* ============================ main ============================ */
export default function CoachClientProfile({ token, clientId, week = "" }) {
    const navigate = useNavigate();
    const [tab, setTab] = useState("Overview");
    const [metricsView, setMetricsView] = useState("body");
    const [data, setData] = useState(null);
    const [sg, setSg] = useState(null);
    const [history, setHistory] = useState([]);
    const [bodyHist, setBodyHist] = useState([]);
    const [progression, setProgression] = useState([]);
    const [ai, setAi] = useState(null);
    const [workouts, setWorkouts] = useState([]);
    const [exNames, setExNames] = useState([]);
    const [profile, setProfile] = useState(null);
    const [measurements, setMeasurements] = useState([]);
    const [photos, setPhotos] = useState([]);
    const [activity, setActivity] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [mealPlan, setMealPlan] = useState(null);
    const [documents, setDocuments] = useState([]);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const qs = week ? `?week=${encodeURIComponent(week)}` : "";

    const J = useCallback((url) => fetch(url, { headers: authBearerHeaders(token) }).then((r) => r.json()), [token]);

    const loadCore = useCallback(async () => {
        try {
            const [rep, safe, hist, bm, prog, wk, prof, acts, tk, mp, docs] = await Promise.all([
                J(`/api/v1/reports/clients/${clientId}/report${qs}`),
                J(`/api/v1/reports/clients/${clientId}/safeguarding`),
                J(`/api/v1/reports/clients/${clientId}/reports`),
                J(`/api/v1/reports/clients/${clientId}/body-metrics?weeks=12`),
                J(`/api/v1/reports/clients/${clientId}/progression`),
                J(`/api/v1/programs/clients/${clientId}/workouts`),
                J(`/api/v1/profile/clients/${clientId}/profile`),
                J(`/api/v1/profile/clients/${clientId}/activity`),
                J(`/api/v1/tasks/clients/${clientId}`),
                J(`/api/v1/content/clients/${clientId}/meal-plan`),
                J(`/api/v1/content/clients/${clientId}/documents`),
            ]);
            setData(rep.error ? { has_report: false } : rep);
            if (!safe.error) setSg(safe);
            if (Array.isArray(hist)) setHistory(hist);
            if (Array.isArray(bm)) setBodyHist(bm);
            if (Array.isArray(prog)) setProgression(prog);
            if (Array.isArray(wk)) setWorkouts(wk);
            if (prof && !prof.error) { setProfile(prof.profile); setMeasurements(prof.measurements || []); setPhotos(prof.photos || []); }
            if (Array.isArray(acts)) setActivity(acts);
            if (Array.isArray(tk)) setTasks(tk);
            if (mp && !mp.error) setMealPlan(mp);
            if (Array.isArray(docs)) setDocuments(docs);
        } catch { setErr("Could not load this client."); }
    }, [clientId, qs, J]);

    useEffect(() => { loadCore(); }, [loadCore]);
    useEffect(() => {
        let cancelled = false; setAi(null);
        J(`/api/v1/reports/clients/${clientId}/ai-overview${qs}`).then((d) => { if (!cancelled) setAi(d); }).catch(() => {});
        return () => { cancelled = true; };
    }, [clientId, qs, J]);
    useEffect(() => { J(`/api/v1/exercises`).then((d) => { if (Array.isArray(d)) setExNames([...new Set(d.map((e) => e.name))].sort()); }).catch(() => {}); }, [J]);

    const saveSafe = async (patch) => {
        await fetch(`/api/v1/reports/clients/${clientId}/safeguarding`, { method: "PUT", headers: authJsonHeaders(token), body: JSON.stringify(patch) });
        const d = await J(`/api/v1/reports/clients/${clientId}/safeguarding`); if (!d.error) setSg(d);
    };
    const saveProfile = async (patch) => {
        const d = await fetch(`/api/v1/profile/clients/${clientId}/profile`, { method: "PUT", headers: authJsonHeaders(token), body: JSON.stringify(patch) }).then((r) => r.json());
        if (!d.error) setProfile(d);
    };
    const assignWorkout = async (payload) => {
        setBusy(true); setErr("");
        try {
            const d = await fetch(`/api/v1/programs/clients/${clientId}/workouts`, { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify(payload) }).then((r) => r.json());
            if (d.error) { setErr(d.error); return false; } setWorkouts((w) => [...w, d]); return true;
        } catch { setErr("Could not assign that workout."); return false; } finally { setBusy(false); }
    };
    const deleteWorkout = async (id) => { await fetch(`/api/v1/programs/workouts/${id}`, { method: "DELETE", headers: authBearerHeaders(token) }); setWorkouts((w) => w.filter((x) => x.id !== id)); };
    const addTask = async (payload) => { const d = await fetch(`/api/v1/tasks/clients/${clientId}`, { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify(payload) }).then((r) => r.json()); if (!d.error) setTasks((t) => [{ ...d, last7_completions: 0 }, ...t]); };
    const delTask = async (id) => { await fetch(`/api/v1/tasks/${id}`, { method: "DELETE", headers: authBearerHeaders(token) }); setTasks((t) => t.filter((x) => x.id !== id)); };
    const addMeasurement = async (payload) => { const d = await fetch(`/api/v1/profile/clients/${clientId}/measurements`, { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify(payload) }).then((r) => r.json()); if (!d.error) { const p = await J(`/api/v1/profile/clients/${clientId}/profile`); if (!p.error) setMeasurements(p.measurements || []); } };
    const addDocument = async (payload) => { const d = await fetch(`/api/v1/content/clients/${clientId}/documents`, { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify(payload) }).then((r) => r.json()); if (!d.error) setDocuments((x) => [d, ...x]); };
    const delDocument = async (id) => { await fetch(`/api/v1/content/documents/${id}`, { method: "DELETE", headers: authBearerHeaders(token) }); setDocuments((x) => x.filter((d) => d.id !== id)); };
    const saveMealPlan = async (payload) => { const d = await fetch(`/api/v1/content/clients/${clientId}/meal-plan`, { method: "PUT", headers: authJsonHeaders(token), body: JSON.stringify(payload) }).then((r) => r.json()); if (!d.error) setMealPlan(d); };
    const removeClient = async () => { if (!window.confirm("Remove this client from your roster?")) return; await fetch(`/api/v1/reports/clients/${clientId}`, { method: "DELETE", headers: authBearerHeaders(token) }); navigate("/coach"); };

    const m = data?.model;
    const status = data?.status;
    const topFlag = useMemo(() => (data?.flags || []).find((f) => /low|fast|no check|high stress/i.test(f)), [data]);
    const name = profile?.name || m?.name || `Client #${clientId}`;
    const planCompleted = workouts.filter((w) => w.status === "completed").length;
    const goalDays = daysUntil(profile?.goal_date);

    return (
        <main style={{ flex: 1, minWidth: 0, height: "100%", overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
            {/* header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button type="button" onClick={() => navigate("/coach")} style={{ border: "1px solid var(--cc-border)", background: "var(--cc-panel)", color: "var(--cc-text2)", borderRadius: 8, width: 34, height: 34, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="ti ti-arrow-left" aria-hidden="true" style={{ fontSize: 17 }} /></button>
                <Avatar name={name} status={status} size={42} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.4px", color: "var(--cc-text)" }}>{name}</h1>
                    <div style={{ fontSize: 12.5, color: "var(--cc-text3)" }}>{m?.goal || profile?.package || "Client"}{data?.week_start ? ` · week of ${data.week_start}` : ""}</div>
                </div>
                {status ? <Pill status={status} /> : null}
            </div>

            {err ? <AlertBanner text={err} /> : null}

            {/* tabs */}
            <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--cc-border)", overflowX: "auto" }}>
                {TABS.map((t) => (
                    <button key={t} type="button" onClick={() => setTab(t)} style={{ border: "none", background: "none", padding: "8px 12px", fontSize: 13.5, fontWeight: tab === t ? 600 : 500, color: tab === t ? "var(--cc-accent)" : "var(--cc-text2)", borderBottom: tab === t ? "2px solid var(--cc-accent)" : "2px solid transparent", cursor: "pointer", marginBottom: -1, whiteSpace: "nowrap" }}>{t}</button>
                ))}
            </div>

            {/* ---------- OVERVIEW ---------- */}
            {tab === "Overview" ? (
                <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.4fr 1fr", gap: 16, alignItems: "start" }}>
                    {/* left */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={card}>
                            <h3 style={sectionTitle}>Training</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                <StatCard label="This week" value={m ? `${m.training?.completed ?? 0} / ${m.training?.assigned ?? 0}` : "—"} />
                                <StatCard label="Plan done" value={`${planCompleted} / ${workouts.length}`} />
                            </div>
                        </div>
                        <div style={card}>
                            <h3 style={sectionTitle}>Goal</h3>
                            {profile?.goal_text ? (
                                <>
                                    <p style={{ fontSize: 14, color: "var(--cc-text)", margin: "0 0 6px", lineHeight: 1.4 }}>{profile.goal_text}</p>
                                    {goalDays != null ? <div style={{ fontSize: 12.5, color: goalDays >= 0 ? "var(--cc-accent)" : "var(--cc-text3)", fontWeight: 600 }}>{goalDays >= 0 ? `${goalDays} days to go` : "Target date passed"} · {profile.goal_date}</div> : null}
                                </>
                            ) : <Empty text="No goal set. Add one in the Settings tab or here on the client." />}
                        </div>
                        <div style={card}>
                            <h3 style={sectionTitle}>Body metrics</h3>
                            <MetricLine series={bodyHist.map((p) => ({ date: p.date, value: p.weight }))} unit="kg" />
                            {m?.body?.trend ? <p style={{ fontSize: 12.5, color: "var(--cc-text2)", marginTop: 8 }}>{m.body.trend.start} → {m.body.trend.end} {m.body.unit} ({signed(m.body.trend.change)}, {minusSign(m.body.trend.pct_change)}%)</p> : null}
                        </div>
                    </div>
                    {/* middle */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={card}><AiOverview data={ai} /></div>
                        {topFlag ? <AlertBanner text={displayFlag(topFlag, m?.body?.trend)} /> : null}
                        <EditableBlock title="Coach notes" value={profile?.coach_notes} placeholder="Private notes about this client…" onSave={(v) => saveProfile({ coach_notes: v })} />
                        <EditableBlock title="Injuries & limitations" value={profile?.injuries} placeholder="Any injuries or movement limitations…" onSave={(v) => saveProfile({ injuries: v })} />
                    </div>
                    {/* right */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={card}>
                            <h3 style={sectionTitle}>Profile</h3>
                            <ProfileRow icon="ti-mail" value={profile?.email} />
                            <ProfileRow icon="ti-phone" value={profile?.phone} />
                            <ProfileRow icon="ti-map-pin" value={profile?.location} />
                            <ProfileRow icon="ti-package" value={profile?.package} />
                            {profile?.member_since ? <ProfileRow icon="ti-calendar" value={`Joined ${String(profile.member_since).slice(0, 10)}`} /> : null}
                        </div>
                        <div style={card}>
                            <h3 style={sectionTitle}>Recent activity</h3>
                            {activity.length ? activity.slice(0, 8).map((a, i) => (
                                <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "7px 0", borderTop: i ? "1px solid var(--cc-border-soft)" : "none" }}>
                                    <i className={`ti ${a.icon || "ti-point"}`} aria-hidden="true" style={{ color: "var(--cc-accent)", fontSize: 15, marginTop: 1 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 12.5, color: "var(--cc-text)" }}>{a.text}</div>
                                        <div style={{ fontSize: 11, color: "var(--cc-text3)" }}>{String(a.date).slice(0, 10)}</div>
                                    </div>
                                </div>
                            )) : <Empty text="No recent activity." />}
                        </div>
                    </div>
                </div>
            ) : null}

            {/* ---------- PROGRAM ---------- */}
            {tab === "Program" ? (
                <div>
                    <AssignForm onSave={assignWorkout} names={exNames} busy={busy} />
                    <h3 style={{ ...sectionTitle, marginTop: 4 }}>Assigned workouts</h3>
                    {workouts.length ? (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>{workouts.map((w) => <WorkoutCard key={w.id} w={w} onDelete={() => deleteWorkout(w.id)} />)}</div>
                    ) : <Empty text="No workouts assigned yet." />}
                </div>
            ) : null}

            {/* ---------- TASKS ---------- */}
            {tab === "Tasks" ? <TasksTab tasks={tasks} onAdd={addTask} onDelete={delTask} /> : null}

            {/* ---------- METRICS ---------- */}
            {tab === "Metrics" ? (
                <div>
                    <div style={{ display: "inline-flex", gap: 4, background: "var(--cc-panel2)", border: "1px solid var(--cc-border)", borderRadius: 999, padding: 3, marginBottom: 16 }}>
                        {[["body", "Body metrics"], ["exercise", "Exercise metrics"]].map(([k, label]) => (
                            <button key={k} type="button" onClick={() => setMetricsView(k)} style={{ border: "none", cursor: "pointer", borderRadius: 999, padding: "6px 16px", fontSize: 12.5, fontWeight: 600, background: metricsView === k ? "var(--cc-accent-bg)" : "transparent", color: metricsView === k ? "var(--cc-accent)" : "var(--cc-text2)" }}>{label}</button>
                        ))}
                    </div>
                    {metricsView === "body" ? <MeasurementsTab measurements={measurements} onAdd={addMeasurement} /> : (
                        progression.length ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>{progression.map((p) => <ProgressionItem key={p.exercise} p={p} />)}</div>
                            : <Empty text="No logged sets yet — progression appears once the client logs weight × reps." />
                    )}
                </div>
            ) : null}

            {/* ---------- NUTRITION ---------- */}
            {tab === "Nutrition" ? (
                !m ? <div style={card}><Empty text="No report this week." /></div> : (
                    <div style={card}>
                        <h3 style={sectionTitle}>Calories this week</h3>
                        <MiniNutrition days={m.nutrition?.days} target={m.nutrition?.target_calories} />
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 14 }}>
                            <StatCard label="Target calories" value={m.nutrition?.target_calories ?? "—"} />
                            <StatCard label="Avg calories" value={m.nutrition?.avg_calories ?? "—"} />
                            <StatCard label="Protein target" value={m.nutrition?.target_protein_g ? `${m.nutrition.target_protein_g} g` : "—"} />
                            <StatCard label="Protein hit-rate" value={`${m.nutrition?.protein_hit_rate ?? 0}%`} />
                        </div>
                    </div>
                )
            ) : null}

            {/* ---------- MEAL PLAN ---------- */}
            {tab === "Meal plan" ? <MealPlanTab plan={mealPlan} onSave={saveMealPlan} /> : null}

            {/* ---------- PHOTOS ---------- */}
            {tab === "Photos" ? (
                <div>
                    <h3 style={sectionTitle}>Progress photos</h3>
                    {photos.length ? (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
                            {photos.map((p) => (
                                <div key={p.id} style={{ ...card, padding: 0, overflow: "hidden" }}>
                                    <img src={p.image} alt={p.angle || "progress"} style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", display: "block" }} />
                                    <div style={{ padding: "8px 10px", fontSize: 11.5, color: "var(--cc-text3)" }}>{String(p.date).slice(0, 10)}{p.angle ? ` · ${p.angle}` : ""}</div>
                                </div>
                            ))}
                        </div>
                    ) : <Empty text="No progress photos yet. The client can upload them from their app." />}
                </div>
            ) : null}

            {/* ---------- DOCUMENTS ---------- */}
            {tab === "Documents" ? <DocumentsTab documents={documents} onAdd={addDocument} onDelete={delDocument} /> : null}

            {/* ---------- CHECK-INS ---------- */}
            {tab === "Check-ins" ? (
                !m ? <div style={card}><Empty text="No report this week." /></div> : (
                    <div style={card}>
                        <h3 style={sectionTitle}>Weekly check-in</h3>
                        {m.checkin?.submitted ? (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                                <StatCard label="Sleep" value={`${m.checkin.sleep_h ?? "—"} h`} />
                                <StatCard label="Energy" value={`${m.checkin.energy_1to5 ?? "—"} / 5`} />
                                <StatCard label="Stress" value={`${m.checkin.stress_1to5 ?? "—"} / 5`} />
                                <StatCard label="Steps avg" value={m.checkin.steps_avg ?? "—"} />
                            </div>
                        ) : <Empty text="No check-in submitted this week." />}
                        {m.checkin?.notes ? <p style={{ fontStyle: "italic", color: "var(--cc-text2)", fontSize: 13, marginTop: 12 }}>“{m.checkin.notes}”</p> : null}
                    </div>
                )
            ) : null}

            {/* ---------- REPORTS ---------- */}
            {tab === "Reports" ? (
                <div style={card}>
                    <h3 style={sectionTitle}>Report history</h3>
                    {history.length ? history.map((h) => (
                        <div key={h.report_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--cc-border-soft)" }}>
                            <Pill status={h.status} />
                            <span style={{ flex: 1, fontSize: 13, color: "var(--cc-text)" }}>Week of {h.week_start}</span>
                            {h.has_pdf ? <button type="button" onClick={() => openBlob(`/api/v1/reports/${h.report_id}/pdf`, token, setErr)} style={{ border: "none", background: "none", color: "var(--cc-accent)", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>PDF</button> : <span style={{ color: "var(--cc-text3)" }}>—</span>}
                        </div>
                    )) : <Empty text="No reports generated yet." />}
                </div>
            ) : null}

            {/* ---------- SETTINGS ---------- */}
            {tab === "Settings" ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
                    <div style={card}>
                        <h3 style={sectionTitle}>Duty of care</h3>
                        {sg ? (
                            <>
                                <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", fontSize: 13, color: "var(--cc-text)" }}>
                                    Hide raw numbers (client app)
                                    <input type="checkbox" checked={!!sg.hide_raw_numbers} onChange={(e) => saveSafe({ hide_raw_numbers: e.target.checked })} />
                                </label>
                                <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", fontSize: 13, color: "var(--cc-text)" }}>
                                    Support region
                                    <select value={sg.support_region || "UK"} onChange={(e) => saveSafe({ support_region: e.target.value })} style={{ ...input, padding: "5px 8px" }}><option value="UK">UK</option><option value="US">US</option><option value="AU">AU</option></select>
                                </label>
                                <div style={{ fontSize: 11.5, color: "var(--cc-text3)", marginTop: 4 }}>Intake {sg.screen_completed ? "completed" : "not completed"}.</div>
                            </>
                        ) : <Empty text="Loading…" />}
                    </div>
                    <div style={card}>
                        <h3 style={sectionTitle}>Profile card</h3>
                        <ProfileField label="Phone" value={profile?.phone} onSave={(v) => saveProfile({ phone: v })} />
                        <ProfileField label="Location" value={profile?.location} onSave={(v) => saveProfile({ location: v })} />
                        <ProfileField label="Package" value={profile?.package} onSave={(v) => saveProfile({ package: v })} />
                        <ProfileField label="Goal date" value={profile?.goal_date} type="date" onSave={(v) => saveProfile({ goal_date: v })} />
                    </div>
                    <div style={{ ...card, borderColor: "var(--cc-alert-border)" }}>
                        <h3 style={{ ...sectionTitle, color: "var(--cc-danger)" }}>Danger zone</h3>
                        <button type="button" onClick={removeClient} style={{ border: "1px solid var(--cc-alert-border)", background: "var(--cc-alert-bg)", color: "var(--cc-alert-fg)", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Remove from roster</button>
                    </div>
                </div>
            ) : null}
        </main>
    );
}

function ProfileRow({ icon, value }) {
    if (!value) return null;
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 0", fontSize: 12.5, color: "var(--cc-text2)" }}>
            <i className={`ti ${icon}`} aria-hidden="true" style={{ fontSize: 15, color: "var(--cc-text3)", width: 16 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
        </div>
    );
}

function ProfileField({ label, value, type = "text", onSave }) {
    const [v, setV] = useState(value || "");
    useEffect(() => { setV(value || ""); }, [value]);
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
            <span style={{ fontSize: 12.5, color: "var(--cc-text2)", width: 80, flexShrink: 0 }}>{label}</span>
            <input type={type} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== (value || "") && onSave(v)} style={{ ...input, flex: 1, padding: "6px 9px" }} />
        </div>
    );
}

function TasksTab({ tasks, onAdd, onDelete }) {
    const [form, setForm] = useState({ title: "", kind: "habit", description: "", due_date: "" });
    const submit = () => { if (!form.title.trim()) return; onAdd({ ...form }); setForm({ title: "", kind: "habit", description: "", due_date: "" }); };
    return (
        <div>
            <div style={{ ...card, marginBottom: 16 }}>
                <h3 style={sectionTitle}>Assign a task or habit</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1.6fr 0.7fr 1fr", gap: 10 }}>
                    <input value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} placeholder="e.g. Hit 10k steps" style={input} />
                    <select value={form.kind} onChange={(e) => setForm((s) => ({ ...s, kind: e.target.value }))} style={input}><option value="habit">Daily habit</option><option value="task">One-off task</option></select>
                    {form.kind === "task" ? <input type="date" value={form.due_date} onChange={(e) => setForm((s) => ({ ...s, due_date: e.target.value }))} style={input} /> : <div />}
                </div>
                <div style={{ marginTop: 12 }}><button type="button" onClick={submit} disabled={!form.title.trim()} style={{ background: "var(--cc-accent-bg)", color: "var(--cc-accent)", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: form.title.trim() ? 1 : 0.5 }}>Add</button></div>
            </div>
            {tasks.length ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                    {tasks.map((t) => (
                        <div key={t.id} style={{ ...card, padding: 14 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 10.5, fontWeight: 700, color: t.kind === "habit" ? "var(--cc-accent)" : "var(--cc-text3)", textTransform: "uppercase", letterSpacing: 0.4 }}>{t.kind}</span>
                                <div style={{ flex: 1 }} />
                                <button type="button" onClick={() => onDelete(t.id)} style={{ border: "none", background: "none", color: "var(--cc-text3)", cursor: "pointer", fontSize: 15 }}><i className="ti ti-trash" aria-hidden="true" /></button>
                            </div>
                            <div style={{ fontWeight: 600, fontSize: 14, color: "var(--cc-text)", marginTop: 2 }}>{t.title}</div>
                            {t.description ? <div style={{ fontSize: 12, color: "var(--cc-text3)", marginTop: 2 }}>{t.description}</div> : null}
                            <div style={{ fontSize: 11.5, color: "var(--cc-text3)", marginTop: 8 }}>{t.kind === "habit" ? `${t.last7_completions}/7 days done this week` : t.due_date ? `Due ${t.due_date}` : "No due date"}</div>
                        </div>
                    ))}
                </div>
            ) : <Empty text="No tasks or habits yet." />}
        </div>
    );
}

function MeasurementsTab({ measurements, onAdd }) {
    const [form, setForm] = useState({ metric: "Waist", value: "", unit: "cm", date: "" });
    const submit = () => { if (!form.value) return; onAdd({ ...form, value: Number(form.value) }); setForm((s) => ({ ...s, value: "" })); };
    return (
        <div>
            <div style={{ ...card, marginBottom: 16 }}>
                <h3 style={sectionTitle}>Add a measurement</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr 0.6fr 1fr auto", gap: 10, alignItems: "center" }}>
                    <input list="cc-metrics" value={form.metric} onChange={(e) => setForm((s) => ({ ...s, metric: e.target.value }))} placeholder="Metric" style={input} />
                    <input type="number" value={form.value} onChange={(e) => setForm((s) => ({ ...s, value: e.target.value }))} placeholder="Value" style={input} />
                    <input value={form.unit} onChange={(e) => setForm((s) => ({ ...s, unit: e.target.value }))} placeholder="cm" style={input} />
                    <input type="date" value={form.date} onChange={(e) => setForm((s) => ({ ...s, date: e.target.value }))} style={input} />
                    <button type="button" onClick={submit} disabled={!form.value} style={{ background: "var(--cc-accent-bg)", color: "var(--cc-accent)", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: form.value ? 1 : 0.5 }}>Add</button>
                    <datalist id="cc-metrics">{MEASURE_PRESETS.map((m) => <option key={m} value={m} />)}</datalist>
                </div>
            </div>
            {measurements.length ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
                    {measurements.map((mm) => {
                        const change = mm.first && mm.latest ? Math.round((mm.latest.value - mm.first.value) * 10) / 10 : null;
                        return (
                            <div key={mm.metric} style={card}>
                                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--cc-text)" }}>{mm.metric}</span>
                                    <span style={{ fontSize: 13, color: "var(--cc-text2)" }}>{mm.latest?.value}{mm.unit} {change != null && change !== 0 ? <span style={{ color: change < 0 ? "var(--cc-success)" : "var(--cc-text3)", fontWeight: 600, fontSize: 12 }}> ({signed(change)})</span> : null}</span>
                                </div>
                                <MetricLine series={mm.points.map((p) => ({ date: p.date, value: p.value }))} unit={mm.unit} />
                            </div>
                        );
                    })}
                </div>
            ) : <Empty text="No measurements yet. Add one above or the client can log them." />}
        </div>
    );
}

function DocumentsTab({ documents, onAdd, onDelete }) {
    const [form, setForm] = useState({ title: "", url: "", note: "" });
    const submit = () => { if (!form.title.trim()) return; onAdd({ ...form }); setForm({ title: "", url: "", note: "" }); };
    return (
        <div>
            <div style={{ ...card, marginBottom: 16 }}>
                <h3 style={sectionTitle}>Add a document</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1.4fr auto", gap: 10 }}>
                    <input value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} placeholder="Title" style={input} />
                    <input value={form.url} onChange={(e) => setForm((s) => ({ ...s, url: e.target.value }))} placeholder="Link (PDF, doc, etc.)" style={input} />
                    <button type="button" onClick={submit} disabled={!form.title.trim()} style={{ background: "var(--cc-accent-bg)", color: "var(--cc-accent)", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: form.title.trim() ? 1 : 0.5 }}>Add</button>
                </div>
            </div>
            {documents.length ? documents.map((d) => (
                <div key={d.id} style={{ ...card, padding: 14, marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
                    <i className="ti ti-file-text" aria-hidden="true" style={{ fontSize: 18, color: "var(--cc-accent)" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--cc-text)" }}>{d.title}{d.client_id == null ? <span style={{ fontSize: 10.5, color: "var(--cc-text3)", marginLeft: 8 }}>shared</span> : null}</div>
                        {d.note ? <div style={{ fontSize: 12, color: "var(--cc-text3)" }}>{d.note}</div> : null}
                    </div>
                    {d.url ? <a href={d.url} target="_blank" rel="noreferrer" style={{ color: "var(--cc-accent)", fontSize: 12.5, fontWeight: 600, textDecoration: "none" }}>Open</a> : null}
                    <button type="button" onClick={() => onDelete(d.id)} style={{ border: "none", background: "none", color: "var(--cc-text3)", cursor: "pointer", fontSize: 15 }}><i className="ti ti-trash" aria-hidden="true" /></button>
                </div>
            )) : <Empty text="No documents yet." />}
        </div>
    );
}

function MealPlanTab({ plan, onSave }) {
    const blank = { title: "Meal plan", target_calories: "", target_protein_g: "", target_carbs_g: "", target_fat_g: "", meals: [{ name: "", items: [""], notes: "" }], notes: "" };
    const [form, setForm] = useState(blank);
    const [editing, setEditing] = useState(false);
    useEffect(() => {
        if (plan) setForm({ title: plan.title || "Meal plan", target_calories: plan.target_calories ?? "", target_protein_g: plan.target_protein_g ?? "", target_carbs_g: plan.target_carbs_g ?? "", target_fat_g: plan.target_fat_g ?? "", meals: plan.meals?.length ? plan.meals.map((m) => ({ ...m, items: m.items?.length ? m.items : [""] })) : [{ name: "", items: [""], notes: "" }], notes: plan.notes || "" });
    }, [plan]);

    const setMeal = (i, patch) => setForm((s) => ({ ...s, meals: s.meals.map((m, j) => (j === i ? { ...m, ...patch } : m)) }));
    const setItem = (mi, ii, v) => setForm((s) => ({ ...s, meals: s.meals.map((m, j) => j === mi ? { ...m, items: m.items.map((it, k) => k === ii ? v : it) } : m) }));
    const addItem = (mi) => setForm((s) => ({ ...s, meals: s.meals.map((m, j) => j === mi ? { ...m, items: [...m.items, ""] } : m) }));
    const addMeal = () => setForm((s) => ({ ...s, meals: [...s.meals, { name: "", items: [""], notes: "" }] }));
    const rmMeal = (mi) => setForm((s) => ({ ...s, meals: s.meals.filter((_, j) => j !== mi) }));
    const save = () => { onSave({ ...form, meals: form.meals.map((m) => ({ ...m, items: m.items.filter((i) => i.trim()) })).filter((m) => m.name.trim() || m.items.length) }); setEditing(false); };

    if (!editing) {
        return (
            <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h3 style={{ ...sectionTitle, margin: 0 }}>{plan?.title || "Meal plan"}</h3>
                    <button type="button" onClick={() => setEditing(true)} style={{ border: "none", background: "var(--cc-accent-bg)", color: "var(--cc-accent)", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{plan ? "Edit plan" : "Create plan"}</button>
                </div>
                {plan ? (
                    <>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
                            <StatCard label="Calories" value={plan.target_calories ?? "—"} />
                            <StatCard label="Protein" value={plan.target_protein_g ? `${plan.target_protein_g} g` : "—"} />
                            <StatCard label="Carbs" value={plan.target_carbs_g ? `${plan.target_carbs_g} g` : "—"} />
                            <StatCard label="Fat" value={plan.target_fat_g ? `${plan.target_fat_g} g` : "—"} />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                            {(plan.meals || []).map((mm, i) => (
                                <div key={i} style={card}>
                                    <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--cc-text)", marginBottom: 6 }}>{mm.name}</div>
                                    {(mm.items || []).map((it, k) => <div key={k} style={{ fontSize: 12.5, color: "var(--cc-text2)", padding: "2px 0" }}>• {it}</div>)}
                                    {mm.notes ? <div style={{ fontSize: 11.5, color: "var(--cc-text3)", fontStyle: "italic", marginTop: 4 }}>{mm.notes}</div> : null}
                                </div>
                            ))}
                        </div>
                        {plan.notes ? <p style={{ fontSize: 12.5, color: "var(--cc-text2)", marginTop: 12 }}>{plan.notes}</p> : null}
                    </>
                ) : <Empty text="No meal plan yet. Create one to set targets + meals for this client." />}
            </div>
        );
    }
    return (
        <div style={card}>
            <h3 style={sectionTitle}>Meal plan</h3>
            <input value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} placeholder="Plan title" style={{ ...input, width: "100%", marginBottom: 10 }} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
                <input type="number" value={form.target_calories} onChange={(e) => setForm((s) => ({ ...s, target_calories: e.target.value }))} placeholder="kcal" style={input} />
                <input type="number" value={form.target_protein_g} onChange={(e) => setForm((s) => ({ ...s, target_protein_g: e.target.value }))} placeholder="protein g" style={input} />
                <input type="number" value={form.target_carbs_g} onChange={(e) => setForm((s) => ({ ...s, target_carbs_g: e.target.value }))} placeholder="carbs g" style={input} />
                <input type="number" value={form.target_fat_g} onChange={(e) => setForm((s) => ({ ...s, target_fat_g: e.target.value }))} placeholder="fat g" style={input} />
            </div>
            {form.meals.map((meal, mi) => (
                <div key={mi} style={{ border: "1px solid var(--cc-border)", borderRadius: 10, padding: 12, marginBottom: 10 }}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                        <input value={meal.name} onChange={(e) => setMeal(mi, { name: e.target.value })} placeholder="Meal name (e.g. Breakfast)" style={{ ...input, flex: 1 }} />
                        <button type="button" onClick={() => rmMeal(mi)} style={{ border: "none", background: "none", color: "var(--cc-text3)", cursor: "pointer", fontSize: 16 }}><i className="ti ti-x" aria-hidden="true" /></button>
                    </div>
                    {meal.items.map((it, ii) => <input key={ii} value={it} onChange={(e) => setItem(mi, ii, e.target.value)} placeholder="Food item" style={{ ...input, width: "100%", marginBottom: 6 }} />)}
                    <button type="button" onClick={() => addItem(mi)} style={{ border: "none", background: "none", color: "var(--cc-accent)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ item</button>
                </div>
            ))}
            <button type="button" onClick={addMeal} style={{ border: "1px dashed var(--cc-border)", background: "transparent", color: "var(--cc-text2)", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, cursor: "pointer", marginBottom: 12, display: "block" }}><i className="ti ti-plus" aria-hidden="true" /> Add meal</button>
            <textarea value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} rows={2} placeholder="General notes" style={{ ...input, width: "100%", resize: "vertical", fontFamily: "inherit", marginBottom: 12 }} />
            <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={save} style={{ background: "var(--cc-accent-bg)", color: "var(--cc-accent)", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save plan</button>
                <button type="button" onClick={() => setEditing(false)} style={{ background: "none", border: "1px solid var(--cc-border)", color: "var(--cc-text2)", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            </div>
        </div>
    );
}
