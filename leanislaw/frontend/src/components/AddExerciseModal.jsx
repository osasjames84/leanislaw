import React, { useState } from "react";

const AddExerciseModal = ({ onAddExercise, onClose }) => {
  const [name, setName] = useState("");
  const [bodyPart, setBodyPart] = useState("chest"); // Default to one of your enum values

  // Your specific pgEnum categories
  const muscleGroups = ['biceps', 'triceps', 'chest', 'back', 'legs', 'abs', 'shoulders'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newExercise = { name: name.trim(), body_part: bodyPart };

    try {
      const response = await fetch("/api/v1/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newExercise),
      });

      if (response.ok) {
        const data = await response.json();
        onAddExercise(data);
        onClose(); // Close modal on success
      }
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <button onClick={onClose} style={closeIconStyle}>✕</button>
          <h2 style={modalTitleStyle}>New Exercise</h2>
          <button 
            type="submit" 
            form="addExerciseForm"
            style={{ ...saveButtonStyle, opacity: name ? 1 : 0.4 }}
            disabled={!name}
          >
            Save
          </button>
        </div>

        <form id="addExerciseForm" onSubmit={handleSubmit} style={{ padding: "0 20px" }}>
          <div style={inputGroup}>
            <label style={labelStyle}>NAME</label>
            <input
              style={sleekInputStyle}
              type="text"
              value={name}
              placeholder="Exercise Name"
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div style={inputGroup}>
            <label style={labelStyle}>BODY PART</label>
            <div style={chipContainer}>
              {muscleGroups.map((group) => {
                const isSelected = bodyPart === group;
                return (
                  <button
                    key={group}
                    type="button"
                    onClick={() => setBodyPart(group)}
                    style={isSelected ? selectedChipStyle : unselectedChipStyle}
                  >
                    {group}
                  </button>
                );
              })}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- STYLES ---
const overlayStyle = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 };
const modalStyle = { backgroundColor: "#fff", width: "92%", maxWidth: "400px", borderRadius: "20px", paddingBottom: "30px", fontFamily: '-apple-system, sans-serif' };
const headerStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 20px", borderBottom: "0.5px solid #d1d1d6", marginBottom: "20px" };
const closeIconStyle = { background: "none", border: "none", color: "#007aff", fontSize: "1.2rem", cursor: "pointer" };
const modalTitleStyle = { margin: 0, fontSize: "1rem", fontWeight: "700" };
const saveButtonStyle = { background: "none", border: "none", color: "#007aff", fontWeight: "700", fontSize: "1rem", cursor: "pointer" };
const inputGroup = { marginBottom: "25px" };
const labelStyle = { display: "block", color: "#8e8e93", fontSize: "0.75rem", marginBottom: "8px", fontWeight: "600", letterSpacing: "0.5px" };
const sleekInputStyle = { width: "100%", padding: "10px 0", fontSize: "1.2rem", border: "none", borderBottom: "1px solid #e5e5ea", outline: "none", fontWeight: "500" };
const chipContainer = { display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "10px" };
const baseChip = { padding: "10px 18px", borderRadius: "12px", border: "none", fontSize: "0.9rem", cursor: "pointer", textTransform: "capitalize" };
const unselectedChipStyle = { ...baseChip, backgroundColor: "#f2f2f7", color: "#3a3a3c" };
const selectedChipStyle = { ...baseChip, backgroundColor: "#007aff", color: "#fff", fontWeight: "600" };

export default AddExerciseModal;