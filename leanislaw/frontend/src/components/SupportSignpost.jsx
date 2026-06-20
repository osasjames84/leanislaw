import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * Discreet, always-available link to eating-disorder support. Mounted globally
 * for signed-in users. Hidden on auth/onboarding screens. Duty of care: the app
 * is coaching, not medical care.
 */
const HIDE_ON = ["/login", "/register", "/check-email", "/verify-email", "/forgot-password", "/setup", "/support"];

const SupportSignpost = () => {
    const { token } = useAuth();
    const navigate = useNavigate();
    const { pathname } = useLocation();

    if (!token) return null;
    if (HIDE_ON.some((p) => pathname.startsWith(p))) return null;

    return (
        <button
            type="button"
            onClick={() => navigate("/support")}
            aria-label="Get support"
            style={{
                position: "fixed",
                right: 12,
                bottom: "calc(72px + env(safe-area-inset-bottom, 0px))",
                zIndex: 900,
                padding: "6px 12px",
                borderRadius: 999,
                border: "0.5px solid #d1d1d6",
                background: "rgba(255,255,255,0.92)",
                backdropFilter: "blur(8px)",
                color: "#636366",
                fontSize: "0.72rem",
                fontWeight: 600,
                boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
                cursor: "pointer",
            }}
        >
            ♥ Support
        </button>
    );
};

export default SupportSignpost;
