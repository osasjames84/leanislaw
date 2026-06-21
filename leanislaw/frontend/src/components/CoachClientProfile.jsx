import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authBearerHeaders, authJsonHeaders } from "../apiHeaders";
import {
    Avatar, Pill, StatCard, Empty, AlertBanner, MetricLine, ProgressionItem, MiniNutrition,
    minusSign, signed, displayFlag, openBlob,
} from "./coachShared";

const TABS = ["Overview", "Program", "Metrics", "Nutrition", "Check-ins", "Reports"];
const WORKOUT_STATUS = {
    assigned: { label: "Assigned", color: "var(--cc-text2)" },
    completed: { label: "Completed", color: "var(--cc-success)" },
    skipped: { label: "Skipped", color: "var(--cc-danger)" },
};

const card = { background: "var(--cc-panel)", border: "1px solid var(--cc-border)", borderRadius: 14, padding: 18 };
const sectionTitle = { fontSize: 13, fontWeight: 700, color: "var(--cc-text)", margin: "0 0 12px", letterSpacing: 0.2 };

/* ---------------- Program tab ---------------- */

function ExerciseRow({ ex, onChange, onRemove, names }) {
    const f = (k, v) => onChange({ ...ex, [k]: v });
    const input = { background: "var(--cc-panel2)", border: "1px solid var(--cc-border)", borderRadius: 8, color: "var(--cc-text)", fontSize: 12.5, padding: "7px 9px" };
    return (
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 0.6fr 0.8fr 0.8fr 28px", gap: 8, alignItems: "center" }}>
            <input list="cc-ex-names" value={ex.name} onChange={(e) => f("name", e.target.value)} placeholder="Exercise" style={input} />
            <input value={ex.sets ?? ""} onChange={(e) => f("sets", e.target.value)} placeholder="Sets" style={input} />
            <input value={ex.reps ?? ""} onChange={(e) => f("reps", e.target.value)} placeholder="Reps" style={input} />
            <input value={ex.weight ?? ""} onChange={(e) => f("weight", e.target.value)} placeholder="Load" style={input} />
            <button type="button" onClick={onRemove} title="Remove" style={{ border: "none", background: "none", color: "var(--cc-text3)", cursor: "pointer", fontSize: 16 }}>
                <i className="ti ti-x" aria-hidden="true" />
            </button>
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
    const input = { background: "var(--cc-panel2)", border: "1px solid var(--cc-border)", borderRadius: 8, color: "var(--cc-text)", fontSize: 13, padding: "9px 11px" };

    const save = async () => {
        if (!form.title.trim()) return;
        const ok = await onSave({ ...form, exercises: form.exercises.filter((e) => e.name.trim()) });
        if (ok) setForm(blank);
    };

    return (
        <div style={{ ...card, marginBottom: 16 }}>
            <h3 style={sectionTitle}>Assign a workout</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 10, marginBottom: 10 }}>
                <input value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} placeholder="Workout title (e.g. Upper A — Push)" style={input} />
                <input type="date" value={form.scheduled_date} onChange={(e) => setForm((s) => ({ ...s, scheduled_date: e.target.value }))} style={input} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 0.6fr 0.8fr 0.8fr 28px", gap: 8, fontSize: 11, color: "var(--cc-text3)", fontWeight: 600, marginBottom: 4, padding: "0 2px" }}>
                <span>Exercise</span><span>Sets</span><span>Reps</span><span>Load</span><span />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {form.exercises.map((ex, i) => (
                    <ExerciseRow key={i} ex={ex} names={names} onChange={(e) => setEx(i, e)} onRemove={() => rmEx(i)} />
                ))}
            </div>
            <button type="button" onClick={addEx} style={{ marginTop: 10, border: "1px dashed var(--cc-border)", background: "transparent", color: "var(--cc-text2)", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <i className="ti ti-plus" aria-hidden="true" /> Add exercise
            </button>
            <textarea value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} rows={2} placeholder="Notes for the client (optional)" style={{ ...input, width: "100%", marginTop: 10, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
            <div style={{ marginTop: 12 }}>
                <button type="button" onClick={save} disabled={busy || !form.title.trim()} style={{ background: "var(--cc-accent-bg)", color: "var(--cc-accent)", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: busy ? "default" : "pointer", opacity: form.title.trim() ? 1 : 0.5 }}>
                    {busy ? "Saving…" : "Assign workout"}
                </button>
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
                <button type="button" onClick={onDelete} title="Remove" style={{ border: "none", background: "none", color: "var(--cc-text3)", cursor: "pointer", fontSize: 15 }}>
                    <i className="ti ti-trash" aria-hidden="true" />
                </button>
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

/* ---------------- AI overview block ---------------- */

function AiOverview({ data }) {
    if (!data) return <Empty text="Loading weekly overview…" />;
    if (data.has_report === false) return <Empty text="No report yet — generate this week's reports first." />;
    return (
        <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <i className="ti ti-sparkles" aria-hidden="true" style={{ color: "var(--cc-accent)", fontSize: 16 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--cc-text)" }}>AI weekly overview</span>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--cc-text3)", border: "1px solid var(--cc-border)", borderRadius: 999, padding: "2px 8px" }}>
                    {data.ai ? `Claude · ${data.model}` : "Auto summary"}
                </span>
            </div>
            <p style={{ fontSize: 13.5, color: "var(--cc-text)", lineHeight: 1.55, margin: "0 0 12px" }}>{data.summary}</p>
            {data.actions?.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {data.actions.map((a, i) => (
                        <div key={i} style={{ display: "flex", gap: 8, fontSize: 12.5, color: "var(--cc-text2)" }}>
                            <i className="ti ti-arrow-right" aria-hidden="true" style={{ color: "var(--cc-accent)", fontSize: 14, marginTop: 2 }} />
                            <span>{a}</span>
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

/* ---------------- main profile ---------------- */

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
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const qs = week ? `?week=${encodeURIComponent(week)}` : "";

    const loadCore = useCallback(async () => {
        try {
            const [rep, safe, hist, bm, prog, wk] = await Promise.all([
                fetch(`/api/v1/reports/clients/${clientId}/report${qs}`, { headers: authBearerHeaders(token) }).then((r) => r.json()),
                fetch(`/api/v1/reports/clients/${clientId}/safeguarding`, { headers: authBearerHeaders(token) }).then((r) => r.json()),
                fetch(`/api/v1/reports/clients/${clientId}/reports`, { headers: authBearerHeaders(token) }).then((r) => r.json()),
                fetch(`/api/v1/reports/clients/${clientId}/body-metrics?weeks=12`, { headers: authBearerHeaders(token) }).then((r) => r.json()),
                fetch(`/api/v1/reports/clients/${clientId}/progression`, { headers: authBearerHeaders(token) }).then((r) => r.json()),
                fetch(`/api/v1/programs/clients/${clientId}/workouts`, { headers: authBearerHeaders(token) }).then((r) => r.json()),
            ]);
            setData(rep.error ? { has_report: false } : rep);
            if (!safe.error) setSg(safe);
            if (Array.isArray(hist)) setHistory(hist);
            if (Array.isArray(bm)) setBodyHist(bm);
            if (Array.isArray(prog)) setProgression(prog);
            if (Array.isArray(wk)) setWorkouts(wk);
        } catch { setErr("Could not load this client."); }
    }, [clientId, qs, token]);

    useEffect(() => { loadCore(); }, [loadCore]);

    // AI overview loads separately (it can be slower when Claude is enabled).
    useEffect(() => {
        let cancelled = false;
        setAi(null);
        fetch(`/api/v1/reports/clients/${clientId}/ai-overview${qs}`, { headers: authBearerHeaders(token) })
            .then((r) => r.json()).then((d) => { if (!cancelled) setAi(d); }).catch(() => {});
        return () => { cancelled = true; };
    }, [clientId, qs, token]);

    useEffect(() => {
        fetch(`/api/v1/exercises`, { headers: authBearerHeaders(token) })
            .then((r) => r.json()).then((d) => { if (Array.isArray(d)) setExNames([...new Set(d.map((e) => e.name))].sort()); }).catch(() => {});
    }, [token]);

    const saveSafe = async (patch) => {
        await fetch(`/api/v1/reports/clients/${clientId}/safeguarding`, { method: "PUT", headers: authJsonHeaders(token), body: JSON.stringify(patch) });
        const d = await fetch(`/api/v1/reports/clients/${clientId}/safeguarding`, { headers: authBearerHeaders(token) }).then((r) => r.json());
        if (!d.error) setSg(d);
    };

    const assignWorkout = async (payload) => {
        setBusy(true); setErr("");
        try {
            const d = await fetch(`/api/v1/programs/clients/${clientId}/workouts`, { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify(payload) }).then((r) => r.json());
            if (d.error) { setErr(d.error); return false; }
            setWorkouts((w) => [...w, d]);
            return true;
        } catch { setErr("Could not assign that workout."); return false; }
        finally { setBusy(false); }
    };

    const deleteWorkout = async (id) => {
        await fetch(`/api/v1/programs/workouts/${id}`, { method: "DELETE", headers: authBearerHeaders(token) });
        setWorkouts((w) => w.filter((x) => x.id !== id));
    };

    const m = data?.model;
    const status = data?.status;
    const topFlag = useMemo(() => (data?.flags || []).find((f) => /low|fast|no check|high stress/i.test(f)), [data]);
    const name = m?.name || `Client #${clientId}`;

    const planCompleted = workouts.filter((w) => w.status === "completed").length;

    return (
        <main style={{ flex: 1, minWidth: 0, height: "100%", overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
            {/* header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button type="button" onClick={() => navigate("/coach")} style={{ border: "1px solid var(--cc-border)", background: "var(--cc-panel)", color: "var(--cc-text2)", borderRadius: 8, width: 34, height: 34, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <i className="ti ti-arrow-left" aria-hidden="true" style={{ fontSize: 17 }} />
                </button>
                <Avatar name={name} status={status} size={42} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.4px", color: "var(--cc-text)" }}>{name}</h1>
                    <div style={{ fontSize: 12.5, color: "var(--cc-text3)" }}>{m?.goal || "Client"}{data?.week_start ? ` · week of ${data.week_start}` : ""}</div>
                </div>
                {status ? <Pill status={status} /> : null}
            </div>

            {err ? <AlertBanner text={err} /> : null}

            {/* tabs */}
            <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--cc-border)", flexWrap: "wrap" }}>
                {TABS.map((t) => (
                    <button key={t} type="button" onClick={() => setTab(t)} style={{ border: "none", background: "none", padding: "8px 12px", fontSize: 13.5, fontWeight: tab === t ? 600 : 500, color: tab === t ? "var(--cc-accent)" : "var(--cc-text2)", borderBottom: tab === t ? "2px solid var(--cc-accent)" : "2px solid transparent", cursor: "pointer", marginBottom: -1 }}>
                        {t}
                    </button>
                ))}
            </div>

            {/* OVERVIEW */}
            {tab === "Overview" ? (
                !data || data.has_report === false ? (
                    <div style={card}><Empty text="No report for this week yet. Use Generate reports on the Clients page." /></div>
                ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.4fr 1fr", gap: 16, alignItems: "start" }}>
                        {/* left: training + body */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            <div style={card}>
                                <h3 style={sectionTitle}>Training</h3>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                    <StatCard label="This week" value={`${m.training?.completed ?? 0} / ${m.training?.assigned ?? 0}`} />
                                    <StatCard label="Plan done" value={`${planCompleted} / ${workouts.length}`} />
                                </div>
                            </div>
                            <div style={card}>
                                <h3 style={sectionTitle}>Body metrics</h3>
                                <MetricLine series={bodyHist.map((p) => ({ date: p.date, value: p.weight }))} unit="kg" />
                                {m.body?.trend ? (
                                    <p style={{ fontSize: 12.5, color: "var(--cc-text2)", marginTop: 8 }}>
                                        {m.body.trend.start} → {m.body.trend.end} {m.body.unit} ({signed(m.body.trend.change)}, {minusSign(m.body.trend.pct_change)}%)
                                    </p>
                                ) : null}
                            </div>
                        </div>

                        {/* middle: AI overview + flag */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            <div style={card}><AiOverview data={ai} /></div>
                            {topFlag ? <AlertBanner text={displayFlag(topFlag, m.body?.trend)} /> : null}
                            {m.checkin?.notes ? (
                                <div style={card}>
                                    <h3 style={sectionTitle}>Latest note from client</h3>
                                    <p style={{ fontStyle: "italic", color: "var(--cc-text2)", fontSize: 13, margin: 0 }}>“{m.checkin.notes}”</p>
                                </div>
                            ) : null}
                        </div>

                        {/* right: profile + duty of care */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            <div style={card}>
                                <h3 style={sectionTitle}>Duty of care</h3>
                                {sg ? (
                                    <>
                                        <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", fontSize: 13, color: "var(--cc-text)" }}>
                                            Hide raw numbers (client app)
                                            <input type="checkbox" checked={!!sg.hide_raw_numbers} onChange={(e) => saveSafe({ hide_raw_numbers: e.target.checked })} />
                                        </label>
                                        <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", fontSize: 13, color: "var(--cc-text)" }}>
                                            Support region
                                            <select value={sg.support_region || "UK"} onChange={(e) => saveSafe({ support_region: e.target.value })} style={{ background: "var(--cc-panel2)", color: "var(--cc-text)", border: "1px solid var(--cc-border)", borderRadius: 6, padding: "4px 6px", fontSize: 12 }}>
                                                <option value="UK">UK</option><option value="US">US</option><option value="AU">AU</option>
                                            </select>
                                        </label>
                                        <div style={{ fontSize: 11.5, color: "var(--cc-text3)", marginTop: 4 }}>Intake {sg.screen_completed ? "completed" : "not completed"}.</div>
                                    </>
                                ) : <Empty text="Loading…" />}
                            </div>
                        </div>
                    </div>
                )
            ) : null}

            {/* PROGRAM */}
            {tab === "Program" ? (
                <div>
                    <AssignForm onSave={assignWorkout} names={exNames} busy={busy} />
                    <h3 style={{ ...sectionTitle, marginTop: 4 }}>Assigned workouts</h3>
                    {workouts.length ? (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                            {workouts.map((w) => <WorkoutCard key={w.id} w={w} onDelete={() => deleteWorkout(w.id)} />)}
                        </div>
                    ) : <Empty text="No workouts assigned yet. Use the form above to build this client's plan." />}
                </div>
            ) : null}

            {/* METRICS */}
            {tab === "Metrics" ? (
                <div>
                    <div style={{ display: "inline-flex", gap: 4, background: "var(--cc-panel2)", border: "1px solid var(--cc-border)", borderRadius: 999, padding: 3, marginBottom: 16 }}>
                        {[["body", "Body metrics"], ["exercise", "Exercise metrics"]].map(([k, label]) => (
                            <button key={k} type="button" onClick={() => setMetricsView(k)} style={{ border: "none", cursor: "pointer", borderRadius: 999, padding: "6px 16px", fontSize: 12.5, fontWeight: 600, background: metricsView === k ? "var(--cc-accent-bg)" : "transparent", color: metricsView === k ? "var(--cc-accent)" : "var(--cc-text2)" }}>{label}</button>
                        ))}
                    </div>
                    {metricsView === "body" ? (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                            <div style={card}><h3 style={sectionTitle}>Weight</h3><MetricLine series={bodyHist.map((p) => ({ date: p.date, value: p.weight }))} unit="kg" /></div>
                            <div style={card}><h3 style={sectionTitle}>Body fat</h3><MetricLine series={bodyHist.map((p) => ({ date: p.date, value: p.body_fat }))} unit="%" /></div>
                        </div>
                    ) : (
                        progression.length ? (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
                                {progression.map((p) => <ProgressionItem key={p.exercise} p={p} />)}
                            </div>
                        ) : <Empty text="No logged sets yet — progression appears once the client logs weight × reps." />
                    )}
                </div>
            ) : null}

            {/* NUTRITION */}
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

            {/* CHECK-INS */}
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

            {/* REPORTS */}
            {tab === "Reports" ? (
                <div style={card}>
                    <h3 style={sectionTitle}>Report history</h3>
                    {history.length ? history.map((h) => (
                        <div key={h.report_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--cc-border-soft)" }}>
                            <Pill status={h.status} />
                            <span style={{ flex: 1, fontSize: 13, color: "var(--cc-text)" }}>Week of {h.week_start}</span>
                            {h.has_pdf ? (
                                <button type="button" onClick={() => openBlob(`/api/v1/reports/${h.report_id}/pdf`, token, setErr)} style={{ border: "none", background: "none", color: "var(--cc-accent)", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>PDF</button>
                            ) : <span style={{ color: "var(--cc-text3)" }}>—</span>}
                        </div>
                    )) : <Empty text="No reports generated yet." />}
                </div>
            ) : null}
        </main>
    );
}
