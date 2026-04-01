import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const StartWorkout = () => {
    const navigate = useNavigate();
    const { token, user } = useAuth();
    const [name, setName] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleUpload = async (e) => {
        e.preventDefault();
        setError("");
        if (!token || !user?.id) {
            setError("You need to be signed in to start a workout.");
            return;
        }
        setSubmitting(true);
        try {
            const response = await fetch(`/api/v1/workoutSessions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    name: name.trim(),
                    is_template: false,
                }),
            });

            const data = await response.json().catch(() => ({}));
            if (response.ok) {
                navigate(`/workout/${data.id}`);
            } else {
                const msg = data.message || data.error || "Could not start workout";
                setError(msg);
            }
        } catch {
            setError("Network error. Try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={pageContainer}>
            <header style={headerStyle}>
                <div onClick={() => navigate(-1)} style={backBtn} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && navigate(-1)}>✕</div>
                <h1 style={headerTitle}>New workout</h1>
                <div style={headerSpacer} />
            </header>

            <div style={contentWrap}>
                {user && (
                    <p style={signedInAs}>
                        Signed in as <strong>{user.first_name}</strong>
                    </p>
                )}
                <form onSubmit={handleUpload} style={formStyle}>
                    {error && <div style={errorBanner}>{error}</div>}
                    <label style={visuallyHidden} htmlFor="workout-name">Workout name</label>
                    <input
                        id="workout-name"
                        style={inputStyle}
                        placeholder="Workout name (e.g. Push day)"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoFocus
                        required
                    />

                    <button type="submit" disabled={submitting} style={{ ...primaryBtn, opacity: submitting ? 0.65 : 1 }}>
                        {submitting ? "Starting…" : "Start workout"}
                    </button>

                    <button type="button" onClick={() => navigate(-1)} style={secondaryBtn}>
                        Cancel
                    </button>
                </form>
            </div>
        </div>
    );
};

const pageContainer = { backgroundColor: "#f2f2f7", minHeight: "100vh", fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' };
const headerStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", backgroundColor: "#fff", borderBottom: "0.5px solid #d1d1d6", position: "sticky", top: 0, zIndex: 5 };
const backBtn = { fontSize: "1.25rem", color: "#262626", cursor: "pointer", padding: "4px", lineHeight: 1 };
const headerTitle = { fontSize: "1rem", fontWeight: "600", margin: 0, color: "#262626" };
const headerSpacer = { width: 28 };
const contentWrap = { maxWidth: 400, margin: "0 auto", padding: "24px 16px" };
const signedInAs = { fontSize: "0.85rem", color: "#8e8e93", margin: "0 0 20px", textAlign: "center" };
const formStyle = { display: "flex", flexDirection: "column", gap: 12 };
const visuallyHidden = { position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 };
const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "14px 16px",
    fontSize: "1rem",
    border: "1px solid #e5e5ea",
    borderRadius: 12,
    backgroundColor: "#fafafa",
    outline: "none",
    color: "#000",
};
const primaryBtn = {
    width: "100%",
    marginTop: 8,
    padding: "16px 20px",
    borderRadius: 14,
    border: "none",
    backgroundColor: "#000",
    color: "#fff",
    fontWeight: "700",
    fontSize: "1rem",
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
};
const secondaryBtn = {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 12,
    border: "none",
    background: "transparent",
    color: "#007aff",
    fontWeight: "600",
    fontSize: "0.95rem",
    cursor: "pointer",
};
const errorBanner = {
    padding: "10px 12px",
    borderRadius: 8,
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
    fontSize: "0.85rem",
    textAlign: "center",
};

export default StartWorkout;
