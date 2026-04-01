import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; // 1. Import useNavigate
import ExerciseItem from "./ExerciseItem"; 
import AddExerciseModal from "./AddExerciseModal"; 

const ExerciseList = () => {
  const navigate = useNavigate();
  const [exercises, setExercises] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetch('/api/v1/exercises')
      .then(res => res.json())
      .then(data => setExercises(Array.isArray(data) ? data : []));
  }, []);

  // --- ADD THESE BACK IN ---
  const addExerciseToState = (response) => {
    const newExercise = response?.exercises?.[0] || response;
    if (newExercise && (newExercise.name || newExercise.body_part)) {
      setExercises((prevExercises) => [...prevExercises, newExercise]);
      setShowAddModal(false);
    }
  };

  const deleteExerciseFromState = (idToDelete) => {
    setExercises(exercises.filter((ex) => ex.id !== idToDelete));
  };

  const updateExerciseInState = (updatedExercise) => {
    setExercises(exercises.map((ex) => (ex.id === updatedExercise.id ? updatedExercise : ex)));
  };
  // -------------------------

  const filteredExercises = [...exercises]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((ex) => ex.name.toLowerCase().includes(searchTerm.toLowerCase()));
  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        {/* --- 3. THE NEW TOP ROW WITH THE X BUTTON --- */}
        <div style={navRow}>
          <button onClick={() => navigate(-1)} style={backBtnStyle}>✕</button>
          <span style={blueLink} onClick={() => setShowAddModal(true)}>New</span>
        </div>

        <div style={topRow}>
          <h1 style={titleStyle}>Exercises</h1>
        </div>
        
        <div style={searchContainer}>
          <span style={searchIcon}>🔍</span>
          <input 
            style={searchInputStyle}
            onChange={(e) => setSearchTerm(e.target.value)} 
            placeholder="Search" 
          />
        </div>
      </header>
      
      <div style={listStyle}>
        {filteredExercises.map((ex, index) => {
          const firstLetter = ex.name.charAt(0).toUpperCase();
          const prevLetter = filteredExercises[index - 1]?.name.charAt(0).toUpperCase();
          const showHeader = firstLetter !== prevLetter;

          return (
            <div key={ex.id}>
              {showHeader && <div style={alphaHeaderStyle}>{firstLetter}</div>}
              <div style={itemRowStyle}>
                <div style={iconStyle}>{firstLetter}</div>
                <div style={{ flex: 1 }}>
                  <ExerciseItem 
                    {...ex} 
                    onDelete={deleteExerciseFromState} 
                    onUpdate={updateExerciseInState} 
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showAddModal && (
        <AddExerciseModal 
          onAddExercise={addExerciseToState} 
          onClose={() => setShowAddModal(false)} 
        />
      )}
    </div>
  );
};
// --- STYLES (Ensure these are all present) ---
const containerStyle = { backgroundColor: "#f2f2f7", minHeight: "100vh", padding: "0 16px", fontFamily: '-apple-system, sans-serif' };
const headerStyle = { position: "sticky", top: 0, backgroundColor: "#f2f2f7", padding: "10px 0", zIndex: 10 };

const navRow = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" };
const backBtnStyle = { background: "none", border: "none", fontSize: "1.5rem", color: "#8e8e93", cursor: "pointer", padding: "5px 0" };

const topRow = { marginBottom: "15px" };
const titleStyle = { fontSize: "2.2rem", fontWeight: "800", margin: 0, letterSpacing: "-1px" };
const blueLink = { color: "#007aff", fontSize: "1.1rem", fontWeight: "600", cursor: "pointer" };

const searchContainer = { position: "relative", marginBottom: "15px" };
const searchIcon = { position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#8e8e93" };
const searchInputStyle = { width: "100%", padding: "12px 35px", borderRadius: "12px", border: "none", backgroundColor: "#e3e3e8", fontSize: "1rem", outline: "none" };

// THIS WAS LIKELY MISSING:
const listStyle = { paddingBottom: "100px" }; 

const alphaHeaderStyle = { padding: "15px 0 8px 0", color: "#8e8e93", fontWeight: "600", fontSize: "0.85rem", borderBottom: "0.5px solid #d1d1d6" };
const itemRowStyle = { display: "flex", alignItems: "center", gap: "15px", backgroundColor: "#fff", padding: "12px 16px", borderBottom: "0.5px solid #f2f2f7" };
const iconStyle = { width: "42px", height: "42px", backgroundColor: "#f2f2f7", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", color: "#8e8e93" };
// ... (keep the rest of your styles)
export default ExerciseList;