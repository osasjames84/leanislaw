import { useState, useEffect } from "react";
import { useUnits } from "../contexts/UnitsContext";
import { formatExerciseWeightKg, parseExerciseWeightToKg } from "../units";

const LogExercise = ({ log, onDelete, onSetsChange }) => {
    const { units } = useUnits();
    const normalizeSets = (rawSets) => {
        const base = Array.isArray(rawSets) && rawSets.length > 0
            ? rawSets
            : [{ weight: "", reps: "", rpe: "" }];
        return base.map((s) => ({
            weight: s.weight ?? "",
            reps: s.reps ?? "",
            rpe: s.rpe ?? "",
            // Always start as "not done" with no active timer when the page loads
            isDone: false,
            restEndTime: null,
            restDurationMs: null,
        }));
    };

    const [sets, setSets] = useState(normalizeSets(log.sets));
    const [restMinutes, setRestMinutes] = useState(2);
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const interval = setInterval(() => {
            setNow(Date.now());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (typeof onSetsChange === "function") {
            onSetsChange(log.id, sets);
        }
    }, [sets, log.id, onSetsChange]);

    const handleAddSet = () => {
        // We don't need to calculate IDs anymore, just push a new object
        setSets([
            ...sets,
            { weight: "", reps: "", rpe: "", isDone: false, restEndTime: null, restDurationMs: null },
        ]);
    };

    const removeSet = (indexToRemove) => {
        // Filter by index instead of ID
        setSets(prevSets => prevSets.filter((_, index) => index !== indexToRemove));
    };

    const updateSetData = (indexToUpdate, field, value) => {
        setSets(prevSets => prevSets.map((s, index) => 
            index === indexToUpdate ? { ...s, [field]: value } : s
        ));
    };

    const toggleSetDone = (indexToUpdate, checked) => {
        const durationMs = Number(restMinutes) > 0 ? Number(restMinutes) * 60 * 1000 : 0;
        const targetEnd = checked && durationMs > 0 ? Date.now() + durationMs : null;

        setSets(prevSets =>
            prevSets.map((s, index) =>
                index === indexToUpdate
                    ? { ...s, isDone: checked, restEndTime: targetEnd, restDurationMs: checked ? durationMs : null }
                    : s
            )
        );
    };

    const formatRemaining = (endTime) => {
        if (!endTime) return null;
        const diff = Math.max(0, Math.floor((endTime - now) / 1000));
        const minutes = Math.floor(diff / 60);
        const seconds = diff % 60;
        return `${minutes.toString().padStart(2, "0")}:${seconds
            .toString()
            .padStart(2, "0")}`;
    };

    const formatConfiguredRest = () => {
        const mins = Math.max(0, Number(restMinutes) || 0);
        return `${mins.toString().padStart(2, "0")}:00`;
    };

    const getTimerLabel = (set) => {
        if (set.restEndTime) {
            const live = formatRemaining(set.restEndTime);
            if (live) return live;
            return "00:00";
        }
        return formatConfiguredRest();
    };

    return (
        <div style={containerStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <h4 style={{ margin: 0 }}>{log.name}</h4>
                <button onClick={() => onDelete(log.id)} style={removeExBtn}>Remove Exercise</button>
            </div>

            {/* Rest timer configuration */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", fontSize: "0.8rem", color: "#555" }}>
                <span style={{ fontWeight: 600 }}>Rest timer per set:</span>
                <input
                    type="number"
                    min="0"
                    value={restMinutes}
                    onChange={(e) => setRestMinutes(e.target.value)}
                    style={{ width: "60px", padding: "4px", fontSize: "0.8rem" }}
                />
                <span>minute(s)</span>
            </div>

            {/* Grid Header */}
            <div style={gridHeaderStyle}>
                <div>SET</div>
                <div>WEIGHT</div>
                <div>REPS</div>
                <div>RPE</div>
                <div>DONE</div>
                <div></div>
            </div>

            {/* Set Rows */}
            {sets.map((set, index) => (
                <div key={index} style={{ marginBottom: '6px' }}>
                    <div style={gridRowStyle}>
                        {/* DISPLAY LOGIC: 
                            We use index + 1 so that if you delete set 2, 
                            set 3 automatically becomes the new set 2.
                        */}
                        <div style={{ textAlign: 'center', fontWeight: 'bold' }}>{index + 1}</div>
                        
                        <input
                            type="number"
                            step="any"
                            value={formatExerciseWeightKg(set.weight, units)}
                            onChange={(e) =>
                                updateSetData(index, "weight", parseExerciseWeightToKg(e.target.value, units))
                            }
                            placeholder={units === "imperial" ? "lb" : "kg"}
                            style={inputStyle}
                        />
                        <input 
                            type="number" 
                            value={set.reps} 
                            onChange={(e) => updateSetData(index, 'reps', e.target.value)} 
                            placeholder="0" 
                            style={inputStyle} 
                        />
                        <input 
                            type="number" 
                            value={set.rpe} 
                            onChange={(e) => updateSetData(index, 'rpe', e.target.value)} 
                            placeholder="0" 
                            style={inputStyle} 
                        />

                        <div style={{ textAlign: "center" }}>
                            <input
                                type="checkbox"
                                checked={!!set.isDone}
                                onChange={(e) => toggleSetDone(index, e.target.checked)}
                            />
                        </div>
                        
                        <button 
                            onClick={() => removeSet(index)}
                            style={deleteSetBtn}
                        >
                            &times;
                        </button>
                    </div>
                    <div style={restBarOuter}>
                        <div style={getRestBarInnerStyle(set.restEndTime, set.restDurationMs)} />
                        <span style={restBarText}>
                            Rest {getTimerLabel(set)}
                        </span>
                    </div>
                </div>
            ))}

            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button onClick={handleAddSet} style={btnSecondary}>+ Add Set</button>
            </div>
        </div>
    );
};

// Styles
const containerStyle = { border: '1px solid #ddd', borderRadius: '8px', padding: '12px', marginBottom: '15px', backgroundColor: '#fff', maxWidth: '550px', boxSizing: 'border-box' };
const gridHeaderStyle = { display: 'grid', gridTemplateColumns: '40px 1.5fr 1fr 1fr 60px 40px', gap: '8px', marginBottom: '8px', fontWeight: 'bold', fontSize: '0.7rem', color: '#888', textAlign: 'center' };
const gridRowStyle = { display: 'grid', gridTemplateColumns: '40px 1.5fr 1fr 1fr 60px 40px', gap: '8px', alignItems: 'center' };
const inputStyle = { width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '0.9rem', boxSizing: 'border-box' };
const removeExBtn = { color: '#ff4d4d', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem' };
const deleteSetBtn = { background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: '1.2rem' };
const btnSecondary = { flex: 1, padding: '8px', backgroundColor: '#f8f9fa', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', fontWeight: '700' };

const restBarOuter = { marginTop: '4px', width: '100%', backgroundColor: '#e5e5ea', borderRadius: '999px', overflow: 'hidden', height: '18px', position: 'relative' };
const restBarText = {
    fontSize: '0.7rem',
    color: '#fff',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 2,
    textShadow: '0 1px 2px rgba(0,0,0,0.4)',
};

const getRestBarInnerStyle = (endTime, restDurationMs) => {
    // Before a set is ticked, show a full bar that does not move.
    if (!endTime) {
        return {
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '100%',
            backgroundColor: '#007aff',
            zIndex: 1,
        };
    }

    const totalMs = restDurationMs && restDurationMs > 0 ? restDurationMs : 1;
    const remaining = Math.max(0, endTime - Date.now());
    const pct = Math.max(0, Math.min(100, (remaining / totalMs) * 100));
    return {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: `${pct}%`,
        backgroundColor: '#007aff',
        transition: 'width 0.5s linear',
        zIndex: 1,
    };
};

export default LogExercise;