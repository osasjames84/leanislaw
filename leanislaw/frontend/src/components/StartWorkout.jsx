import { useState } from "react";
import { useNavigate } from "react-router-dom";

const StartWorkout = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ name: "", user_id: "" });

    const handleUpload = async (e) => {
        e.preventDefault();
        const response = await fetch(`/api/v1/workoutSessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            const data = await response.json();
            navigate(`/workoutSessions/${data.id}`);
        } else {
            const errorData = await response.json();
            console.error("Server Error:", errorData);
            alert(`Error: ${errorData.error}`);
        }
    };

    return (
        <div style={pageContainer}>
            <header style={headerStyle}>
                {/* Both the X and the Cancel button now go back */}
                <div onClick={() => navigate(-1)} style={backBtn}>✕</div>
                <h1 style={headerTitle}>Initiate Session</h1>
                <div style={rankBadge}>Sub Human</div>
            </header>

            <form onSubmit={handleUpload} style={formStyle}>
                <div style={inputSection}>
                    <label style={labelStyle}>WORKOUT NAME</label>
                    <input 
                        style={sleekInput}
                        placeholder="e.g., Heavy Push"
                        value={formData.name} 
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                    />
                </div>

                <div style={inputSection}>
                    <label style={labelStyle}>USER IDENTIFIER</label>
                    <input 
                        style={sleekInput}
                        placeholder="Enter ID"
                        value={formData.user_id} 
                        onChange={(e) => setFormData({ ...formData, user_id: e.target.value })} 
                    />
                </div>

                <div style={footerStyle}>
                    <div style={actionGroup}>
                        <p style={ascendText}>ARE YOU READY TO ASCEND?</p>
                        <button type="submit" style={startBtn}>START WORKOUT</button>
                    </div>

                    <div style={actionGroup}>
                        <p style={sub5Text}>OR REMAIN SUB-5...</p>
                        <button 
                            type="button" 
                            onClick={() => navigate(-1)} // Now matches the 'X' behavior
                            style={cancelBtn}
                        >
                            CANCEL SESSION
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}

// --- STYLES ---
const pageContainer = { backgroundColor: "#f2f2f7", minHeight: "100vh", fontFamily: '-apple-system, sans-serif' };

const headerStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px", backgroundColor: "#fff", borderBottom: "0.5px solid #d1d1d6" };
const backBtn = { fontSize: "1.2rem", color: "#8e8e93", cursor: "pointer", padding: "5px" };
const headerTitle = { fontSize: "1rem", fontWeight: "700", margin: 0 };
const rankBadge = { backgroundColor: "#000", color: "#fff", padding: "4px 10px", borderRadius: "6px", fontSize: "0.7rem", fontWeight: "900" };

const formStyle = { padding: "30px 20px", display: "flex", flexDirection: "column", gap: "25px" };

const inputSection = { display: "flex", flexDirection: "column", gap: "8px" };
const labelStyle = { fontSize: "0.7rem", fontWeight: "800", color: "#8e8e93", letterSpacing: "1px" };
const sleekInput = { padding: "15px 0", fontSize: "1.2rem", border: "none", borderBottom: "2px solid #d1d1d6", backgroundColor: "transparent", outline: "none", fontWeight: "600" };

const footerStyle = { marginTop: "auto", display: "flex", flexDirection: "column", gap: "30px", paddingTop: "40px" };
const actionGroup = { display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" };

const ascendText = { fontSize: "0.75rem", fontWeight: "900", color: "#007aff", margin: 0, letterSpacing: "1px" };
const sub5Text = { fontSize: "0.75rem", fontWeight: "900", color: "#ff3b30", margin: 0, letterSpacing: "1px" };

const startBtn = { width: "100%", padding: "20px", borderRadius: "16px", border: "none", backgroundColor: "#000", color: "#fff", fontWeight: "900", fontSize: "1.1rem", cursor: "pointer", boxShadow: "0 10px 20px rgba(0,0,0,0.15)" };

// Updated Cancel Button - Red border and text to match the "Sub-5" warning
const cancelBtn = { 
    width: "100%", 
    padding: "15px", 
    borderRadius: "16px", 
    border: "2px solid #ff3b30", // Bold Red border
    backgroundColor: "transparent", 
    color: "#ff3b30", // Matching Red text
    fontWeight: "800", 
    fontSize: "0.9rem", 
    cursor: "pointer" 
};

export default StartWorkout;