import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * Floating entry to the Ascension (gamified home) screen. Shown to all signed-in
 * users on the main app screens. Sits above the coaching + support signposts.
 * (Kept as a floating entry so it doesn't touch the user's BottomNav WIP.)
 */
const HIDE_ON = ["/login", "/register", "/check-email", "/verify-email", "/forgot-password", "/setup", "/support", "/coach", "/coaching", "/ascend"];

const AscendSignpost = () => {
    const { token } = useAuth();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    if (!token) return null;
    if (HIDE_ON.some((p) => pathname.startsWith(p))) return null;
    return (
        <button
            type="button"
            onClick={() => navigate("/ascend")}
            aria-label="Open Ascension"
            style={{
                position: "fixed", right: 12, bottom: "calc(148px + env(safe-area-inset-bottom, 0px))", zIndex: 900,
                display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 999,
                border: "1px solid rgba(255,159,10,0.5)", background: "linear-gradient(135deg,#ff375f,#ff9f0a)",
                color: "#fff", fontSize: "0.74rem", fontWeight: 800, letterSpacing: 0.3,
                boxShadow: "0 4px 16px rgba(255,55,95,0.4)", cursor: "pointer",
            }}
        >
            ⚡ Ascend
        </button>
    );
};

export default AscendSignpost;
