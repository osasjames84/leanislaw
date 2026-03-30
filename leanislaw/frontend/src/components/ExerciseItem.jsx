import { useState } from "react";

const ExerciseItem = ({ id, name, body_part, onDelete, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({ name: name, body_part: body_part });

    const handleDelete = async () => {
        const response = await fetch(`/api/v1/exercises/${id}`, {
            method: 'DELETE',
        });
        
        if (response.ok) {
            onDelete(id);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const response = await fetch(`/api/v1/exercises/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editData)
        });
        
        if (response.ok) {
            const data = await response.json();
            onUpdate(data);
            setIsEditing(false);
        }
    };

    return (
        <div style={itemInnerContainer}>
            {isEditing ? (
                /* --- EDIT MODE --- */
                <form onSubmit={handleSave} style={editFormStyle}>
                    <input 
                        style={inputStyle}
                        value={editData.name}
                        onChange={(e) => setEditData({ ...editData, name: e.target.value })} 
                    />
                    <select 
                        style={selectStyle}
                        value={editData.body_part} 
                        onChange={(e) => setEditData({ ...editData, body_part: e.target.value })}
                    >
                        <option value="chest">Chest</option>
                        <option value="back">Back</option>
                        <option value="legs">Legs</option>
                        <option value="triceps">Triceps</option>
                        <option value="biceps">Biceps</option>
                        <option value="shoulders">Shoulders</option>
                        <option value="abs">Abs</option>
                    </select>
                    <div style={buttonGroup}>
                        <button type="submit" style={saveBtn}>Save</button>
                        <button type="button" onClick={() => setIsEditing(false)} style={cancelBtn}>Cancel</button>
                    </div>
                </form>
            ) : (
                /* --- VIEW MODE (Clean & Sleek) --- */
                <>
                    <div style={textWrapper}>
                        <div style={nameStyle}>{name}</div>
                        <div style={bodyPartStyle}>{body_part}</div>
                    </div>
                    <div style={buttonGroup}>
                        <button onClick={() => setIsEditing(true)} style={actionBtn}>Edit</button>
                        <button onClick={handleDelete} style={deleteBtn}>Delete</button>
                    </div>
                </>
            )}
        </div>
    );
};

// --- STYLES ---
const itemInnerContainer = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
};

const textWrapper = {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
};

const nameStyle = {
    fontSize: "1rem",
    fontWeight: "600",
    color: "#000",
};

const bodyPartStyle = {
    fontSize: "0.85rem",
    color: "#8e8e93", // iOS secondary label color
    textTransform: "capitalize",
};

const buttonGroup = {
    display: "flex",
    gap: "12px",
};

const actionBtn = { background: "none", border: "none", color: "#007aff", fontWeight: "500", cursor: "pointer", fontSize: "0.9rem" };
const deleteBtn = { ...actionBtn, color: "#ff3b30" }; // iOS Red
const saveBtn = { ...actionBtn, fontWeight: "700" };
const cancelBtn = { ...actionBtn, color: "#8e8e93" };

const editFormStyle = { display: "flex", flexDirection: "column", gap: "8px", width: "100%" };
const inputStyle = { padding: "8px", borderRadius: "6px", border: "1px solid #d1d1d6", fontSize: "0.9rem" };
const selectStyle = { ...inputStyle, backgroundColor: "#fff" };

export default ExerciseItem;