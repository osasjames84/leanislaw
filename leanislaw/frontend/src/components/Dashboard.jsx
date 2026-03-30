import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
// Ensure you have your enhanced photo saved in your assets folder!
import CreatorPhoto from "../assets/creator_photo.png"; 

const Dashboard = () => {
  const [templates, setTemplates] = useState([]);
  const [history, setHistory] = useState([]);
  
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateExercises, setTemplateExercises] = useState([]);
  const [showPreview, setShowPreview] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/v1/workoutSessions?is_template=true')
      .then(res => res.json())
      .then(data => setTemplates(Array.isArray(data) ? data : []))
      .catch(() => setTemplates([]));

    fetch('/api/v1/workoutSessions?is_template=false')
      .then(res => res.json())
      .then(data => setHistory(Array.isArray(data) ? data : []))
      .catch(() => setHistory([]));
  }, []);

  const handleOpenPreview = async (template) => {
    setSelectedTemplate(template);
    setShowPreview(true);
    try {
      const res = await fetch(`/api/v1/workoutSessions/${template.id}/exerciseLogs`);
      const data = await res.json();
      setTemplateExercises(data);
    } catch (err) {
      console.error("Preview load error:", err);
    }
  };

  return (
    <div style={containerStyle}>
      {/* --- SLEEK HEADER WITH CREATOR PHOTO --- */}
      <header style={dashboardHeaderStyle}>
        <h1 style={dashboardTitleStyle}>Lean is Law</h1>
        
        {/* Clickable Profile Avatar */}
        <div style={logoWrapper} onClick={() => navigate("/about")}>
            <img 
              src={CreatorPhoto} 
              alt="The Creator" 
              style={dashboardLogoStyle} 
            />
        </div>
      </header>

      <div style={{ padding: '0 20px' }}>
        {/* --- ACTION BUTTONS --- */}
        <div style={{ margin: '25px 0', display: 'flex', gap: '10px' }}>
          <Link to="/exercises" style={{ flex: 1, textDecoration: 'none' }}>
            <button style={btnStyle}>Browse Exercises</button>
          </Link>
          <Link to="/workoutSessions" style={{ flex: 1, textDecoration: 'none' }}>
            <button style={{ ...btnStyle, backgroundColor: '#007aff', color: 'white', border: 'none' }}>Empty Workout</button>
          </Link>
        </div>

        {/* Templates Section */}
        <section style={{ marginBottom: '40px' }}>
          <h2 style={sectionHeaderStyle}>My Templates</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            {templates.map(temp => (
              <div key={temp.id} onClick={() => handleOpenPreview(temp)} style={cardStyle}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700' }}>{temp.name}</h3>
                <span style={{ color: '#007aff', fontSize: '0.8rem', fontWeight: '500' }}>View Details</span>
              </div>
            ))}
          </div>
        </section>

        {/* History Section */}
        <section>
          <h2 style={sectionHeaderStyle}>Recent History</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {history.map(log => (
              <div key={log.id} style={historyItemStyle}>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '1rem' }}>{log.name}</div>
                  <div style={{ fontSize: '0.85rem', color: '#8e8e93' }}>{new Date(log.date).toLocaleDateString()}</div>
                </div>
                <button onClick={() => navigate(`/workout/${log.id}`)} style={viewBtnStyle}>View</button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <TemplatePreviewModal 
          template={selectedTemplate} 
          exercises={templateExercises} 
          onClose={() => setShowPreview(false)}
          onStart={(id) => navigate(`/workout/${id}`)}
        />
      )}
    </div>
  );
};

// --- MODAL COMPONENT ---
const TemplatePreviewModal = ({ template, exercises, onClose, onStart }) => {
  if (!template) return null;
  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#007aff', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800' }}>{template.name}</h2>
          <span style={{ color: '#007aff', fontWeight: 'bold', cursor: 'pointer' }}>Edit</span>
        </div>

        <div style={{ marginBottom: '20px', maxHeight: '300px', overflowY: 'auto' }}>
          <p style={{ color: '#8e8e93', fontSize: '0.7rem', letterSpacing: '1px', marginBottom: '10px', fontWeight: '700' }}>EXERCISES</p>
          {exercises.map((ex, i) => (
            <div key={i} style={exerciseRowStyle}>
               <div style={iconBox}>{ex.exerciseName ? ex.exerciseName.charAt(0) : (ex.name ? ex.name.charAt(0) : '?')}</div>
               <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{ex.exerciseName || ex.name || "Unknown"}</div>
                  <div style={{ fontSize: '0.8rem', color: '#8e8e93', textTransform: 'capitalize' }}>{ex.body_part || 'Strength'}</div>
               </div>
            </div>
          ))}
        </div>
        <button onClick={() => onStart(template.id)} style={startButtonStyle}>Start Workout</button>
      </div>
    </div>
  );
};

// --- STYLES ---
const containerStyle = { backgroundColor: '#f2f2f7', minHeight: '100vh', paddingBottom: '40px', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' };

const dashboardHeaderStyle = { 
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
  padding: '20px', backgroundColor: '#fff', borderBottom: '0.5px solid #d1d1d6',
  position: 'sticky', top: 0, zIndex: 10
};

const dashboardTitleStyle = { margin: 0, fontSize: '1.4rem', fontWeight: '900', color: '#000', letterSpacing: '-0.5px' };

const logoWrapper = { 
  width: '42px', height: '42px', borderRadius: '50%', border: '2px solid #007aff', 
  overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  backgroundColor: '#eee'
};

const dashboardLogoStyle = { width: '100%', height: '100%', objectFit: 'cover' };

const btnStyle = { width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #d1d1d6', backgroundColor: '#fff', cursor: 'pointer', fontWeight: '700', fontSize: '0.95rem' };
const sectionHeaderStyle = { fontSize: '1.1rem', fontWeight: '800', marginBottom: '15px', color: '#000' };
const cardStyle = { padding: '20px', backgroundColor: '#fff', borderRadius: '15px', border: 'none', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' };
const historyItemStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#fff', borderRadius: '12px', marginBottom: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' };
const viewBtnStyle = { background: 'none', border: 'none', color: '#007aff', fontWeight: '600', cursor: 'pointer' };

const overlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalStyle = { backgroundColor: '#1c1c1e', color: 'white', width: '90%', maxWidth: '400px', borderRadius: '25px', padding: '25px' };
const exerciseRowStyle = { display: 'flex', alignItems: 'center', gap: '15px', padding: '12px 0', borderBottom: '0.5px solid #333' };
const iconBox = { width: '38px', height: '38px', backgroundColor: '#3a3a3c', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#007aff' };
const startButtonStyle = { width: '100%', padding: '16px', borderRadius: '14px', backgroundColor: '#007aff', color: 'white', border: 'none', fontWeight: 'bold', fontSize: '1rem', marginTop: '15px', cursor: 'pointer' };

export default Dashboard;