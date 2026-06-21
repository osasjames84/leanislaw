import { useCallback, useEffect, useState } from "react";
import { authBearerHeaders, authJsonHeaders } from "../apiHeaders";

const BODY_PARTS = ["chest", "back", "legs", "shoulders", "biceps", "triceps", "abs"];
const LEVELS = ["Beginner", "Intermediate", "Advanced"];

const EMPTY = { name: "", body_part: "chest", equipment: "", level: "", video_url: "", instructions: "" };

const field = {
    background: "var(--cc-panel2)",
    border: "1px solid var(--cc-border)",
    borderRadius: 8,
    color: "var(--cc-text)",
    fontSize: 13,
    padding: "8px 10px",
    width: "100%",
    fontFamily: "inherit",
};
const label = { fontSize: 12, color: "var(--cc-text2)", fontWeight: 500, marginBottom: 4, display: "block" };
const primaryBtn = { background: "var(--cc-accent-bg)", color: "var(--cc-accent)", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" };

function CoachExerciseLibrary({ token }) {
    const [list, setList] = useState([]);
    const [q, setQ] = useState("");
    const [part, setPart] = useState("all");
    const [editing, setEditing] = useState(null); // null | {id?, ...fields}
    const [err, setErr] = useState("");

    const load = useCallback(async () => {
        setErr("");
        try {
            const d = await fetch("/api/v1/exercises", { headers: authBearerHeaders(token) }).then((r) => r.json());
            if (Array.isArray(d)) setList(d);
            else if (d.error) setErr(d.error);
        } catch {
            setErr("Could not load the exercise library.");
        }
    }, [token]);

    useEffect(() => { load(); }, [load]);

    const save = async () => {
        const e = editing;
        if (!e.name?.trim()) { setErr("Name is required."); return; }
        const body = {
            name: e.name.trim(),
            body_part: e.body_part,
            equipment: e.equipment || null,
            level: e.level || null,
            video_url: e.video_url || null,
            instructions: e.instructions || null,
        };
        try {
            const url = e.id ? `/api/v1/exercises/${e.id}` : "/api/v1/exercises";
            const method = e.id ? "PATCH" : "POST";
            const d = await fetch(url, { method, headers: authJsonHeaders(token), body: JSON.stringify(body) }).then((r) => r.json());
            if (d.error) { setErr(d.error); return; }
            setEditing(null);
            await load();
        } catch {
            setErr("Could not save the exercise.");
        }
    };

    const remove = async (id) => {
        try {
            await fetch(`/api/v1/exercises/${id}`, { method: "DELETE", headers: authBearerHeaders(token) });
            await load();
        } catch {
            setErr("Could not delete the exercise.");
        }
    };

    const rows = list.filter(
        (x) => (part === "all" || x.body_part === part) && (!q || String(x.name).toLowerCase().includes(q.toLowerCase()))
    );

    const ctrl = { background: "var(--cc-panel)", border: "1px solid var(--cc-border)", borderRadius: 8, color: "var(--cc-text)", fontSize: 13 };

    return (
        <main style={{ flex: 1, minWidth: 0, height: "100%", overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", color: "var(--cc-text)" }}>Exercise library</h1>
                <span style={{ fontSize: 12.5, color: "var(--cc-text3)" }}>{list.length} exercises</span>
                <div style={{ flex: 1 }} />
                <div style={{ display: "flex", alignItems: "center", gap: 6, ...ctrl, padding: "0 8px" }}>
                    <i className="ti ti-search" aria-hidden="true" style={{ fontSize: 15, color: "var(--cc-text3)" }} />
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" style={{ border: "none", outline: "none", background: "transparent", color: "var(--cc-text)", fontSize: 13, padding: "7px 0", width: 130 }} />
                </div>
                <select value={part} onChange={(e) => setPart(e.target.value)} style={{ ...ctrl, padding: "7px 8px", textTransform: "capitalize" }}>
                    <option value="all">All muscles</option>
                    {BODY_PARTS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
                <button type="button" onClick={() => { setEditing({ ...EMPTY }); setErr(""); }} style={primaryBtn}>
                    <i className="ti ti-plus" aria-hidden="true" style={{ fontSize: 14, marginRight: 5, verticalAlign: "-2px" }} />Add exercise
                </button>
            </div>

            {err ? (
                <div style={{ background: "var(--cc-alert-bg)", border: "1px solid var(--cc-alert-border)", color: "var(--cc-alert-fg)", borderRadius: 10, padding: "10px 12px", fontSize: 13 }}>{err}</div>
            ) : null}

            {editing ? (
                <div style={{ background: "var(--cc-panel)", border: "1px solid var(--cc-border)", borderRadius: 14, padding: 16 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>{editing.id ? "Edit exercise" : "New exercise"}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                        <div><label style={label}>Name</label><input style={field} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
                        <div><label style={label}>Muscle group</label>
                            <select style={field} value={editing.body_part} onChange={(e) => setEditing({ ...editing, body_part: e.target.value })}>
                                {BODY_PARTS.map((b) => <option key={b} value={b} style={{ textTransform: "capitalize" }}>{b}</option>)}
                            </select>
                        </div>
                        <div><label style={label}>Equipment</label><input style={field} value={editing.equipment} placeholder="Barbell, dumbbell…" onChange={(e) => setEditing({ ...editing, equipment: e.target.value })} /></div>
                        <div><label style={label}>Level</label>
                            <select style={field} value={editing.level} onChange={(e) => setEditing({ ...editing, level: e.target.value })}>
                                <option value="">—</option>
                                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                            </select>
                        </div>
                        <div style={{ gridColumn: "1 / -1" }}><label style={label}>Video URL</label><input style={field} value={editing.video_url} placeholder="https://…" onChange={(e) => setEditing({ ...editing, video_url: e.target.value })} /></div>
                        <div style={{ gridColumn: "1 / -1" }}><label style={label}>Coaching cues / instructions</label><textarea style={{ ...field, minHeight: 70, resize: "vertical" }} value={editing.instructions} onChange={(e) => setEditing({ ...editing, instructions: e.target.value })} /></div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        <button type="button" onClick={save} style={primaryBtn}>{editing.id ? "Save changes" : "Create exercise"}</button>
                        <button type="button" onClick={() => setEditing(null)} style={{ border: "none", background: "none", color: "var(--cc-text2)", cursor: "pointer", fontSize: 13 }}>Cancel</button>
                    </div>
                </div>
            ) : null}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                {rows.map((x) => (
                    <div key={x.id} style={{ background: "var(--cc-panel)", border: "1px solid var(--cc-border)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--cc-text)" }}>{x.name}</div>
                                <span style={{ display: "inline-block", marginTop: 4, background: "var(--cc-accent-bg)", color: "var(--cc-accent)", borderRadius: 999, padding: "2px 9px", fontSize: 11.5, fontWeight: 600, textTransform: "capitalize" }}>{x.body_part}</span>
                            </div>
                            <button type="button" onClick={() => { setEditing({ id: x.id, name: x.name || "", body_part: x.body_part || "chest", equipment: x.equipment || "", level: x.level || "", video_url: x.video_url || "", instructions: x.instructions || "" }); setErr(""); }} aria-label="Edit" style={{ border: "none", background: "none", color: "var(--cc-text3)", cursor: "pointer", fontSize: 15 }}><i className="ti ti-pencil" aria-hidden="true" /></button>
                            <button type="button" onClick={() => remove(x.id)} aria-label="Delete" style={{ border: "none", background: "none", color: "var(--cc-text3)", cursor: "pointer", fontSize: 15 }}><i className="ti ti-trash" aria-hidden="true" /></button>
                        </div>
                        {(x.equipment || x.level) ? (
                            <div style={{ fontSize: 12, color: "var(--cc-text2)" }}>{[x.equipment, x.level].filter(Boolean).join(" · ")}</div>
                        ) : null}
                        {x.instructions ? (
                            <div style={{ fontSize: 12, color: "var(--cc-text3)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{x.instructions}</div>
                        ) : null}
                        {x.video_url ? (
                            <a href={x.video_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--cc-accent)", fontWeight: 600, textDecoration: "none", marginTop: "auto" }}>
                                <i className="ti ti-player-play" aria-hidden="true" style={{ fontSize: 13, marginRight: 4, verticalAlign: "-2px" }} />Demo video
                            </a>
                        ) : null}
                    </div>
                ))}
                {!rows.length ? (
                    <div style={{ gridColumn: "1 / -1", padding: 24, textAlign: "center", color: "var(--cc-text3)", fontSize: 13 }}>
                        {list.length ? "No exercises match your filters." : "No exercises yet — add your first one."}
                    </div>
                ) : null}
            </div>
        </main>
    );
}

export default CoachExerciseLibrary;
