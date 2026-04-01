import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from "react-router-dom";
import LogExercise from './LogExercise';
import { useAuth } from "../contexts/AuthContext";
import { useUnits } from "../contexts/UnitsContext";
import { authJsonHeaders, authBearerHeaders } from "../apiHeaders";
import { formatExerciseWeightKg } from "../units";
// Import the new modal we discussed
import ExercisePickerModal from './ExercisePickerModal'; 
import Sub5Badge from "../assets/sub5_frame.png";

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

const WorkoutSession = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { token } = useAuth();
    const { units } = useUnits();
    
    const [session, setSession] = useState(null);
    const [sessionExercises, setSessionExercises] = useState([]);
    const [allExercises, setAllExercises] = useState([]); 
    const [isTemplate, setIsTemplate] = useState(false);
    const [showSummary, setShowSummary] = useState(false);
    const [currentRank, setCurrentRank] = useState("SUB-5");
    const [now, setNow] = useState(0);
    const [sessionStartTime] = useState(() => Date.now());
    
    // 1. New Modal UI State
    const [showPicker, setShowPicker] = useState(false);

    useEffect(() => {
        if (!token || !id) return;

        const authH = authBearerHeaders(token);

        fetch(`/api/v1/workoutSessions/${id}`, { headers: authH })
            .then((res) => res.json())
            .then((data) => {
                if (data.error) {
                    console.error("Session Fetch Error:", data.error);
                    return;
                }
                setSession(data);
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

    const formatElapsed = () => {
        const diffMs = Math.max(0, now - sessionStartTime);
        const totalSeconds = Math.floor(diffMs / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${hours.toString().padStart(2, "0")}:${minutes
            .toString()
            .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    };

    // 2. Updated: Handle Batch Adding from Modal
    const handleAddSelectedExercises = async (selectedIds) => {
        // We iterate through selected IDs and post them
        // In a real 'Elite' app, you'd have a bulk-add endpoint, 
        // but this works with your current REST structure:
        const promises = selectedIds.map((exerciseId) =>
            fetch("/api/v1/exerciseLog", {
                method: "POST",
                headers: authJsonHeaders(token),
                body: JSON.stringify({
                    workout_sessions_id: parseInt(id, 10),
                    exercise_id: parseInt(exerciseId, 10),
                    sets: [],
                }),
            }).then((res) => res.json())
        );

        try {
            const newEntries = await Promise.all(promises);
            
            // Map the details back for local state
            const enhancedEntries = newEntries.map(entry => {
                const details = allExercises.find(ex => ex.id === entry.exercise_id);
                return {
                    ...entry,
                    name: details?.name || "Unknown",
                    body_part: details?.body_part || "N/A"
                };
            });

            setSessionExercises(prev => [...prev, ...enhancedEntries]);
            setShowPicker(false); // Close the modal
        } catch (err) {
            console.error("Batch Add Error:", err);
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

    // ... inside WorkoutSession.jsx

const handleFinishWorkout = async () => {
    try {
        // 1. Persist all in-memory set edits before building summary.
        const savePromises = sessionExercises.map((exerciseLog) =>
            fetch(`/api/v1/exerciseLog/${exerciseLog.id}`, {
                method: "PUT",
                headers: authJsonHeaders(token),
                body: JSON.stringify({
                    sets: Array.isArray(exerciseLog.sets) ? exerciseLog.sets : [],
                }),
            })
        );
        await Promise.all(savePromises);

        // 2. Fetch the absolute latest logs so summary reflects saved data.
        const logRes = await fetch(`/api/v1/exerciseLog?workout_sessions_id=${id}`, {
            headers: authBearerHeaders(token),
        });
        const latestLogs = await logRes.json();
        
        // Update the state with the fresh data before showing the modal
        setSessionExercises(Array.isArray(latestLogs) ? latestLogs : []);

        // 3. Update the session status on the backend
        await fetch(`/api/v1/workoutSessions/${id}`, {
            method: "PUT",
            headers: authJsonHeaders(token),
            body: JSON.stringify({
                is_template: isTemplate,
                end_time: new Date().toISOString(),
            }),
        });

        // 4. FINALLY: Show the modal once the data is locked in
        setShowSummary(true);
    } catch (err) {
        console.error("Finish Error:", err);
        setShowSummary(true); 
    }
};

    if (!session) return <div>Loading Session...</div>;

    return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', position: 'relative' }}>
            <h1>{session.name}</h1>
            <div style={sessionMetaStackStyle}>
                <p style={sessionMetaDateStyle}>
                    <span role="img" aria-label="calendar" style={metaIconStyle}>📅</span>
                    {formatSessionDate(session.date)}
                </p>
                <p style={sessionMetaTimeStyle}>
                    <span role="img" aria-label="clock" style={metaIconStyle}>🕒</span>
                    {formatElapsed()}
                </p>
            </div>
            <p style={{ color: '#888' }}>ID: {id}</p>
            <hr />

            {/* List of Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px' }}>
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
                <h3>Finish Workout</h3>
                <label style={checkboxLabelStyle}>
                    <input type="checkbox" checked={isTemplate} onChange={(e) => setIsTemplate(e.target.checked)} />
                    Save as template?
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button onClick={handleFinishWorkout} style={finishBtnStyle}>Finish & Save</button>
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        style={cancelWorkoutBtnStyle}
                    >
                        Cancel Workout
                    </button>
                </div>
            </div>

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
                            <h1 style={{ margin: '5px 0', fontSize: '1.8rem', color: '#000' }}>Workout Complete</h1>
                            <p style={{ color: '#666', margin: 0 }}>
                                You are one step closer to becoming a chad.
                            </p>
                        </div>

                        <div style={innerCardStyle}>
                            <h2 style={{ margin: '0 0 12px 0', fontSize: '1.2rem', color: '#000' }}>
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
                                                padding: '10px 0',
                                                borderBottom: '1px solid #f2f2f7',
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    marginBottom: '4px',
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        fontWeight: 600,
                                                        fontSize: '0.95rem',
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
                                                        fontSize: '0.85rem',
                                                        color: '#1c1c1e',
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

// --- STYLES ---
const addArea = { padding: "20px 0", display: "flex", justifyContent: "center" };
const addMovementBtn = { 
  backgroundColor: "#fff", 
  border: "2px dashed #d1d1d6", 
  color: "#007aff", 
  padding: "15px", 
  borderRadius: "14px", 
  fontWeight: "700", 
  fontSize: "1rem",
  cursor: "pointer",
  width: "100%",
  transition: "0.2s"
};

// 1. The Overlay handles ALL the scrolling
const overlayStyle = { 
    position: 'fixed', 
    top: 0, 
    left: 0, 
    width: '100%', 
    height: '100%', 
    backgroundColor: 'rgba(255, 255, 255, 0.98)', 
    display: 'block',      // Changed from flex to block
    zIndex: 2000,
    overflowY: 'auto',     // Scroll lives here now
    padding: '40px 0' 
};

// 2. The Summary Card centers itself using margins
const summaryCardStyle = { 
    width: '90%', 
    maxWidth: '400px', 
    margin: '0 auto',      // Centers the card horizontally
    textAlign: 'center',
    paddingBottom: '40px'  // Space at the very bottom
};

// 3. Remove the max-height and internal scroll from the Inner Card
const innerCardStyle = { 
    backgroundColor: '#fff', 
    borderRadius: '16px', 
    padding: '20px', 
    textAlign: 'left', 
    border: '1px solid #eee', 
    boxShadow: '0 10px 25px rgba(0,0,0,0.05)', 
    marginBottom: '20px'
    // REMOVED: maxHeight and overflowY
};
const finishAreaStyle = { marginTop: '50px', padding: '30px', borderTop: '2px solid #ddd', textAlign: 'center' };
const finishBtnStyle = { width: '100%', padding: '12px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' };
const checkboxLabelStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '20px' };
const closeBtnStyle = { background: 'none', border: 'none', color: '#007aff', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' };
const sessionMetaStackStyle = { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px', marginBottom: '8px' };
const sessionMetaDateStyle = { color: '#8e8e93', margin: 0, display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' };
const sessionMetaTimeStyle = { color: '#007aff', margin: 0, display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700' };
const metaIconStyle = { fontSize: '0.95rem', lineHeight: 1 };

const cancelWorkoutBtnStyle = {
  width: '100%',
  padding: '10px',
  borderRadius: '6px',
  border: '1px solid #ff3b30',
  backgroundColor: 'transparent',
  color: '#ff3b30',
  fontWeight: '700',
  cursor: 'pointer',
  fontSize: '0.9rem',
};

export default WorkoutSession;