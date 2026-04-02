import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authBearerHeaders } from "../apiHeaders";

/** After this scroll offset (px), show inline title in the nav (iOS large-title collapse). */
const NAV_TITLE_SCROLL_THRESHOLD = 48;

const pageWrap = {
    minHeight: "100vh",
    height: "100dvh",
    backgroundColor: "#f2f2f7",
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
};

const navBar = {
    flexShrink: 0,
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "calc(12px + env(safe-area-inset-top, 0px)) 16px 10px",
    backgroundColor: "#f2f2f7",
    borderBottom: "0.5px solid #d1d1d6",
    zIndex: 20,
};

const navKicker = {
    margin: 0,
    fontSize: "0.95rem",
    color: "#007aff",
    fontWeight: "600",
    flexShrink: 0,
    position: "relative",
    zIndex: 1,
};

const navInlineTitle = {
    position: "absolute",
    left: 16,
    right: 16,
    textAlign: "center",
    margin: 0,
    fontSize: "1.05rem",
    fontWeight: "800",
    letterSpacing: "-0.2px",
    color: "#000",
    pointerEvents: "none",
    transition: "opacity 0.18s ease",
};

const navHomeBtn = { flexShrink: 0, marginLeft: "auto", position: "relative", zIndex: 1 };

const scrollArea = {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    touchAction: "pan-y",
    padding: "8px 16px calc(98px + env(safe-area-inset-bottom, 0px))",
    boxSizing: "border-box",
};

