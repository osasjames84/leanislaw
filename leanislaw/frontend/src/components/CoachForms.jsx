import { useCallback, useEffect, useState } from "react";
import { authBearerHeaders, authJsonHeaders } from "../apiHeaders";
import { AlertBanner, Empty } from "./coachShared";

const FIELD_TYPES = [
    { v: "text", label: "Short text" },
    { v: "textarea", label: "Long text" },
    { v: "number", label: "Number" },
    { v: "scale", label: "Scale 1–5" },
];

const card = { background: "var(--cc-panel)", border: "1px solid var(--cc-border)", borderRadius: 14, padding: 18 };
const input = { background: "var(--cc-panel2)", border: "1px solid var(--cc-border)", borderRadius: 8, color: "var(--cc-text)", fontSize: 13, padding: "9px 11px", boxSizing: "border-box" };
const sectionTitle = { fontSize: 13, fontWeight: 700, color: "var(--cc-text)", margin: "0 0 12px" };

function Builder({ token, onCreated }) {
    const blank = { title: "", description: "", fields: [{ label: "", type: "text", required: false }] };
    const [form, setForm] = useState(blank);
    const [busy, setBusy] = useState(false);
    const setField = (i, patch) => setForm((s) => ({ ...s, fields: s.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) }));
    const addField = () => setForm((s) => ({ ...s, fields: [...s.fields, { label: "", type: "text", required: false }] }));
    const rmField = (i) => setForm((s) => ({ ...s, fields: s.fields.filter((_, j) => j !== i) }));

    const save = async () => {
        if (!form.title.trim()) return;
        setBusy(true);
        try {
            const d = await fetch("/api/v1/forms", { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify({ ...form, fields: form.fields.filter((f) => f.label.trim()) }) }).then((r) => r.json());
            if (!d.error) { setForm(blank); onCreated(); }
        } finally { setBusy(false); }
    };

    return (
        <div style={{ ...card, marginBottom: 16 }}>
            <h3 style={sectionTitle}>Build a form</h3>
            <input value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} placeholder="Form title" style={{ ...input, width: "100%", marginBottom: 10 }} />
            <input value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} placeholder="Short description (optional)" style={{ ...input, width: "100%", marginBottom: 14 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {form.fields.map((f, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 130px auto 28px", gap: 8, alignItems: "center" }}>
                        <input value={f.label} onChange={(e) => setField(i, { label: e.target.value })} placeholder={`Question ${i + 1}`} style={input} />
                        <select value={f.type} onChange={(e) => setField(i, { type: e.target.value })} style={input}>
                            {FIELD_TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
                        </select>
                        <label style={{ fontSize: 12, color: "var(--cc-text2)", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                            <input type="checkbox" checked={f.required} onChange={(e) => setField(i, { required: e.target.checked })} /> Required
                        </label>
                        <button type="button" onClick={() => rmField(i)} style={{ border: "none", background: "none", color: "var(--cc-text3)", cursor: "pointer", fontSize: 16 }}><i className="ti ti-x" aria-hidden="true" /></button>
                    </div>
                ))}
            </div>
            <button type="button" onClick={addField} style={{ marginTop: 10, border: "1px dashed var(--cc-border)", background: "transparent", color: "var(--cc-text2)", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <i className="ti ti-plus" aria-hidden="true" /> Add question
            </button>
            <div style={{ marginTop: 14 }}>
                <button type="button" onClick={save} disabled={busy || !form.title.trim()} style={{ background: "var(--cc-accent-bg)", color: "var(--cc-accent)", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: form.title.trim() ? 1 : 0.5 }}>{busy ? "Creating…" : "Create form"}</button>
            </div>
        </div>
    );
}

function FormCard({ token, form, roster, onChanged, onErr }) {
    const [open, setOpen] = useState(false);
    const [responses, setResponses] = useState(null);
    const [assignee, setAssignee] = useState("");

    const assign = async () => {
        if (!assignee) return;
        const d = await fetch(`/api/v1/forms/${form.id}/assign`, { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify({ client_id: Number(assignee) }) }).then((r) => r.json());
        if (d.error) onErr(d.error); else { setAssignee(""); onChanged(); }
    };
    const viewResponses = async () => {
        setOpen((o) => !o);
        if (!responses) {
            const d = await fetch(`/api/v1/forms/${form.id}/responses`, { headers: authBearerHeaders(token) }).then((r) => r.json());
            if (!d.error) setResponses(d);
        }
    };
    const del = async () => {
        await fetch(`/api/v1/forms/${form.id}`, { method: "DELETE", headers: authBearerHeaders(token) });
        onChanged();
    };

    return (
        <div style={card}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: "var(--cc-text)" }}>{form.title}</div>
                    {form.description ? <div style={{ fontSize: 12.5, color: "var(--cc-text3)", marginTop: 2 }}>{form.description}</div> : null}
                    <div style={{ fontSize: 11.5, color: "var(--cc-text3)", marginTop: 6 }}>{form.fields.length} questions · {form.completed}/{form.assigned} completed</div>
                </div>
                <button type="button" onClick={del} title="Delete" style={{ border: "none", background: "none", color: "var(--cc-text3)", cursor: "pointer", fontSize: 16 }}><i className="ti ti-trash" aria-hidden="true" /></button>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <select value={assignee} onChange={(e) => setAssignee(e.target.value)} style={{ ...input, flex: 1, minWidth: 140 }}>
                    <option value="">Assign to client…</option>
                    {(roster || []).map((c) => <option key={c.client_id} value={c.client_id}>{c.name}</option>)}
                </select>
                <button type="button" onClick={assign} disabled={!assignee} style={{ border: "none", background: "var(--cc-accent-bg)", color: "var(--cc-accent)", borderRadius: 8, padding: "9px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", opacity: assignee ? 1 : 0.5 }}>Assign</button>
                <button type="button" onClick={viewResponses} style={{ border: "1px solid var(--cc-border)", background: "transparent", color: "var(--cc-text2)", borderRadius: 8, padding: "9px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{open ? "Hide" : "Responses"}</button>
            </div>
            {open ? (
                <div style={{ marginTop: 14, borderTop: "1px solid var(--cc-border)", paddingTop: 12 }}>
                    {responses?.responses?.length ? responses.responses.map((r, i) => (
                        <div key={i} style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--cc-text)" }}>{r.name}</div>
                            {responses.form.fields.map((f) => (
                                <div key={f.id} style={{ fontSize: 12.5, color: "var(--cc-text2)", marginTop: 3 }}>
                                    <span style={{ color: "var(--cc-text3)" }}>{f.label}:</span> {r.answers[f.id] ?? "—"}
                                </div>
                            ))}
                        </div>
                    )) : <Empty text="No responses yet." />}
                </div>
            ) : null}
        </div>
    );
}

export default function CoachForms({ token }) {
    const [forms, setForms] = useState(null);
    const [roster, setRoster] = useState([]);
    const [err, setErr] = useState("");

    const load = useCallback(async () => {
        setErr("");
        try {
            const [f, r] = await Promise.all([
                fetch("/api/v1/forms", { headers: authBearerHeaders(token) }).then((r) => r.json()),
                fetch("/api/v1/reports/clients", { headers: authBearerHeaders(token) }).then((r) => r.json()),
            ]);
            if (Array.isArray(f)) setForms(f); else setErr(f.error || "Could not load forms.");
            if (Array.isArray(r)) setRoster(r);
        } catch { setErr("Could not load forms."); }
    }, [token]);

    useEffect(() => { load(); }, [load]);

    return (
        <main style={{ flex: 1, minWidth: 0, height: "100%", overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", color: "var(--cc-text)" }}>Forms</h1>
            {err ? <AlertBanner text={err} /> : null}
            <Builder token={token} onCreated={load} />
            {forms == null ? <Empty text="Loading…" /> : forms.length === 0 ? (
                <Empty text="No forms yet — build one above, then assign it to clients." />
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
                    {forms.map((f) => <FormCard key={f.id} token={token} form={f} roster={roster} onChanged={load} onErr={setErr} />)}
                </div>
            )}
        </main>
    );
}
