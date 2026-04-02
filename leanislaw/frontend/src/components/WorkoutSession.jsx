import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from "react-router-dom";
import LogExercise from './LogExercise';
import { useAuth } from "../contexts/AuthContext";
import { useUnits } from "../contexts/UnitsContext";
import { useActiveWorkout } from "../contexts/ActiveWorkoutContext";
import { authJsonHeaders, authBearerHeaders } from "../apiHeaders";
import { formatExerciseWeightKg } from "../units";
// Import the new modal we discussed
import ExercisePickerModal from './ExercisePickerModal'; 
import Sub5Badge from "../assets/sub5_frame.png";

/** Sets with weight/reps logged but not marked done (LogExercise `isDone`). */
function countUnfinishedSets(logs) {
    let n = 0;
    for (const log of logs) {
        const sets = Array.isArray(log.sets) ? log.sets : [];
        for (const s of sets) {
            const hasData =
                String(s.weight ?? "").trim() !== "" || String(s.reps ?? "").trim() !== "";
            if (hasData && !s.isDone) n += 1;
        }
    }
    return n;
}

// Reuse the same rank logic as the dashboard
const getChadRank = (workoutCount) => {
    if (workoutCount === 0) return "SUBHUMAN";
    if (workoutCount < 5) return "SUB-5";
    if (workoutCount < 50) return "LTN";
    if (workoutCount < 100) return "MTN";
    if (workoutCount < 200) return "HTN";
    if (workoutCount < 300) return "CHAD LITE";
    if (workoutCount >= 300) return "CHAD";
    return "SUB-5";
};

/** Avoid resurrecting the PiP widget: a slow initial session GET can resolve after finish and strip endTime. */
function mergeSessionPreserveCompletion(prev, incoming) {
    if (!incoming || incoming.error) return prev;
    const pEnd = prev?.endTime ?? prev?.end_time;
    const iEnd = incoming.endTime ?? incoming.end_time;
    if (pEnd && !iEnd) return { ...incoming, endTime: pEnd };
    return incoming;
}

