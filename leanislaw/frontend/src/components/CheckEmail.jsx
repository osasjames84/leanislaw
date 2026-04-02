import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";

const CheckEmail = () => {
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const email = searchParams.get("email") || "";
    const [devCode, setDevCode] = useState(() => location.state?.devVerificationCode || "");
    const [status, setStatus] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (location.state?.devVerificationCode) {
            setDevCode(location.state.devVerificationCode);
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    const resend = async () => {
        if (!email.trim()) {
            setStatus("No email address. Go back to sign up and create an account.");
            return;
        }
        setLoading(true);
        setStatus("");
        try {
            const res = await fetch("/api/v1/auth/resend-verification", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim().toLowerCase() }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setStatus(data.error || "Could not resend.");
                return;
            }
            if (data.devVerificationCode) {
                setDevCode(data.devVerificationCode);
                setStatus("Use the code shown below (outgoing email is not enabled yet).");
            } else {
                setStatus("Sent — check your inbox (and spam).");
            }
        } catch {
            setStatus("Network error.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={shell}>
            <div style={card}>
                <h1 style={h1}>Check your email</h1>
                <p style={p}>
                    We sent a 6-digit code{email ? ` to ${email}` : ""}. Enter it on the verification page to activate
                    your account, then sign in.
                </p>
                {devCode ? (
                    <div
                        style={{
                            marginTop: 16,
                            padding: 14,
                            borderRadius: 12,
                            background: "#fffbeb",
                            border: "1px solid #fcd34d",
                            fontFamily: "ui-monospace, monospace",
                            fontSize: "1.35rem",
                            fontWeight: 800,
                            letterSpacing: "0.15em",
                            textAlign: "center",
                            color: "#92400e",
                        }}
                        role="status"
                    >
                        {devCode}
                    </div>
                ) : null}
                {email ? (
                    <p style={{ ...p, marginTop: 14 }}>
                        <Link
                            to={`/verify-email?email=${encodeURIComponent(email)}`}
                            state={devCode ? { devVerificationCode: devCode } : undefined}
                            style={{ ...link, fontWeight: 700 }}
                        >
                            Enter verification code
                        </Link>
                    </p>
                ) : null}
                <button type="button" style={btn} onClick={resend} disabled={loading || !email}>
                    {loading ? "Sending…" : "Resend verification email"}
                </button>
                {status ? <p style={{ ...p, marginTop: 12, color: status.includes("Sent") ? "#047857" : "#b45309" }}>{status}</p> : null}
                <p style={{ marginTop: 20 }}>
                    <Link to="/login" style={link}>
                        I already verified — sign in
                    </Link>
                </p>
            </div>
        </div>
    );
};

const shell = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    background: "#f2f2f7",
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
};
const card = {
    maxWidth: 420,
    width: "100%",
    background: "#fff",
    borderRadius: 16,
    padding: 28,
    boxShadow: "0 8px 28px rgba(0,0,0,0.08)",
};
const h1 = { margin: "0 0 12px", fontSize: "1.35rem", fontWeight: 800 };
const p = { margin: 0, color: "#636366", lineHeight: 1.45, fontSize: "0.95rem" };
const btn = {
    marginTop: 20,
    width: "100%",
    padding: "14px",
    borderRadius: 12,
    border: "none",
    background: "#007aff",
    color: "#fff",
    fontWeight: 700,
    fontSize: "1rem",
    cursor: "pointer",
};
const link = { color: "#007aff", fontWeight: 600, textDecoration: "none" };

export default CheckEmail;
