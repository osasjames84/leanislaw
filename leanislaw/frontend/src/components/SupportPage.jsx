import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authBearerHeaders } from "../apiHeaders";

const SupportPage = () => {
    const navigate = useNavigate();
    const { token } = useAuth();
    const [s, setS] = useState(null);

    useEffect(() => {
        if (!token) return;
        fetch("/api/v1/safeguarding/support", { headers: authBearerHeaders(token) })
            .then((r) => r.json())
            .then((d) => !d.error && setS(d))
            .catch(() => {});
    }, [token]);

    return (
        <div
            style={{
                minHeight: "100vh",
                background: "#f2f2f7",
                padding:
                    "calc(20px + env(safe-area-inset-top, 0px)) 16px calc(88px + env(safe-area-inset-bottom, 0px))",
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
            }}
        >
            <button
                type="button"
                onClick={() => navigate(-1)}
                style={{ border: "none", background: "none", color: "#007aff", fontWeight: 700, cursor: "pointer", padding: 0 }}
            >
                ← Back
            </button>
            <h1 style={{ margin: "12px 0 6px", fontSize: "1.5rem", fontWeight: 800 }}>Support</h1>

            <div
                style={{
                    background: "#fff",
                    borderRadius: 16,
                    padding: 20,
                    border: "0.5px solid #e5e5ea",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                }}
            >
                <p style={{ margin: "0 0 16px", color: "#636366", lineHeight: 1.5, fontSize: "0.92rem" }}>
                    {s?.disclaimer ||
                        "Lean is Law is a coaching tool, not medical care. If you’re struggling with food, eating or how you feel about your body, free confidential support is available."}
                </p>

                {s ? (
                    <>
                        <p style={{ margin: "0 0 4px", fontWeight: 800, fontSize: "1.1rem" }}>{s.name}</p>
                        {s.phone ? (
                            <p style={{ margin: "0 0 10px", color: "#1c1c1e" }}>
                                Helpline: <strong>{s.phone}</strong>
                            </p>
                        ) : null}
                        <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: "inline-block",
                                padding: "10px 16px",
                                borderRadius: 12,
                                background: "#007aff",
                                color: "#fff",
                                fontWeight: 700,
                                textDecoration: "none",
                            }}
                        >
                            Visit {s.name} ↗
                        </a>
                        <p style={{ margin: "14px 0 0", fontSize: "0.75rem", color: "#8e8e93" }}>
                            Region: {s.region}. If you’re ever in immediate danger, contact your local emergency services.
                        </p>
                    </>
                ) : (
                    <p style={{ color: "#8e8e93" }}>Loading…</p>
                )}
            </div>
        </div>
    );
};

export default SupportPage;