const title = { margin: "4px 0 12px", fontSize: "2.1rem", fontWeight: "800", letterSpacing: "-0.4px", color: "#000" };
const sectionTitle = { margin: "18px 0 12px", fontSize: "2rem", fontWeight: "800", letterSpacing: "-0.5px", color: "#000" };
const h3 = { margin: "14px 0 10px", fontSize: "1.15rem", fontWeight: "800", color: "#1c1c1e" };
const watchCard = { borderRadius: 14, border: "0.5px solid #d1d1d6", background: "#fff", padding: "12px 12px 10px" };
const watchLead = { margin: "0 0 6px", fontSize: "1rem", fontWeight: "700", color: "#1c1c1e" };
const watchSub = { margin: 0, fontSize: "0.95rem", color: "#636366", lineHeight: 1.3 };
const quickBtn = { width: "100%", border: "none", borderRadius: 11, padding: "12px 14px", fontSize: "1.05rem", fontWeight: "800", cursor: "pointer", background: "#000", color: "#fff" };
const rowHead = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 };
const chip = { border: "none", borderRadius: 10, padding: "6px 10px", fontSize: "0.9rem", fontWeight: "700", background: "#e9edf2", color: "#007aff" };
const cardGrid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };
const templateCard = { borderRadius: 14, border: "0.5px solid #d1d1d6", background: "#fff", padding: "12px", minHeight: 146, boxSizing: "border-box", cursor: "pointer" };
const menuDot = { border: "none", borderRadius: 9, padding: "4px 8px", fontWeight: "700", background: "#edf1f5", color: "#007aff", lineHeight: 1, cursor: "pointer" };
const tName = { margin: "0 0 6px", fontSize: "1.02rem", fontWeight: "800", color: "#1c1c1e" };
const tSub = { margin: 0, fontSize: "0.78rem", lineHeight: 1.25, color: "#636366", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" };
const tMeta = { margin: "8px 0 0", fontSize: "0.82rem", color: "#8e8e93", fontWeight: "600" };
const emptyCard = { borderRadius: 14, border: "0.5px dashed #c7c7cc", background: "#fff", padding: "16px 12px", textAlign: "center", color: "#636366", fontSize: "0.9rem" };

const GBR_UPPER_NOTES =
    "Bench Press — 4x6-8 / 3'\n" +
    "Row — 4x6-8 / 3'\n" +
    "Flye / Incline Bench — 2-3x10-12 / 1.5'\n" +
    "Cable Pullover / Pulldown — 2-3x10-12 / 1.5'\n" +
    "Lateral Raise — 4x8-10 / 2'\n" +
    "Rear Delt — 4x8-10 / 2'\n" +
    "Biceps — 2-3x10-12 / 1.5'\n" +
    "Triceps — 2-3x10-12 / 1.5'";

const GBR_LOWER_NOTES =
    "Squat — 4x6-8 / 3'\n" +
    "RDL — 4x6-8 / 3'\n" +
    "Leg Extension / Split Squat — 2-3x10-12 / 1.5'\n" +
    "Leg Curl — 2-3x10-12 / 1.5'\n" +
    "Calf Raise — 4x8-10 / 2'\n" +
    "Seated Calf — 4x8-10 / 2'\n" +
    "Abs — Whatever\n" +
    "Low Back — Whatever";

const STARTER_TEMPLATES = [
    { name: "GBR UPPER", notes: GBR_UPPER_NOTES },
    { name: "GBR LOWER", notes: GBR_LOWER_NOTES },
];

const GBR_TEMPLATE_EXERCISES = {
    "GBR UPPER": [
        { aliases: ["bench press", "barbell bench press"], createName: "Bench Press", body_part: "chest", sets: 4 },
        { aliases: ["row", "seated row", "cable row", "barbell row"], createName: "Row", body_part: "back", sets: 4 },
        { aliases: ["pec deck", "machine fly", "chest fly"], createName: "Pec Deck", body_part: "chest", sets: 3 },
        { aliases: ["lat pulldown", "cable pulldown", "pulldown"], createName: "Lat Pulldown", body_part: "back", sets: 3 },
        { aliases: ["lateral raise", "dumbbell lateral raise"], createName: "Lateral Raise", body_part: "shoulders", sets: 4 },
        { aliases: ["reverse pec deck", "rear delt fly", "rear delt"], createName: "Reverse Pec Deck", body_part: "shoulders", sets: 4 },
        { aliases: ["preacher curl", "biceps preacher curl"], createName: "Preacher Curl", body_part: "biceps", sets: 3 },
        { aliases: ["tricep extension", "triceps extension", "cable tricep extension"], createName: "Tricep Extensions", body_part: "triceps", sets: 3 },
    ],
    "GBR LOWER": [
        { aliases: ["hack squat", "hacksquat"], createName: "Hack Squat", body_part: "legs", sets: 4 },
        { aliases: ["rdl", "romanian deadlift"], createName: "RDL", body_part: "legs", sets: 4 },
        { aliases: ["leg extension", "leg ext"], createName: "Leg Extension", body_part: "legs", sets: 3 },
        { aliases: ["seated hamstring curl", "seated leg curl", "leg curl"], createName: "Seated Hamstring Curl", body_part: "legs", sets: 3 },
        { aliases: ["calf raise", "standing calf raise"], createName: "Calf Raise", body_part: "legs", sets: 4 },
        { aliases: ["seated calf", "seated calf raise"], createName: "Seated Calf", body_part: "legs", sets: 4 },
        { aliases: ["cable crunch", "abs cable crunch"], createName: "Cable Crunch", body_part: "abs", sets: 3 },
        { aliases: ["back extension", "low back extension", "hyperextension"], createName: "Back Extension", body_part: "back", sets: 3 },
    ],
};

function norm(s) {
    return String(s || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}

function findExerciseId(allExercises, aliases) {
    const keys = aliases.map(norm);
    const byExact = allExercises.find((ex) => keys.includes(norm(ex.name)));
    if (byExact) return byExact.id;
    const byIncludes = allExercises.find((ex) => {
        const n = norm(ex.name);
        return keys.some((k) => n.includes(k) || k.includes(n));
    });
    return byIncludes?.id ?? null;
}

function nameMatchesAliases(name, aliases, createName) {
    const n = norm(name);
    if (!n) return false;
    const keys = [...aliases, createName].map(norm);
    return keys.some((k) => n === k || n.includes(k) || k.includes(n));
}

function starterSets(count) {
    return Array.from({ length: Math.max(1, count) }, () => ({
        weight: "",
        reps: "",
        rpe: "",
    }));
}

const WorkoutHub = () => {
    const navigate = useNavigate();
    const { token } = useAuth();
    const [templates, setTemplates] = useState([]);
    const [history, setHistory] = useState([]);
    const [navTitleVisible, setNavTitleVisible] = useState(false);

    const onScrollMain = useCallback((e) => {
        const y = e.currentTarget.scrollTop;
        setNavTitleVisible((prev) => {
            const next = y > NAV_TITLE_SCROLL_THRESHOLD;
            return prev === next ? prev : next;
        });
    }, []);

    useEffect(() => {
        if (!token) return;
        const headers = authBearerHeaders(token);
        async function loadAll() {
            try {
                const tempRes = await fetch("/api/v1/workoutSessions?is_template=true", { headers });
                const tempRows = await tempRes.json().catch(() => []);
                const existing = Array.isArray(tempRows) ? tempRows : [];

                const existingNames = new Set(existing.map((t) => String(t.name || "").trim().toUpperCase()));
                for (const tpl of STARTER_TEMPLATES) {
                    if (existingNames.has(tpl.name)) continue;
                    await fetch("/api/v1/workoutSessions", {
                        method: "POST",
                        headers: { ...headers, "Content-Type": "application/json" },
                        body: JSON.stringify({ name: tpl.name, notes: tpl.notes, is_template: true }),
                    });
                }

                const refreshedTempRes = await fetch("/api/v1/workoutSessions?is_template=true", { headers });
                const refreshedTemps = await refreshedTempRes.json().catch(() => []);
                const nextTemplates = Array.isArray(refreshedTemps) ? refreshedTemps : [];

                const exRes = await fetch("/api/v1/exercises");
                const allExercises = await exRes.json().catch(() => []);
                let exercises = Array.isArray(allExercises) ? allExercises : [];

                // Ensure missing GBR exercise names actually exist in DB.
                for (const cfgs of Object.values(GBR_TEMPLATE_EXERCISES)) {
                    for (const cfg of cfgs) {
                        const found = findExerciseId(exercises, cfg.aliases);
                        if (found) continue;
                        const createRes = await fetch("/api/v1/exercises", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ name: cfg.createName, body_part: cfg.body_part }),
                        });
                        const created = await createRes.json().catch(() => null);
                        const row = created?.exercises?.[0];
                        if (row && !exercises.some((e) => Number(e.id) === Number(row.id))) {
                            exercises = [...exercises, row];
                        }
                    }
                }

                for (const tpl of nextTemplates) {
                    const key = String(tpl.name || "").toUpperCase();
                    if (!GBR_TEMPLATE_EXERCISES[key]) continue;
                    const cfgs = GBR_TEMPLATE_EXERCISES[key];

                    const logsRes = await fetch(`/api/v1/workoutSessions/${tpl.id}/exerciseLogs`, { headers });
                    const logs = await logsRes.json().catch(() => []);
                    const logRows = Array.isArray(logs) ? logs : [];
                    const slotToLog = new Map();

                    // Dedupe by template slot (same movement family) and remove extras.
                    for (const log of logRows) {
                        const slotIdx = cfgs.findIndex((cfg) =>
                            nameMatchesAliases(log?.exerciseName, cfg.aliases, cfg.createName)
                        );
                        if (slotIdx < 0) continue;
                        if (!slotToLog.has(slotIdx)) {
                            slotToLog.set(slotIdx, log);
                            continue;
                        }
                        await fetch(`/api/v1/exerciseLog/${log.id}`, {
                            method: "DELETE",
                            headers,
                        });
                    }

                    const wanted = cfgs
                        .map((cfg) => {
                            const id = findExerciseId(exercises, cfg.aliases);
                            const row = exercises.find((e) => Number(e.id) === Number(id));
                            return id && row ? { id, sets: cfg.sets } : null;
                        })
                        .filter(Boolean);

                    for (let i = 0; i < wanted.length; i++) {
                        const item = wanted[i];
                        const existingLog = slotToLog.get(i);
                        if (!existingLog) {
                            const createdRes = await fetch(`/api/v1/workoutSessions/${tpl.id}/exerciseLogs`, {
                                method: "POST",
                                headers: { ...headers, "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    exercise_id: item.id,
                                    sets: starterSets(item.sets),
                                }),
                            });
                            const created = await createdRes.json().catch(() => null);
                            if (created?.id) {
                                slotToLog.set(i, created);
                            }
                            continue;
                        }
                        const existingSetCount = Array.isArray(existingLog.sets) ? existingLog.sets.length : 0;
                        if (existingSetCount !== item.sets) {
                            await fetch(`/api/v1/exerciseLog/${existingLog.id}`, {
                                method: "PUT",
                                headers: { ...headers, "Content-Type": "application/json" },
                                body: JSON.stringify({ sets: starterSets(item.sets) }),
                            });
                        }
                    }
                }

                setTemplates(nextTemplates);

                const historyRes = await fetch("/api/v1/workoutSessions", { headers });
                const historyRows = await historyRes.json().catch(() => []);
                const rows = Array.isArray(historyRows) ? historyRows.filter((x) => !x.is_template) : [];
                setHistory(rows);
            } catch {
                setTemplates([]);
                setHistory([]);
            }
        }
        loadAll();
    }, [token]);

    const myTemplates = useMemo(() => templates.slice(0, 3), [templates]);
    const workoutHistory = useMemo(() => history.slice(0, 2), [history]);
    const subText = (t) =>
        t?.is_template
            ? "Template ready. Open to start and log."
            : (t?.notes?.trim() || "Tap to open this workout");

    return (
        <div style={pageWrap}>
            <header style={navBar}>
                <p style={navKicker}>New in 6.0</p>
                <h2
                    style={{
                        ...navInlineTitle,
                        opacity: navTitleVisible ? 1 : 0,
                    }}
                    aria-hidden={!navTitleVisible}
                >
                    Start Workout
                </h2>
                <button type="button" onClick={() => navigate("/dashboard")} style={{ ...chip, ...navHomeBtn }}>
                    Home
                </button>
            </header>

            <div style={scrollArea} onScroll={onScrollMain}>
                <h1 style={title}>Start Workout</h1>

            <h3 style={h3}>Workout on Apple Watch</h3>
            <div style={watchCard}>
                <p style={watchLead}>Live sync placeholder</p>
                <p style={watchSub}>Start a workout on your watch for live sync. Active workouts will appear here.</p>
            </div>

            <h3 style={h3}>Quick Start</h3>
            <Link to="/workoutSessions" style={{ textDecoration: "none" }}>
                <button type="button" style={quickBtn}>Start an Empty Workout</button>
            </Link>

            <h2 style={sectionTitle}>Templates</h2>
            <div style={rowHead}>
                <h3 style={{ ...h3, margin: 0 }}>My Templates ({myTemplates.length})</h3>
                <div style={{ display: "flex", gap: 6 }}>
                    <button type="button" style={chip} onClick={() => navigate("/exercises")}>+ Template</button>
                    <button type="button" style={menuDot}>…</button>
                </div>
            </div>
            {myTemplates.length ? (
                <div style={cardGrid}>
                    {myTemplates.map((t) => (
                        <div key={t.id} style={templateCard} onClick={() => navigate(`/workout/${t.id}`)}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                <p style={tName}>{t.name}</p>
                                <button type="button" style={menuDot} onClick={(e) => e.stopPropagation()}>…</button>
                            </div>
                            <p style={tSub}>{subText(t)}</p>
                            <p style={tMeta}>◷ {new Date(t.date || 0).toLocaleDateString()}</p>
                        </div>
                    ))}
                </div>
            ) : (
                <div style={emptyCard}>No templates yet. Create one from an existing workout.</div>
            )}

            <div style={rowHead}>
                <h3 style={{ ...h3, marginBottom: 0 }}>Workout History ({workoutHistory.length})</h3>
                <button type="button" style={menuDot}>…</button>
            </div>
            {workoutHistory.length ? (
                <div style={cardGrid}>
                    {workoutHistory.map((w) => (
                        <div key={w.id} style={templateCard} onClick={() => navigate(`/workout/${w.id}`)}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                <p style={tName}>{w.name || "Workout"}</p>
                                <button type="button" style={menuDot} onClick={(e) => e.stopPropagation()}>…</button>
                            </div>
                            <p style={tSub}>{subText(w)}</p>
                            <p style={tMeta}>◷ {new Date(w.date || 0).toLocaleDateString()}</p>
                        </div>
                    ))}
                </div>
            ) : (
                <div style={emptyCard}>No workout history yet. Start an empty workout to populate this list.</div>
            )}
            </div>
        </div>
    );
};

export default WorkoutHub;
