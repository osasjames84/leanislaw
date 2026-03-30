import { useState, useEffect } from 'react';
import { useParams, useNavigate } from "react-router-dom";
import LogExercise from './LogExercise'; 

const WorkoutSession = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    
    // Core State
    const [session, setSession] = useState(null);
    const [sessionExercises, setSessionExercises] = useState([]);
    const [allExercises, setAllExercises] = useState([]); 
    const [selectedExerciseId, setSelectedExerciseId] = useState("");
    const [isTemplate, setIsTemplate] = useState(false);
    
    // UI State
    const [showSummary, setShowSummary] = useState(false);

    // 1. Initial Data Load
    useEffect(() => {
        // Fetch Session Meta
        fetch(`/api/v1/workoutSessions/${id}`)
            .then(res => res.json())
            .then(data => {
                setSession(data);
                setIsTemplate(data.is_template || false);
            })
            .catch(err => console.error("Session Fetch Error:", err));

        // Fetch Exercise Menu
        fetch('/api/v1/exercises')
            .then(res => res.json())
            .then(data => setAllExercises(data))
            .catch(err => console.error("Menu Fetch Error:", err));
            
        // Fetch Existing Logs
        fetch(`/api/v1/exerciseLog?workout_sessions_id=${id}`)
        .then(res => res.json())
        .then(data => {
            console.log("Fetched Logs:", data); // DEBUG: Check if 'sets' is an array here
            setSessionExercises(Array.isArray(data) ? data : []);
        })
        .catch(err => console.error("Log Fetch Error:", err));
    }, [id]);

    // 2. Add New Movement
    const handleAddExercise = async (e) => {
        e.preventDefault();
        if (!selectedExerciseId) return alert("Pick an exercise!");

        try {
            const response = await fetch('/api/v1/exerciseLog', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workout_sessions_id: parseInt(id),
                    exercise_id: parseInt(selectedExerciseId),
                    sets: [] // Empty array for our JSONB column
                }),
            });

            if (response.ok) {
                const newLogEntry = await response.json();
                const details = allExercises.find(ex => ex.id === parseInt(selectedExerciseId));

                setSessionExercises(prev => [...prev, {
                    ...newLogEntry,
                    name: details?.name || "Unknown",
                    body_part: details?.body_part || "N/A"
                }]);
                setSelectedExerciseId(""); 
            }
        } catch (err) {
            console.error("Add Error:", err);
        }
    };

    // 3. Delete Movement
    const handleDeleteExercise = async (logId) => {
        try {
            const response = await fetch(`/api/v1/exerciseLog/${logId}`, { method: 'DELETE' });
            if (response.ok) {
                setSessionExercises(prev => prev.filter(ex => ex.id !== logId));
            }
        } catch (err) {
            console.error("Delete Error:", err);
        }
    };

    // 4. Finish Session & Show Modal
    const handleFinishWorkout = async () => {
    try {
        // Send the final session status to the backend
        await fetch(`/api/v1/workoutSessions/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                is_template: isTemplate,
                end_time: new Date().toISOString()
            }),
        });

        // Trigger the Summary Modal
        setShowSummary(true);
    } catch (err) {
        console.error("Finish Error:", err);
        setShowSummary(true); // Show modal even on error so user isn't stuck
    }
};

    if (!session) return <div>Loading Session...</div>;

    return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', position: 'relative' }}>
            <h1>{session.name}</h1>
            <p style={{ color: '#888' }}>ID: {id}</p>
            <hr />

            {/* Add Exercise UI */}
            <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#f4f4f4', borderRadius: '8px' }}>
                <h3>Add Movement</h3>
                <select 
                    value={selectedExerciseId} 
                    onChange={(e) => setSelectedExerciseId(e.target.value)}
                    style={{ padding: '8px', borderRadius: '4px' }}
                >
                    <option value="">-- Select --</option>
                    {allExercises?.map((ex) => (
                        <option key={ex.id} value={ex.id}>{ex.name}</option>
                    ))}
                </select>
                <button onClick={handleAddExercise} style={{ marginLeft: '10px', padding: '8px 15px', cursor: 'pointer' }}>Add</button>
            </div>

            {/* List of Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {sessionExercises.map((log) => (
                    <LogExercise key={log.id} log={log} onDelete={handleDeleteExercise} />
                ))}
            </div>

            {/* Finish Section */}
            <div style={finishAreaStyle}>
                <h3>Finish Workout</h3>
                <label style={checkboxLabelStyle}>
                    <input type="checkbox" checked={isTemplate} onChange={(e) => setIsTemplate(e.target.checked)} />
                    Save as template?
                </label>
                <button onClick={handleFinishWorkout} style={finishBtnStyle}>Finish & Save</button>
            </div>

           {/* SUMMARY MODAL - REPLICATED STYLE */}
{showSummary && (
    <div style={overlayStyle}>
        <div style={summaryCardStyle}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div style={{ fontSize: '2.5rem' }}>⭐</div>
                <h1 style={{ margin: '5px 0', fontSize: '1.8rem', color: '#000' }}>Well Done!</h1>
                <p style={{ color: '#666', margin: 0 }}>That's another workout smashed!</p>
            </div>

            <div style={innerCardStyle}>
                <h2 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', color: '#000' }}>{session.name}</h2>
                <p style={{ color: '#999', fontSize: '0.85rem', marginBottom: '15px' }}>
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' })}
                </p>

                {/* Stats Header: Duration | Total Volume | PR Count */}
                <div style={statsRowStyle}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.2rem' }}>⏱️</div>
                        <span style={{ fontWeight: 'bold' }}>16m</span>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.2rem' }}>⚖️</div>
                        <span style={{ fontWeight: 'bold' }}>
                            {sessionExercises.reduce((total, ex) => {
                                // Safe parse sets for the volume calculation too
                                let sArr = [];
                                try {
                                    sArr = typeof ex.sets === 'string' ? JSON.parse(ex.sets) : (ex.sets || []);
                                } catch(e) { sArr = []; }
                                
                                return total + (sArr.reduce((sT, s) => sT + (Number(s.weight) * Number(s.reps) || 0), 0) || 0)
                            }, 0)} kg
                        </span>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.2rem' }}>🏆</div>
                        <span style={{ fontWeight: 'bold' }}>0 PRs</span>
                    </div>
                </div>

                <div style={listHeaderStyle}>
                    <span>EXERCISE</span>
                    <span>BEST SET</span>
                </div>

                <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                    {sessionExercises.map((ex, i) => {
                        // 1. SAFE PARSE: Ensure sets is an array for rendering
                        let setsArray = [];
                        try {
                            setsArray = typeof ex.sets === 'string' ? JSON.parse(ex.sets) : (ex.sets || []);
                        } catch (e) {
                            setsArray = [];
                        }

                        const setVolume = setsArray.length;

                        const bestSet = setsArray.reduce((prev, curr) => 
                            (Number(curr.weight) > Number(prev.weight)) ? curr : prev, 
                            { weight: 0, reps: 0 }
                        );

                        return (
                            <div key={i} style={exerciseRowStyle}>
                                <span style={{ color: '#444', fontWeight: '500' }}>
                                    {setVolume} × {ex.name || 'Unknown Exercise'}
                                </span>
                                <span style={{ fontWeight: 'bold', color: '#000' }}>
                                    {bestSet?.weight || 0}kg × {bestSet?.reps || 0}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <button onClick={() => navigate('/dashboard')} style={closeBtnStyle}>
                Done
            </button>
        </div>
    </div>
)}
        </div>
    );
};

// Styles
const overlayStyle = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(255, 255, 255, 0.98)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 };
const summaryCardStyle = { width: '90%', maxWidth: '400px', textAlign: 'center' };
const innerCardStyle = { backgroundColor: '#fff', borderRadius: '16px', padding: '20px', textAlign: 'left', border: '1px solid #eee', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', marginBottom: '20px' };
const statsRowStyle = { display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#555', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #f5f5f5' };
const listHeaderStyle = { display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#bbb', fontWeight: 'bold', marginBottom: '10px', letterSpacing: '0.5px' };
const exerciseRowStyle = { display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', padding: '6px 0', borderBottom: '1px solid #fafafa' };
const finishAreaStyle = { marginTop: '50px', padding: '30px', borderTop: '2px solid #ddd', textAlign: 'center' };
const finishBtnStyle = { width: '100%', padding: '12px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' };
const checkboxLabelStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '20px' };
const closeBtnStyle = { background: 'none', border: 'none', color: '#007bff', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' };
export default WorkoutSession;