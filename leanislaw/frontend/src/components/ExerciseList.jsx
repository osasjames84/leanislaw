import { useState, useEffect } from "react";
import ExerciseItem from "./ExerciseItem"; 
import AddExerciseForm from "./AddExerciseForm";
import AddExerciseModal from "./AddExerciseModal"; // Import the new modal

const ExerciseList = () => {
  const [exercises, setExercises] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  // 1. Modal State
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetch('/api/v1/exercises')
      .then(res => res.json())
      .then(data => setExercises(Array.isArray(data) ? data : []));
  }, []);

  const addExerciseToState = (response) => {
    const newExercise = response?.exercises?.[0] || response;
    if (newExercise && (newExercise.name || newExercise.body_part)) {
      setExercises((prevExercises) => [...prevExercises, newExercise]);
      setShowAddModal(false); // 2. Close modal after adding
    }
  };

  const deleteExerciseFromState = (idToDelete) => {
    setExercises(exercises.filter((ex) => ex.id !== idToDelete));
  };

  const updateExerciseInState = (updatedExercise) => {
    setExercises(exercises.map((ex) => (ex.id === updatedExercise.id ? updatedExercise : ex)));
  };

  const filteredExercises = [...exercises]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((ex) => ex.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <div style={topRow}>
          <h1 style={titleStyle}>Exercises</h1>
          {/* 3. Link "New" to open modal */}
          <span style={blueLink} onClick={() => setShowAddModal(true)}>New</span>
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

      {/* 4. The Add Exercise Modal Overlay */}
      {showAddModal && (
  <AddExerciseModal 
    onAddExercise={addExerciseToState} 
    onClose={() => setShowAddModal(false)} 
  />
)}
      
    </div>
  );
};

// --- STYLES ---
const containerStyle = { backgroundColor: "#f2f2f7", minHeight: "100vh", padding: "0 16px", fontFamily: '-apple-system, sans-serif' };
const headerStyle = { position: "sticky", top: 0, backgroundColor: "#f2f2f7", padding: "20px 0 10px 0", zIndex: 10 };
const topRow = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" };
const titleStyle = { fontSize: "2rem", fontWeight: "800", margin: 0 };
const blueLink = { color: "#007aff", fontSize: "1rem", fontWeight: "600", cursor: "pointer" };

const searchContainer = { position: "relative", marginBottom: "15px" };
const searchIcon = { position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#8e8e93" };
const searchInputStyle = { width: "100%", padding: "10px 35px", borderRadius: "10px", border: "none", backgroundColor: "#e3e3e8", fontSize: "1rem", outline: "none" };

const alphaHeaderStyle = { padding: "15px 0 8px 0", color: "#8e8e93", fontWeight: "600", fontSize: "0.85rem", borderBottom: "0.5px solid #d1d1d6" };
const itemRowStyle = { display: "flex", alignItems: "center", gap: "15px", backgroundColor: "#fff", padding: "12px 16px", borderBottom: "0.5px solid #f2f2f7" };
const iconStyle = { width: "42px", height: "42px", backgroundColor: "#f2f2f7", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", color: "#8e8e93" };
const listStyle = { paddingBottom: "100px" };

// Modal Styles
const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalContentStyle = { backgroundColor: '#fff', width: '90%', maxWidth: '400px', borderRadius: '20px', padding: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' };
const modalHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' };
const closeBtnStyle = { background: 'none', border: 'none', fontSize: '1.2rem', color: '#8e8e93', cursor: 'pointer' };

export default ExerciseList;