const WorkoutSession = ({ sessionId: sessionIdProp, sheetMode = false }) => {
    const { id: routeId } = useParams();
    const id = sessionIdProp ?? routeId;
    const navigate = useNavigate();
    const { token } = useAuth();
    const { units } = useUnits();
    const { activeWorkout, setActiveWorkout, clearActiveWorkout } = useActiveWorkout();
    
    const [session, setSession] = useState(null);
    const [sessionExercises, setSessionExercises] = useState([]);
    const [allExercises, setAllExercises] = useState([]); 
    const [isTemplate, setIsTemplate] = useState(false);
    const [showSummary, setShowSummary] = useState(false);
    const [currentRank, setCurrentRank] = useState("SUB-5");
    const [now, setNow] = useState(0);
    const [sessionStartTime, setSessionStartTime] = useState(() => Date.now());
    
    // 1. New Modal UI State
    const [showPicker, setShowPicker] = useState(false);
    const [showFinishModal, setShowFinishModal] = useState(false);
    const [finishSaving, setFinishSaving] = useState(false);
    const [finishError, setFinishError] = useState(null);
    const addMovementsInFlightRef = useRef(false);
    /** After cancel, clearActiveWorkout() would otherwise let this effect immediately call setActiveWorkout again on the same in-flight screen. */
    const skipRegisterActiveRef = useRef(false);

    const unfinishedSetCount = countUnfinishedSets(sessionExercises);

    useEffect(() => {
        skipRegisterActiveRef.current = false;
    }, [id]);

    useEffect(() => {
        if (!token || id == null || id === "") return;

        const authH = authBearerHeaders(token);

        fetch(`/api/v1/workoutSessions/${id}`, { headers: authH })
            .then((res) => res.json())
            .then((data) => {
                if (data.error) {
                    console.error("Session Fetch Error:", data.error);
                    return;
                }
                setSession((prev) => mergeSessionPreserveCompletion(prev, data));
                setIsTemplate(data.is_template || false);
            })
            .catch((err) => console.error("Session Fetch Error:", err));

        fetch('/api/v1/exercises')
            .then((res) => res.json())
            .then((data) => setAllExercises(data))
            .catch((err) => console.error("Menu Fetch Error:", err));

        fetch(`/api/v1/exerciseLog?workout_sessions_id=${id}`, { headers: authH })
            .then((res) => res.json())
            .then((data) => {
                setSessionExercises(Array.isArray(data) ? data : []);
            })
            .catch((err) => console.error("Log Fetch Error:", err));

        fetch('/api/v1/workoutSessions', { headers: authH })
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data)) {
                    setCurrentRank(getChadRank(data.length));
                }
            })
            .catch((err) => console.error("History Fetch Error:", err));
    }, [id, token]);

    useEffect(() => {
        if (!session) return;
        const sid = Number(id);
        const ctxSid = activeWorkout != null ? Number(activeWorkout.sessionId) : NaN;
        const ctxMatches = Number.isFinite(ctxSid) && ctxSid === sid;
        const endedAt = session.endTime ?? session.end_time;
        if (endedAt) {
            if (activeWorkout != null && ctxMatches) {
                clearActiveWorkout();
            }
            if (session.date != null) {
                const startMs = new Date(session.date).getTime();
                if (Number.isFinite(startMs)) setSessionStartTime(startMs);
            }
            return;
        }
        if (showSummary) return;
        if (skipRegisterActiveRef.current) return;
        const fromContext =
            ctxMatches && Number.isFinite(activeWorkout?.startTimeMs)
                ? activeWorkout.startTimeMs
                : Date.now();
        setSessionStartTime(fromContext);
        const nextName = session.name || "Workout";
        const needsUpdate =
            !ctxMatches ||
            activeWorkout?.startTimeMs !== fromContext ||
            activeWorkout?.sessionName !== nextName;
        if (needsUpdate) {
            setActiveWorkout({
                sessionId: sid,
                sessionName: nextName,
                startTimeMs: fromContext,
            });
        }
    }, [id, session, activeWorkout, setActiveWorkout, clearActiveWorkout, showSummary]);

    useEffect(() => {
        setNow(Date.now());
        const interval = setInterval(() => {
            setNow(Date.now());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const formatSessionDate = (dateValue) => {
        if (!dateValue) return "Unknown date";
        const parsed = new Date(dateValue);
        if (Number.isNaN(parsed.getTime())) return "Unknown date";
        return parsed.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    };

    const elapsedClockMs = () => {
        const endRaw = session?.endTime ?? session?.end_time;
        if (endRaw) {
            const t = new Date(endRaw).getTime();
            if (Number.isFinite(t)) return t;
        }
        return now;
    };

    const formatElapsed = () => {
        const diffMs = Math.max(0, elapsedClockMs() - sessionStartTime);
        const totalSeconds = Math.floor(diffMs / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${hours.toString().padStart(2, "0")}:${minutes
            .toString()
            .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    };

    /** Compact timer for the sticky bar (e.g. 2:54 or 1:02:03). */
    const formatElapsedShort = () => {
        const diffMs = Math.max(0, elapsedClockMs() - sessionStartTime);
        const totalSeconds = Math.floor(diffMs / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        if (hours > 0) {
            return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
        }
        return `${minutes}:${String(seconds).padStart(2, "0")}`;
    };

    // 2. Batch add from modal — dedupe IDs, skip already in session, guard double-submit
    const handleAddSelectedExercises = async (selectedIds) => {
        if (addMovementsInFlightRef.current) return;

        const uniqueIds = [
            ...new Set(
                selectedIds
                    .map((x) => Number(x))
                    .filter((n) => Number.isFinite(n))
            ),
        ];
        const alreadyInSession = new Set(
            sessionExercises
                .map((l) => Number(l.exercise_id))
                .filter((n) => Number.isFinite(n))
        );
        const toAdd = uniqueIds.filter((exId) => !alreadyInSession.has(exId));
        if (toAdd.length === 0) {
            setShowPicker(false);
            return;
        }

        addMovementsInFlightRef.current = true;
        try {
            const promises = toAdd.map((exerciseId) =>
                fetch("/api/v1/exerciseLog", {
                    method: "POST",
                    headers: authJsonHeaders(token),
                    body: JSON.stringify({
                        workout_sessions_id: parseInt(id, 10),
                        exercise_id: exerciseId,
                        sets: [],
                    }),
                }).then(async (res) => {
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || "Add failed");
                    return data;
                })
            );

            const newEntries = await Promise.all(promises);

            const enhancedEntries = newEntries.map((entry) => {
                const eid = Number(entry.exercise_id);
                const details = allExercises.find((ex) => Number(ex.id) === eid);
                return {
                    ...entry,
                    name: entry.name ?? details?.name ?? "Unknown",
                    body_part: details?.body_part ?? "N/A",
                };
            });

            setSessionExercises((prev) => {
                const seenLogIds = new Set(prev.map((l) => l.id));
                const merged = [...prev];
                for (const row of enhancedEntries) {
                    if (row.id != null && !seenLogIds.has(row.id)) {
                        seenLogIds.add(row.id);
                        merged.push(row);
                    }
                }
                return merged;
            });
            setShowPicker(false);
        } catch (err) {
            console.error("Batch Add Error:", err);
        } finally {
            addMovementsInFlightRef.current = false;
        }
    };

    const handleDeleteExercise = async (logId) => {
        try {
            const response = await fetch(`/api/v1/exerciseLog/${logId}`, {
                method: "DELETE",
                headers: authBearerHeaders(token),
            });
            if (response.ok) {
                setSessionExercises(prev => prev.filter(ex => ex.id !== logId));
            }
        } catch (err) {
            console.error("Delete Error:", err);
        }
    };

    const handleSetsChange = useCallback((logId, updatedSets) => {
        setSessionExercises((prev) =>
            prev.map((exerciseLog) =>
                exerciseLog.id === logId
                    ? { ...exerciseLog, sets: updatedSets }
                    : exerciseLog
            )
        );
    }, []);

    const handleFinishWorkout = async () => {
        setFinishError(null);
        setFinishSaving(true);
        try {
            const sid = Number(id);
            if (!Number.isFinite(sid)) {
                throw new Error("Invalid workout session");
            }

            const logsToSave = sessionExercises.filter((row) => row?.id != null);
            await Promise.all(
                logsToSave.map(async (exerciseLog) => {
                    const res = await fetch(`/api/v1/exerciseLog/${exerciseLog.id}`, {
                        method: "PUT",
                        headers: authJsonHeaders(token),
                        body: JSON.stringify({
                            sets: Array.isArray(exerciseLog.sets) ? exerciseLog.sets : [],
                        }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) {
                        throw new Error(data?.error || `Could not save exercise log (${exerciseLog.id})`);
                    }
                })
            );

            const logRes = await fetch(`/api/v1/exerciseLog?workout_sessions_id=${sid}`, {
                headers: authBearerHeaders(token),
            });
            const latestLogs = await logRes.json().catch(() => null);
            if (!logRes.ok) {
                const msg =
                    latestLogs && typeof latestLogs === "object" && latestLogs.error
                        ? latestLogs.error
                        : "Could not reload exercise logs";
                throw new Error(msg);
            }
            setSessionExercises(Array.isArray(latestLogs) ? latestLogs : []);

            const endIso = new Date().toISOString();
            const putRes = await fetch(`/api/v1/workoutSessions/${sid}`, {
                method: "PUT",
                headers: authJsonHeaders(token),
                body: JSON.stringify({
                    is_template: isTemplate,
                    end_time: endIso,
                }),
            });
            const putBody = await putRes.json().catch(() => null);
            const putErr =
                putBody && typeof putBody === "object" && !Array.isArray(putBody) && putBody.error
                    ? String(putBody.error)
                    : null;
            if (!putRes.ok || !putBody || Array.isArray(putBody) || putErr) {
                throw new Error(putErr || "Could not save workout (session update failed)");
            }
            setSession((prev) =>
                mergeSessionPreserveCompletion(prev, {
                    ...putBody,
                    endTime: endIso,
                })
            );
            skipRegisterActiveRef.current = false;
            clearActiveWorkout();
            setShowFinishModal(false);
            setShowSummary(true);
        } catch (err) {
            console.error("Finish Error:", err);
            setFinishError(err?.message || "Could not save workout");
        } finally {
            setFinishSaving(false);
        }
    };

    const openFinishModal = () => {
        setFinishError(null);
        setShowFinishModal(true);
    };

    const confirmFinishFromModal = async () => {
        await handleFinishWorkout();
    };

    if (!id) {
        return (
            <div style={loadingWrapStyle}>
                <p style={loadingTextStyle}>Loading session…</p>
            </div>
        );
    }

    if (!session) {
        return (
            <div style={loadingWrapStyle}>
                <p style={loadingTextStyle}>Loading session…</p>
            </div>
        );
    }

    const wrapStyle = sheetMode
        ? {
              ...pageWrapStyle,
              flex: 1,
              minHeight: 0,
              height: "100%",
              maxHeight: "100%",
          }
        : pageWrapStyle;
    const headerStyle = sheetMode
        ? { ...stickySessionNavStyle, paddingTop: 10 }
        : stickySessionNavStyle;

    return (
        <div style={wrapStyle}>
            <header style={headerStyle}>
                <div style={navTimerBlockStyle} aria-live="polite">
                    <span style={navTimerIconStyle} aria-hidden>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="13" r="7" />
                            <path d="M12 9v4l2 2M9 3h6" />
                        </svg>
                    </span>
                    <span style={navTimerTextStyle}>{formatElapsedShort()}</span>
                </div>
                <h2 style={stickyNavTitleStyle}>{session.name}</h2>
                <button type="button" style={stickyFinishBtnStyle} onClick={openFinishModal}>
                    Finish
                </button>
            </header>

            <div style={sessionScrollAreaStyle}>
            <div style={sessionInnerMaxStyle}>
            <div style={sessionMetaStackStyle}>
                <p style={sessionMetaDateStyle}>
                    <span role="img" aria-label="calendar" style={metaIconStyle}>📅</span>
                    {formatSessionDate(session.date)}
                </p>
                <p style={sessionMetaTimeStyle}>
                    <span role="img" aria-label="clock" style={metaIconStyle}>🕒</span>
                    Session time {formatElapsed()}
                </p>
            </div>
            <div style={sessionDividerStyle} />

            {/* List of Cards */}
            <div style={exerciseListStyle}>
                {sessionExercises.map((log) => (
                    <LogExercise
                        key={log.id}
                        log={log}
                        onDelete={handleDeleteExercise}
                        onSetsChange={handleSetsChange}
                    />
                ))}
            </div>

            {/* --- NEW ELITE ADD MOVEMENT BUTTON --- */}
            <div style={addArea}>
                <button onClick={() => setShowPicker(true)} style={addMovementBtn}>
                    + Add Movement
                </button>
            </div>

            {/* --- MODAL PICKER --- */}
            {showPicker && (
                <ExercisePickerModal 
                    onClose={() => setShowPicker(false)} 
                    onConfirm={handleAddSelectedExercises}
                    allExercises={allExercises} 
                />
            )}

            {/* Finish Section */}
            <div style={finishAreaStyle}>
                <h3 style={finishAreaTitleStyle}>Finish workout</h3>
                <label style={checkboxLabelStyle}>
                    <input
                        type="checkbox"
                        checked={isTemplate}
                        onChange={(e) => setIsTemplate(e.target.checked)}
                        style={{ accentColor: "#007aff", width: 18, height: 18 }}
                    />
                    Save as template?
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button type="button" onClick={openFinishModal} style={finishBtnStyle}>
                        Finish &amp; save
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            skipRegisterActiveRef.current = true;
                            clearActiveWorkout();
                            navigate(sheetMode ? "/workout" : -1);
                        }}
                        style={cancelWorkoutBtnStyle}
                    >
                        Cancel workout
                    </button>
                </div>
            </div>
            </div>
            </div>

            {showFinishModal ? (
                <div
                    style={finishPromptBackdropStyle}
                    role="presentation"
                    onClick={() => setShowFinishModal(false)}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="finish-modal-title"
                        style={finishPromptCardStyle}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <p style={{ fontSize: "1.75rem", margin: "0 0 8px", textAlign: "center" }} aria-hidden>
                            🎉
                        </p>
                        <h3 id="finish-modal-title" style={finishModalTitleStyle}>
                            Finish workout?
                        </h3>
                        {unfinishedSetCount > 0 ? (
                            <p style={finishModalBodyStyle}>
                                There are valid sets in this workout that have not been marked as complete.
                            </p>
                        ) : (
                            <p style={finishModalBodyStyle}>
                                Save this session and view your summary.
                            </p>
                        )}
                        {finishError ? (
                            <p style={{ ...finishModalBodyStyle, color: "#c00", fontWeight: 600 }} role="alert">
                                {finishError}
                            </p>
                        ) : null}
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {unfinishedSetCount > 0 ? (
                                <>
                                    <button
                                        type="button"
                                        style={finishPromptCompleteSetsStyle}
                                        disabled={finishSaving}
                                        onClick={() => setShowFinishModal(false)}
                                    >
                                        Complete unfinished sets
                                    </button>
                                    <button
                                        type="button"
                                        style={finishPromptCompleteSetsStyle}
                                        disabled={finishSaving}
                                        onClick={confirmFinishFromModal}
                                    >
                                        {finishSaving ? "Saving…" : "Finish & save anyway"}
                                    </button>
                                    <button
                                        type="button"
                                        style={finishPromptDangerFillStyle}
                                        disabled={finishSaving}
                                        onClick={() => {
                                            skipRegisterActiveRef.current = true;
                                            clearActiveWorkout();
                                            navigate(sheetMode ? "/workout" : -1);
                                        }}
                                    >
                                        Cancel workout
                                    </button>
                                    <button
                                        type="button"
                                        style={finishPromptCancelGreyStyle}
                                        disabled={finishSaving}
                                        onClick={() => setShowFinishModal(false)}
                                    >
                                        Close
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        style={finishPromptCompleteSetsStyle}
                                        disabled={finishSaving}
                                        onClick={confirmFinishFromModal}
                                    >
                                        {finishSaving ? "Saving…" : "Finish & save"}
                                    </button>
                                    <button
                                        type="button"
                                        style={finishPromptCancelGreyStyle}
                                        disabled={finishSaving}
                                        onClick={() => setShowFinishModal(false)}
                                    >
                                        Cancel
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}

            {/* SUMMARY MODAL */}
            {showSummary && (
                <div style={overlayStyle}>
                    <div style={summaryCardStyle}>
                        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                            <div style={{ marginBottom: '10px' }}>
                                <img 
                                    src={Sub5Badge} 
                                    alt="Sub-5 ascension badge" 
                                    style={{ width: '160px', height: '160px', objectFit: 'contain' }} 
                                />
                            </div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#8e8e93', letterSpacing: '1px' }}>
                                CURRENT RANK: {currentRank}
                            </div>
                            <h1 style={{ margin: "5px 0", fontSize: "1.8rem", color: "#000" }}>Workout Complete</h1>
                            <p style={{ color: "#666", margin: 0 }}>
                                You are one step closer to becoming a chad.
                            </p>
                        </div>

                        <div style={innerCardStyle}>
                            <h2 style={{ margin: "0 0 12px 0", fontSize: "1.2rem", color: "#000" }}>
                                {session.name}
                            </h2>

                            {/* Per‑exercise summary */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {sessionExercises.length === 0 && (
                                    <p style={{ fontSize: '0.9rem', color: '#8e8e93', margin: 0 }}>
                                        No sets logged for this session yet.
                                    </p>
                                )}

                                {sessionExercises.map((log) => {
                                    const sets = Array.isArray(log.sets) ? log.sets : [];

                                    // Count sets that have at least weight or reps filled
                                    const completedSets = sets.filter(
                                        (s) =>
                                            (s.weight !== "" && s.weight !== null && s.weight !== undefined) ||
                                            (s.reps !== "" && s.reps !== null && s.reps !== undefined)
                                    );
                                    const totalSets = completedSets.length;

                                    // Pick "best" set by highest weight, then reps
                                    const bestSet = completedSets.reduce((best, current) => {
                                        if (!best) return current;

                                        const bestWeight = parseFloat(best.weight || "0");
                                        const currentWeight = parseFloat(current.weight || "0");
                                        if (currentWeight > bestWeight) return current;
                                        if (currentWeight < bestWeight) return best;

                                        const bestReps = parseFloat(best.reps || "0");
                                        const currentReps = parseFloat(current.reps || "0");
                                        return currentReps > bestReps ? current : best;
                                    }, null);

                                    return (
                                        <div
                                            key={log.id}
                                            style={{
                                                padding: "10px 0",
                                                borderBottom: "1px solid #f2f2f7",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    alignItems: "center",
                                                    marginBottom: "4px",
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        fontWeight: 600,
                                                        fontSize: "0.95rem",
                                                        color: "#1c1c1e",
                                                    }}
                                                >
                                                    {log.name}
                                                </span>
                                                <span
                                                    style={{
                                                        fontSize: '0.8rem',
                                                        color: '#8e8e93',
                                                    }}
                                                >
                                                    {totalSets} set{totalSets === 1 ? '' : 's'} completed
                                                </span>
                                            </div>

                                            {bestSet && (
                                                <div
                                                    style={{
                                                        fontSize: "0.85rem",
                                                        color: "#1c1c1e",
                                                    }}
                                                >
                                                    <span style={{ fontWeight: 600 }}>Best set:</span>{' '}
                                                    {formatExerciseWeightKg(String(bestSet.weight ?? ""), units) || 0}{' '}
                                                    {units === 'imperial' ? 'lb' : 'kg'} × {bestSet.reps || 0} reps
                                                    {bestSet.rpe !== "" &&
                                                        bestSet.rpe !== null &&
                                                        bestSet.rpe !== undefined && (
                                                            <span>{` @ RPE ${bestSet.rpe}`}</span>
                                                        )}
                                                </div>
                                            )}

                                            {!bestSet && totalSets === 0 && (
                                                <div
                                                    style={{
                                                        fontSize: '0.8rem',
                                                        color: '#8e8e93',
                                                    }}
                                                >
                                                    No sets logged for this movement.
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <button
                            onClick={() => navigate('/dashboard')}
                            style={closeBtnStyle}
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- STYLES (aligned with WorkoutHub / app iOS-light) ---
const appFont = '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';

const loadingWrapStyle = {
    minHeight: "100vh",
    height: "100dvh",
    width: "100%",
    maxWidth: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f2f2f7",
    boxSizing: "border-box",
    fontFamily: appFont,
};

const loadingTextStyle = {
    margin: 0,
    color: "#636366",
    fontSize: "1rem",
    fontWeight: 600,
};

const pageWrapStyle = {
    minHeight: "100vh",
    height: "100dvh",
    width: "100%",
    maxWidth: "100%",
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#f2f2f7",
    overflow: "hidden",
    boxSizing: "border-box",
    fontFamily: appFont,
};

const stickySessionNavStyle = {
    flexShrink: 0,
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
    alignItems: "center",
    gap: 10,
    paddingTop: "calc(10px + env(safe-area-inset-top, 0px))",
    paddingRight: "max(12px, env(safe-area-inset-right, 0px))",
    paddingBottom: 10,
    paddingLeft: "max(12px, env(safe-area-inset-left, 0px))",
    backgroundColor: "#f2f2f7",
    borderBottom: "0.5px solid #d1d1d6",
    zIndex: 100,
    width: "100%",
    boxSizing: "border-box",
};

const navTimerBlockStyle = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
};

const navTimerIconStyle = {
    display: "flex",
    color: "#007aff",
};

const navTimerTextStyle = {
    fontVariantNumeric: "tabular-nums",
    fontWeight: "800",
    fontSize: "1rem",
    color: "#007aff",
};

const stickyNavTitleStyle = {
    margin: 0,
    fontSize: "0.95rem",
    fontWeight: "800",
    letterSpacing: "-0.2px",
    color: "#000",
    textAlign: "center",
    lineHeight: 1.2,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

const stickyFinishBtnStyle = {
    border: "none",
    borderRadius: 11,
    padding: "8px 14px",
    fontSize: "0.88rem",
    fontWeight: "800",
    cursor: "pointer",
    backgroundColor: "#000",
    color: "#fff",
};

const sessionScrollAreaStyle = {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    backgroundColor: "#f2f2f7",
};

const sessionInnerMaxStyle = {
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
    paddingTop: 12,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
};

const sessionDividerStyle = {
    height: 1,
    backgroundColor: "#d1d1d6",
    margin: "12px 0 16px",
};

const exerciseListStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 0,
    marginBottom: 0,
};

const finishPromptBackdropStyle = {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    zIndex: 4000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    boxSizing: "border-box",
};

const finishPromptCardStyle = {
    background: "#fff",
    borderRadius: 16,
    padding: "22px 20px",
    maxWidth: 400,
    width: "100%",
    boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
    boxSizing: "border-box",
    border: "0.5px solid #d1d1d6",
};

const finishModalTitleStyle = {
    margin: "0 0 10px",
    fontSize: "1.15rem",
    fontWeight: "800",
    textAlign: "center",
    color: "#000",
};

const finishModalBodyStyle = {
    margin: "0 0 18px",
    fontSize: "0.9rem",
    color: "#636366",
    lineHeight: 1.45,
    textAlign: "center",
};

const finishPromptCompleteSetsStyle = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "none",
    backgroundColor: "#000",
    color: "#fff",
    fontWeight: "800",
    fontSize: "0.95rem",
    cursor: "pointer",
};

const finishPromptDangerFillStyle = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #ff3b30",
    backgroundColor: "#fff5f5",
    color: "#ff3b30",
    fontWeight: "700",
    fontSize: "0.9rem",
    cursor: "pointer",
};

const finishPromptCancelGreyStyle = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #d1d1d6",
    backgroundColor: "#f2f2f7",
    color: "#007aff",
    fontWeight: "600",
    fontSize: "0.9rem",
    cursor: "pointer",
};

const addArea = {
    padding: "16px max(12px, env(safe-area-inset-left, 0px)) 8px max(12px, env(safe-area-inset-right, 0px))",
    display: "flex",
    justifyContent: "center",
    boxSizing: "border-box",
};
const addMovementBtn = {
    backgroundColor: "#fff",
    border: "2px dashed #c7c7cc",
    color: "#007aff",
    padding: "15px",
    borderRadius: "12px",
    fontWeight: "700",
    fontSize: "1rem",
    cursor: "pointer",
    width: "100%",
    transition: "0.2s",
    boxSizing: "border-box",
};

const overlayStyle = {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    display: "block",
    zIndex: 2000,
    overflowY: "auto",
    padding: "40px 0",
};

const summaryCardStyle = {
    width: "90%",
    maxWidth: "400px",
    margin: "0 auto",
    textAlign: "center",
    paddingBottom: "40px",
};

const innerCardStyle = {
    backgroundColor: "#fff",
    borderRadius: "16px",
    padding: "20px",
    textAlign: "left",
    border: "0.5px solid #d1d1d6",
    boxShadow: "0 10px 25px rgba(0,0,0,0.05)",
    marginBottom: "20px",
};

const finishAreaStyle = {
    marginTop: 8,
    padding:
        "22px max(12px, env(safe-area-inset-left, 0px)) calc(22px + env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-right, 0px))",
    textAlign: "center",
    backgroundColor: "#fff",
    borderRadius: 0,
    border: "none",
    borderTop: "0.5px solid #d1d1d6",
    boxSizing: "border-box",
    width: "100%",
};

const finishAreaTitleStyle = {
    margin: "0 0 14px",
    fontSize: "1.05rem",
    fontWeight: 800,
    color: "#1c1c1e",
};

const finishBtnStyle = {
    width: "100%",
    padding: "14px",
    backgroundColor: "#000",
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    fontWeight: "800",
    cursor: "pointer",
    fontSize: "1rem",
};

const checkboxLabelStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    marginBottom: "20px",
    color: "#636366",
    fontSize: "0.9rem",
};

const closeBtnStyle = {
    background: "#f2f2f7",
    border: "none",
    color: "#007aff",
    fontSize: "1rem",
    fontWeight: "700",
    cursor: "pointer",
    padding: "12px 24px",
    borderRadius: 12,
    width: "100%",
};

const sessionMetaStackStyle = {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "6px",
    marginBottom: "4px",
    paddingLeft: "max(12px, env(safe-area-inset-left, 0px))",
    paddingRight: "max(12px, env(safe-area-inset-right, 0px))",
    boxSizing: "border-box",
};

const sessionMetaDateStyle = {
    color: "#8e8e93",
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontWeight: "600",
    fontSize: "0.85rem",
};

const sessionMetaTimeStyle = {
    color: "#007aff",
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontWeight: "700",
    fontSize: "0.85rem",
};

const metaIconStyle = { fontSize: "0.95rem", lineHeight: 1 };

const cancelWorkoutBtnStyle = {
    width: "100%",
    padding: "12px",
    borderRadius: "12px",
    border: "1px solid #ff3b30",
    backgroundColor: "transparent",
    color: "#ff3b30",
    fontWeight: "700",
    cursor: "pointer",
    fontSize: "0.9rem",
};

export default WorkoutSession;