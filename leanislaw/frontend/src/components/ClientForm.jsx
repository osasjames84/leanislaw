import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authBearerHeaders, authJsonHeaders } from "../apiHeaders";

/** Client view to fill in (or review) a coach-assigned form. */

const page = {
    minHeight: "100vh",
    background: "#f2f2f7",
    padding: "calc(20px + env(safe-area-inset-top, 0px)) 16px calc(96px + env(safe-area-inset-bottom, 0px))",
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
};
const card = { background: "#fff", borderRadius: 16, padding: 18, border: "0.5px solid #e5e5ea", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" };
const inputStyle = { width: "100%", padding: 11, borderRadius: 10, border: "1px solid #d1d1d6", fontFamily: "inherit", fontSize: "0.95rem", boxSizing: "border-box" };

const ClientForm = () => {
    const navigate = useNavigate();
    const { formId } = useParams();
    const { token } = useAuth();
    const [form, setForm] = useState(null);
    const [answers, setAnswers] = useState({});
    const [done, setDone] = useState(false);
    const [err, setErr] = useState("");
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            const list = await fetch("/api/v1/forms/my", { headers: authBearerHeaders(token) }).then((r) => r.json());
            const f = Array.isArray(list) ? list.find((x) => String(x.id) === String(formId)) : null;
            if (!f) { setErr("This form isn't assigned to you."); return; }
            setForm(f);
            if (f.my_answers) setAnswers(f.my_answers);
        } catch { setErr("Could not load the form."); }
    }, [token, formId]);

    useEffect(() => { if (token) load(); }, [token, load]);

    const submit = async () => {
        setBusy(true); setErr("");
        try {
            const missing = (form.fields || []).some((f) => f.required && !String(answers[f.id] ?? "").trim());
            if (missing) { setErr("Please answer the required questions."); setBusy(false); return; }
            const d = await fetch(`/api/v1/forms/my/${formId}/respond`, { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify({ answers }) }).then((r) => r.json());
            if (d.error) setErr(d.error);
            else { setDone(true); setTimeout(() => navigate("/coaching"), 1200); }
        } catch { setErr("Could not submit your answers."); }
        finally { setBusy(false); }
    };

    const setA = (id, v) => setAnswers((s) => ({ ...s, [id]: v }));

    return (
        <div style={page}>
            <button type="button" onClick={() => navigate("/coaching")} style={{ border: "none", background: "none", color: "#007aff", fontWeight: 700, cursor: "pointer", padding: 0 }}>← Coaching</button>
            {err ? <div style={{ ...card, marginTop: 12, color: "#b42318" }}>{err}</div> : null}
            {form ? (
                <>
                    <h1 style={{ margin: "12px 0 2px", fontSize: "1.5rem", fontWeight: 800 }}>{form.title}</h1>
                    {form.description ? <p style={{ margin: "0 0 14px", color: "#8e8e93", fontSize: "0.9rem" }}>{form.description}</p> : <div style={{ height: 10 }} />}
                    <div style={card}>
                        {(form.fields || []).map((f) => (
                            <div key={f.id} style={{ marginBottom: 16 }}>
                                <label style={{ display: "block", fontSize: "0.92rem", fontWeight: 600, color: "#1c1c1e", marginBottom: 6 }}>
                                    {f.label}{f.required ? <span style={{ color: "#e5484d" }}> *</span> : null}
                                </label>
                                {f.type === "textarea" ? (
                                    <textarea rows={3} value={answers[f.id] ?? ""} onChange={(e) => setA(f.id, e.target.value)} style={{ ...inputStyle, resize: "vertical" }} />
                                ) : f.type === "scale" ? (
                                    <div style={{ display: "flex", gap: 8 }}>
                                        {[1, 2, 3, 4, 5].map((n) => (
                                            <button key={n} type="button" onClick={() => setA(f.id, n)} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1px solid #d1d1d6", background: String(answers[f.id]) === String(n) ? "#007aff" : "#fff", color: String(answers[f.id]) === String(n) ? "#fff" : "#1c1c1e", fontWeight: 700, cursor: "pointer" }}>{n}</button>
                                        ))}
                                    </div>
                                ) : (
                                    <input type={f.type === "number" ? "number" : "text"} value={answers[f.id] ?? ""} onChange={(e) => setA(f.id, e.target.value)} style={inputStyle} />
                                )}
                            </div>
                        ))}
                        <button type="button" onClick={submit} disabled={busy || done} style={{ width: "100%", padding: 13, borderRadius: 12, border: "none", background: done ? "#30a46c" : "#007aff", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                            {done ? "Submitted ✓" : busy ? "Submitting…" : form.status === "completed" ? "Update answers" : "Submit"}
                        </button>
                    </div>
                </>
            ) : !err ? <p style={{ marginTop: 20, color: "#8e8e93" }}>Loading…</p> : null}
        </div>
    );
};

export default ClientForm;
