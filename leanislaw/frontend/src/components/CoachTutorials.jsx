import { useCallback, useEffect, useState } from "react";
import { authBearerHeaders, authJsonHeaders } from "../apiHeaders";
import { AlertBanner, Empty } from "./coachShared";

const card = { background: "var(--cc-panel)", border: "1px solid var(--cc-border)", borderRadius: 14, padding: 18 };
const input = { background: "var(--cc-panel2)", border: "1px solid var(--cc-border)", borderRadius: 8, color: "var(--cc-text)", fontSize: 13, padding: "9px 11px", boxSizing: "border-box" };
const sectionTitle = { fontSize: 13, fontWeight: 700, color: "var(--cc-text)", margin: "0 0 12px" };

export default function CoachTutorials({ token }) {
    const [items, setItems] = useState(null);
    const [err, setErr] = useState("");
    const blank = { title: "", url: "", category: "", description: "" };
    const [form, setForm] = useState(blank);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setErr("");
        try {
            const d = await fetch("/api/v1/tutorials", { headers: authBearerHeaders(token) }).then((r) => r.json());
            if (Array.isArray(d)) setItems(d); else setErr(d.error || "Could not load tutorials.");
        } catch { setErr("Could not load tutorials."); }
    }, [token]);

    useEffect(() => { load(); }, [load]);

    const save = async () => {
        if (!form.title.trim()) return;
        setBusy(true);
        try {
            const d = await fetch("/api/v1/tutorials", { method: "POST", headers: authJsonHeaders(token), body: JSON.stringify(form) }).then((r) => r.json());
            if (d.error) setErr(d.error); else { setForm(blank); load(); }
        } finally { setBusy(false); }
    };
    const del = async (id) => {
        await fetch(`/api/v1/tutorials/${id}`, { method: "DELETE", headers: authBearerHeaders(token) });
        load();
    };

    return (
        <main style={{ flex: 1, minWidth: 0, height: "100%", overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", color: "var(--cc-text)" }}>Tutorials</h1>
            {err ? <AlertBanner text={err} /> : null}

            <div style={{ ...card, marginBottom: 4 }}>
                <h3 style={sectionTitle}>Share a resource</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 10, marginBottom: 10 }}>
                    <input value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} placeholder="Title" style={input} />
                    <input value={form.category} onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))} placeholder="Category (e.g. Technique)" style={input} />
                </div>
                <input value={form.url} onChange={(e) => setForm((s) => ({ ...s, url: e.target.value }))} placeholder="Link (YouTube, doc, etc.)" style={{ ...input, width: "100%", marginBottom: 10 }} />
                <textarea value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} rows={2} placeholder="Description (optional)" style={{ ...input, width: "100%", resize: "vertical", fontFamily: "inherit" }} />
                <div style={{ marginTop: 12 }}>
                    <button type="button" onClick={save} disabled={busy || !form.title.trim()} style={{ background: "var(--cc-accent-bg)", color: "var(--cc-accent)", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: form.title.trim() ? 1 : 0.5 }}>{busy ? "Sharing…" : "Share resource"}</button>
                </div>
            </div>

            {items == null ? <Empty text="Loading…" /> : items.length === 0 ? (
                <Empty text="No resources yet — share your first technique video or guide above." />
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                    {items.map((t) => (
                        <div key={t.id} style={card}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    {t.category ? <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--cc-accent)", textTransform: "uppercase", letterSpacing: 0.4 }}>{t.category}</div> : null}
                                    <div style={{ fontWeight: 600, fontSize: 14.5, color: "var(--cc-text)", marginTop: 2 }}>{t.title}</div>
                                    {t.description ? <div style={{ fontSize: 12.5, color: "var(--cc-text3)", marginTop: 4, lineHeight: 1.4 }}>{t.description}</div> : null}
                                </div>
                                <button type="button" onClick={() => del(t.id)} title="Delete" style={{ border: "none", background: "none", color: "var(--cc-text3)", cursor: "pointer", fontSize: 15 }}><i className="ti ti-trash" aria-hidden="true" /></button>
                            </div>
                            {t.url ? <a href={t.url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 12, color: "var(--cc-accent)", fontSize: 12.5, fontWeight: 600, textDecoration: "none" }}><i className="ti ti-external-link" aria-hidden="true" /> Open resource</a> : null}
                        </div>
                    ))}
                </div>
            )}
        </main>
    );
}
