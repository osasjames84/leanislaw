import React, { useState } from "react";

const ExercisePickerModal = ({ onClose, onConfirm, allExercises }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedIds, setSelectedIds] = useState([]);

  // Extract unique categories from your exercise list
  const categories = ["All", ...new Set(allExercises.map(ex => ex.body_part))];

  const toggleSelection = (rawId) => {
    const id = Number(rawId);
    if (!Number.isFinite(id)) return;
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const filteredExercises = allExercises
    .filter(ex => selectedCategory === "All" || ex.body_part === selectedCategory)
    .filter(ex => ex.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        {/* --- HEADER --- */}
        <header style={modalHeader}>
          <button onClick={onClose} style={closeBtn}>Cancel</button>
          <h2 style={modalTitle}>Add Movement</h2>
          <button 
            onClick={() => onConfirm(selectedIds)} 
            style={selectedIds.length > 0 ? confirmBtnActive : confirmBtnDisabled}
            disabled={selectedIds.length === 0}
          >
            Add ({selectedIds.length})
          </button>
        </header>

        {/* --- SEARCH & CATEGORY FILTERS --- */}
        <div style={filterSection}>
          <div style={searchWrapper}>
            <span style={searchIcon}>🔍</span>
            <input 
              style={searchInput} 
              placeholder="Search exercises..." 
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div style={categoryScroll}>
            {categories.map(cat => (
              <button 
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={selectedCategory === cat ? catBtnActive : catBtn}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* --- EXERCISE LIST --- */}
        <div style={scrollArea}>
          {filteredExercises.map((ex) => {
            const exId = Number(ex.id);
            const isSelected = selectedIds.includes(exId);
            const firstLetter = ex.name.charAt(0).toUpperCase();

            return (
              <div 
                key={ex.id} 
                onClick={() => toggleSelection(exId)}
                style={isSelected ? rowSelected : rowStyle}
              >
                <div style={leftSide}>
                  {/* Visual Placeholder for Exercise Image */}
                  <div style={iconBox}>{firstLetter}</div>
                  <div style={textContainer}>
                    <span style={exName}>{ex.name}</span>
                    <span style={exSub}>{ex.body_part}</span>
                  </div>
                </div>
                
                <div style={isSelected ? checkActive : checkInactive}>
                  {isSelected && "✓"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// --- STYLES (aligned with WorkoutHub) ---
const overlayStyle = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    zIndex: 3500,
    display: "flex",
    alignItems: "flex-end",
};
const modalStyle = {
    backgroundColor: "#f2f2f7",
    width: "100%",
    height: "90vh",
    borderTopLeftRadius: "20px",
    borderTopRightRadius: "20px",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
};

const modalHeader = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "15px 20px",
    backgroundColor: "#fff",
    borderBottom: "0.5px solid #d1d1d6",
};
const closeBtn = { background: "none", border: "none", color: "#007aff", fontSize: "1rem", fontWeight: "600", cursor: "pointer" };
const modalTitle = { margin: 0, fontSize: "1.1rem", fontWeight: "700", color: "#000" };
const confirmBtnActive = { border: "none", backgroundColor: "transparent", color: "#007aff", fontWeight: "700", fontSize: "1rem", cursor: "pointer" };
const confirmBtnDisabled = { ...confirmBtnActive, color: "#c7c7cc", cursor: "default" };

const filterSection = { padding: "15px 20px", backgroundColor: "#fff", borderBottom: "0.5px solid #d1d1d6" };
const searchWrapper = { position: "relative", marginBottom: "12px" };
const searchIcon = { position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#8e8e93" };
const searchInput = {
    width: "100%",
    padding: "10px 10px 10px 35px",
    borderRadius: "10px",
    border: "none",
    backgroundColor: "#e3e3e8",
    fontSize: "0.95rem",
    outline: "none",
};

const categoryScroll = { display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "5px" };
const catBtn = {
    padding: "6px 15px",
    borderRadius: "20px",
    border: "none",
    backgroundColor: "#e3e3e8",
    color: "#8e8e93",
    fontSize: "0.85rem",
    fontWeight: "600",
    cursor: "pointer",
    whiteSpace: "nowrap",
};
const catBtnActive = { ...catBtn, backgroundColor: "#007aff", color: "#fff" };

const scrollArea = { flex: 1, overflowY: "auto" };
const rowStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 20px",
    backgroundColor: "#fff",
    borderBottom: "0.5px solid #f2f2f7",
    cursor: "pointer",
};
const rowSelected = { ...rowStyle, backgroundColor: "#f2f8ff" };

const leftSide = { display: "flex", alignItems: "center", gap: "15px" };
const iconBox = {
    width: "45px",
    height: "45px",
    backgroundColor: "#f2f2f7",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "800",
    color: "#007aff",
    fontSize: "1.2rem",
};
const textContainer = { display: "flex", flexDirection: "column" };
const exName = { fontSize: "1rem", fontWeight: "600", color: "#000" };
const exSub = { fontSize: "0.8rem", color: "#8e8e93", textTransform: "capitalize" };

const checkActive = {
    width: "24px",
    height: "24px",
    borderRadius: "50%",
    backgroundColor: "#007aff",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.8rem",
};
const checkInactive = { width: "24px", height: "24px", borderRadius: "50%", border: "2px solid #d1d1d6" };

export default ExercisePickerModal;