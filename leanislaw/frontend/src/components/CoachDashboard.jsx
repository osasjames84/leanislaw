import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authBearerHeaders } from "../apiHeaders";

const CoachDashboard = () => {
    const navigate = useNavigate();
    const { token, user, logout } = useAuth();
    const [panel, setPanel] = useState(null);
    const [err, setErr] = useState("");

    useEffect(() => {
        if (!token) return;
        fetch("/api/v1/coaching/panel", { headers: authBearerHeaders(token) })
            .then((r) => r.json())
            .then((data) => {
                if (!data.error) setPanel(data);
                else setErr(data.error);
            })
            .catch(() => setErr("Could not load coach panel"));
    }, [token]);

    return (
        <div
            style={{
                minHeight: "100vh",
                background: "#f2f2f7",
                padding: "calc(20px + env(safe-area-inset-top, 0px)) 16px calc(88px + env(safe-area-inset-bottom, 0px))",
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
            }}
        >
            <header style={{ marginBottom: 20 }}>
                <button
                    type="button"
                    onClick={() => navigate("/dashboard")}
                    style={{
                        border: "none",
                        background: "none",
                        color: "#007aff",
                        fontWeight: 700,
                        fontSize: "0.95rem",
                        cursor: "pointer",
                        padding: 0,
                    }}
                >
                    ← App home
                </button>
                <h1 style={{ margin: "12px 0 4px", fontSize: "1.5rem", fontWeight: 800 }}>Coach</h1>
                <p style={{ margin: 0, color: "#8e8e93", fontSize: "0.9rem" }}>
                    {user?.first_name} {user?.last_name}
                </p>
            </header>

            <div
                style={{
                    background: "#fff",
                    borderRadius: 16,
                    padding: 20,
                    border: "0.5px solid #e5e5ea",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                }}
            >
                {err ? (
                    <p style={{ color: "#b45309", margin: 0 }}>{err}</p>
                ) : panel ? (
                    <>
                        <p style={{ margin: "0 0 8px", fontWeight: 800, fontSize: "1.05rem" }}>
                            {panel.headline}
                        </p>
                        <p style={{ margin: 0, color: "#636366", fontSize: "0.9rem", lineHeight: 1.45 }}>
                            {panel.message}
                        </p>
                        <p style={{ margin: "16px 0 0", fontSize: "0.82rem", color: "#8e8e93" }}>
                            Client list and paid coaching tools will expand here.
                        </p>
                    </>
                ) : (
                    <p style={{ color: "#8e8e93" }}>Loading…</p>
                )}
            </div>

            <button
                type="button"
                onClick={() => {
                    logout();
                    navigate("/login", { replace: true });
                }}
                style={{
                    marginTop: 24,
                    width: "100%",
                    padding: 14,
                    borderRadius: 14,
                    border: "1px solid #ff3b30",
                    background: "transparent",
                    color: "#ff3b30",
                    fontWeight: 700,
                    cursor: "pointer",
                }}
            >
                Log out
            </button>

            <p style={{ textAlign: "center", marginTop: 16 }}>
                <Link to="/about" style={{ color: "#007aff", fontWeight: 600, textDecoration: "none" }}>
                    About
                </Link>
            </p>
        </div>
    );
};

export default CoachDashboard;
