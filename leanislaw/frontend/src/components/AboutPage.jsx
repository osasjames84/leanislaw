import React from "react";
import { useNavigate } from "react-router-dom";
import CreatorPhoto from "../assets/creator_photo.png"; 

const AboutPage = () => {
  const navigate = useNavigate();

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <button onClick={() => navigate(-1)} style={backBtnStyle}>✕</button>
        <h1 style={headerTitle}>The Architect</h1>
        <div style={{ width: '24px' }}></div> 
      </header>

      <div style={profileCard}>
        <div style={imageWrapper}>
          <img src={CreatorPhoto} alt="The #2 Ranked Chad" style={imageStyle} />
        </div>
        <h2 style={nameStyle}>The #2 Ranked Chad</h2>
        <div style={badgeContainer}>
          <span style={statusBadge}>ASCENDED</span>
          <span style={rankBadge}>ELITE II</span>
        </div>
      </div>

      <div style={manifestoCard}>
        <h3 style={labelStyle}>THE ABSOLUTE DECREE</h3>
        <p style={mainQuoteStyle}>
          "Lean is Law. <br /> 
          Lean is <span style={{ color: '#007aff' }}>Always</span> Law."
        </p>
        
        <div style={divider} />

        <p style={powerfulTextStyle}>
          Life begins at <strong>sub 10% body fat</strong>. 
          Everything else is just existing.
        </p>

        <p style={powerfulTextStyle}>
          To reach the peak, there is only one choice: 
          <strong> ASCEND.</strong>
        </p>
      </div>

      <div style={footerStyle}>
        <p style={footerText}>THE LAW IS ABSOLUTE. THE ASCENT IS MANDATORY.</p>
        <button 
            style={actionBtn} 
            onClick={() => navigate("/workoutSessions")}
        >
            ASCEND
        </button>
      </div>
    </div>
  );
};

// --- ELITE CHAD STYLES ---
const containerStyle = { backgroundColor: "#f2f2f7", minHeight: "100vh", padding: "20px", fontFamily: '-apple-system, sans-serif' };

const headerStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" };
const backBtnStyle = { background: "none", border: "none", fontSize: "1.5rem", color: "#8e8e93", cursor: "pointer" };
const headerTitle = { fontSize: "0.8rem", fontWeight: "800", textTransform: 'uppercase', letterSpacing: '2px', color: '#8e8e93' };

const profileCard = { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "40px" };
const imageWrapper = { width: "180px", height: "180px", borderRadius: "50%", border: "6px solid #fff", overflow: "hidden", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" };
const imageStyle = { width: "100%", height: "100%", objectFit: "cover" };

const nameStyle = { fontSize: "2rem", fontWeight: "900", marginTop: "24px", marginBottom: "12px", letterSpacing: "-1px", color: '#000' };
const badgeContainer = { display: 'flex', gap: '8px' };
const statusBadge = { backgroundColor: "#007aff", color: "#fff", padding: "6px 14px", borderRadius: "8px", fontSize: "0.7rem", fontWeight: "900", letterSpacing: "1px" };
const rankBadge = { backgroundColor: "#000", color: "#fff", padding: "6px 14px", borderRadius: "8px", fontSize: "0.7rem", fontWeight: "900", letterSpacing: "1px" };

const manifestoCard = { backgroundColor: "#fff", padding: "40px 30px", borderRadius: "28px", boxShadow: "0 10px 30px rgba(0,0,0,0.08)", textAlign: 'center', marginBottom: '30px' };
const labelStyle = { fontSize: "0.75rem", fontWeight: "900", color: "#8e8e93", marginBottom: "25px", display: "block", letterSpacing: "2px" };
const mainQuoteStyle = { fontSize: "1.8rem", fontWeight: "900", lineHeight: "1.1", color: "#000", marginBottom: "20px", textTransform: 'uppercase' };
const powerfulTextStyle = { fontSize: "1.2rem", lineHeight: "1.4", color: "#1c1c1e", margin: "15px 0", fontWeight: '500' };

const divider = { height: "2px", backgroundColor: "#f2f2f7", margin: "25px auto", width: "60px" };

const footerStyle = { textAlign: 'center', padding: '0 10px' };
const footerText = { fontSize: '0.65rem', fontWeight: '800', color: '#8e8e93', letterSpacing: '1px', marginBottom: '15px' };
const actionBtn = { width: "100%", padding: "20px", borderRadius: "18px", border: "none", backgroundColor: "#000", color: "#fff", fontWeight: "900", fontSize: "1.1rem", cursor: "pointer", transition: '0.2s', boxShadow: '0 10px 20px rgba(0,0,0,0.2)' };

export default AboutPage;