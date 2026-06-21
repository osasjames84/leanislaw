import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authBearerHeaders } from "../apiHeaders";

/**
 * Discreet, always-available entry to the client coaching hub. Shown only to
 * clients who actually have a coach. Hidden on auth/onboarding/coach screens and
 * on the coaching pages themselves. Sits just above the Support signpost.
 */
const HIDE_ON = ["/login", "/register", "/check-email", "/verify-email", "/forgot-password", "/setup", "/support", "/coach", "/coaching"];

const CoachingSignpost = () => {
    const { token } = useAuth();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const [summary, setSummary] = useState(null);

    useEffect(() => {
        if (!token) return;
        let cancelled = false;
        fetch("/api/v1/programs/my/summary", { headers: authBearerHeaders(token) })
            .then((r) => r.json())
            .then((d) => { if (!cancelled && !d.error) setSummary(d); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [token, pathname]);

    if (!token || !summary?.has_coach) return null;
    if (HIDE_ON.some((p) => pathname.startsWith(p))) return null;

    return (
        <button
            type="button"
            onClick={() => navigate("/coaching")}
            aria-label="Open coaching"
            style={{
                position: "fixed",
                right: 12,
                bottom: "calc(110px + env(safe-area-inset-bottom, 0px))",
                zIndex: 900,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 999,
                border: "0.5px solid rgba(0,122,255,0.35)",
                background: "rgba(0,122,255,0.95)",
                backdropFilter: "blur(8px)",
                color: "#fff",
                fontSize: "0.72rem",
                fontWeight: 700,
                boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
                cursor: "pointer",
            }}
        >
            🏋 Coaching
            {summary.todo ? (
                <span style={{ background: "#fff", color: "#007aff", borderRadius: 999, minWidth: 16, height: 16, padding: "0 4px", fontSize: "0.66rem", fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    {summary.todo}
                </span>
            ) : null}
        </button>
    );
};

export default CoachingSignpost;
