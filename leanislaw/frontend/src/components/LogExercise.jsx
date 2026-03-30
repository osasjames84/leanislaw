import { useState } from "react";

const LogExercise = ({ log, onDelete }) => {
    const [sets, setSets] = useState(log.sets || [{ weight: "", reps: "", rpe: "" }]);

    const handleAddSet = () => {
        // We don't need to calculate IDs anymore, just push a new object
        setSets([...sets, { weight: "", reps: "", rpe: "" }]);
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

    const handleSaveExercise = async () => {
        try {
            const response = await fetch(`/api/v1/exerciseLog/${log.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sets: sets }),
            });
            if (response.ok) alert("Workout Progress Saved!");
        } catch (err) {
            console.error("Save error:", err);
        }
    };

    return (
        <div style={containerStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <h4 style={{ margin: 0 }}>{log.name}</h4>
                <button onClick={() => onDelete(log.id)} style={removeExBtn}>Remove Exercise</button>
            </div>

            {/* Grid Header */}
            <div style={gridHeaderStyle}>
                <div>SET</div>
                <div>WEIGHT</div>
                <div>REPS</div>
                <div>RPE</div>
                <div></div>
            </div>

            {/* Set Rows */}
            {sets.map((set, index) => (
                <div key={index} style={gridRowStyle}>
                    {/* DISPLAY LOGIC: 
                        We use index + 1 so that if you delete set 2, 
                        set 3 automatically becomes the new set 2.
                    */}
                    <div style={{ textAlign: 'center', fontWeight: 'bold' }}>{index + 1}</div>
                    
                    <input 
                        type="number" 
                        value={set.weight} 
                        onChange={(e) => updateSetData(index, 'weight', e.target.value)} 
                        placeholder="kg" 
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
                    
                    <button 
                        onClick={() => removeSet(index)}
                        style={deleteSetBtn}
                    >
                        &times;
                    </button>
                </div>
            ))}

            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button onClick={handleAddSet} style={btnSecondary}>+ Set</button>
                <button onClick={handleSaveExercise} style={btnPrimary}>Save Progress</button>
            </div>
        </div>
    );
};

// Styles
const containerStyle = { border: '1px solid #ddd', borderRadius: '8px', padding: '12px', marginBottom: '15px', backgroundColor: '#fff', maxWidth: '550px', boxSizing: 'border-box' };
const gridHeaderStyle = { display: 'grid', gridTemplateColumns: '40px 1.5fr 1fr 1fr 40px', gap: '8px', marginBottom: '8px', fontWeight: 'bold', fontSize: '0.7rem', color: '#888', textAlign: 'center' };
const gridRowStyle = { display: 'grid', gridTemplateColumns: '40px 1.5fr 1fr 1fr 40px', gap: '8px', marginBottom: '6px', alignItems: 'center' };
const inputStyle = { width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '0.9rem', boxSizing: 'border-box' };
const removeExBtn = { color: '#ff4d4d', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem' };
const deleteSetBtn = { background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: '1.2rem' };
const btnPrimary = { flex: 1, padding: '8px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' };
const btnSecondary = { flex: 1, padding: '8px', backgroundColor: '#f8f9fa', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' };

export default LogExercise;