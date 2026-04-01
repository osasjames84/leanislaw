import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

const VerifyEmail = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const emailParam = searchParams.get("email") || "";
    const [email, setEmail] = useState(emailParam);
    const [code, setCode] = useState("");
    const [msg, setMsg] = useState("");
    const [ok, setOk] = useState(false);
    const [loading, setLoading] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setMsg("");
        setLoading(true);
        try {
            const res = await fetch("/api/v1/auth/verify-registration-code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim().toLowerCase(), code }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setMsg(data.error || "Verification failed.");
                return;
            }
            setOk(true);
            setMsg("Your email is verified. You can sign in.");
        } catch {
            setMsg("Network error. Try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={shell}>
            <div style={card}>
                <h1 style={h1}>Verify your email</h1>
                <p style={p}>
                    Enter the 6-digit code we sent. Didn’t get it?{" "}
                    <Link to={email.trim() ? `/check-email?email=${encodeURIComponent(email.trim())}` : "/check-email"} style={link}>
                        Resend
                    </Link>
                </p>
                {ok ? (
                    <>
                        <p style={{ ...p, marginTop: 12, color: "#047857" }}>{msg}</p>
                        <button type="button" style={btn} onClick={() => navigate("/login", { replace: true })}>
                            Sign in
                        </button>
                    </>
                ) : (
                    <form onSubmit={submit} style={{ marginTop: 16 }}>
                        <label style={label} htmlFor="verify-email-input">
                            Email
                        </label>
                        <input
                            id="verify-email-input"
                            type="email"
                            autoComplete="email"
                            style={field}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                        <label style={{ ...label, marginTop: 12 }} htmlFor="verify-code-input">
                            6-digit code
                        </label>
                        <input
                            id="verify-code-input"
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={12}
                            style={field}
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                            placeholder="000000"
                            required
                        />
                        {msg ? (
                            <p style={{ ...p, marginTop: 12, color: "#b45309" }} role="alert">
                                {msg}
                            </p>
                        ) : null}
                        <button
                            type="submit"
                            disabled={loading || code.replace(/\D/g, "").length !== 6}
                            style={{
                                ...btn,
                                marginTop: 20,
                                opacity: loading || code.replace(/\D/g, "").length !== 6 ? 0.55 : 1,
                                cursor: loading ? "default" : "pointer",
                            }}
                        >
                            {loading ? "Checking…" : "Verify"}
                        </button>
                    </form>
                )}
                {!ok ? (
                    <Link to="/login" style={{ ...link, display: "inline-block", marginTop: 20 }}>
                        Back to sign in
                    </Link>
                ) : null}
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
    maxWidth: 400,
    width: "100%",
    background: "#fff",
    borderRadius: 16,
    padding: 28,
    boxShadow: "0 8px 28px rgba(0,0,0,0.08)",
};
const h1 = { margin: "0 0 12px", fontSize: "1.35rem", fontWeight: 800 };
const p = { margin: 0, color: "#636366", lineHeight: 1.45, fontSize: "0.95rem" };
const label = {
    display: "block",
    fontSize: "0.7rem",
    fontWeight: 700,
    color: "#8e8e93",
    letterSpacing: "0.5px",
    marginBottom: 6,
    textTransform: "uppercase",
};
const field = {
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
const btn = {
    width: "100%",
    padding: "14px",
    borderRadius: 12,
    border: "none",
    background: "#000",
    color: "#fff",
    fontWeight: 700,
    fontSize: "1rem",
    cursor: "pointer",
};
const link = { color: "#007aff", fontWeight: 600, textDecoration: "none" };

export default VerifyEmail;
