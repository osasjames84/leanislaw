import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

const ForgotPassword = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const initialEmail = searchParams.get("email") || "";
    const [email, setEmail] = useState(initialEmail);
    const [code, setCode] = useState("");
    const [password, setPassword] = useState("");
    const [password2, setPassword2] = useState("");
    const [step, setStep] = useState(1);
    const [info, setInfo] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const requestCode = async (e) => {
        e.preventDefault();
        setError("");
        setInfo("");
        setLoading(true);
        try {
            const res = await fetch("/api/v1/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim().toLowerCase() }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data.error || "Could not send code.");
                return;
            }
            setStep(2);
            setInfo(data.message || "If an account exists for that email, we sent a reset code.");
        } catch {
            setError("Network error.");
        } finally {
            setLoading(false);
        }
    };

    const reset = async (e) => {
        e.preventDefault();
        setError("");
        if (password !== password2) {
            setError("Passwords don’t match.");
            return;
        }
        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch("/api/v1/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: email.trim().toLowerCase(),
                    code,
                    new_password: password,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data.error || "Could not reset password.");
                return;
            }
            navigate("/login", { replace: true, state: { passwordResetOk: true } });
        } catch {
            setError("Network error.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={shell}>
            <div style={card}>
                <h1 style={h1}>Reset password</h1>
                {step === 1 ? (
                    <form onSubmit={requestCode}>
                        <p style={p}>We’ll email a 6-digit code if an account exists for this address.</p>
                        <label style={{ ...label, marginTop: 16 }} htmlFor="fp-email">
                            Email
                        </label>
                        <input
                            id="fp-email"
                            type="email"
                            autoComplete="email"
                            style={field}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                        {error ? (
                            <p style={{ ...p, marginTop: 12, color: "#b45309" }} role="alert">
                                {error}
                            </p>
                        ) : null}
                        <button
                            type="submit"
                            disabled={loading}
                            style={{ ...btn, marginTop: 20, opacity: loading ? 0.55 : 1, cursor: loading ? "default" : "pointer" }}
                        >
                            {loading ? "Sending…" : "Send code"}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={reset}>
                        {info ? <p style={{ ...p, color: "#047857" }}>{info}</p> : null}
                        <label style={{ ...label, marginTop: 16 }} htmlFor="fp-code">
                            6-digit code
                        </label>
                        <input
                            id="fp-code"
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            style={field}
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                            placeholder="000000"
                            required
                        />
                        <label style={{ ...label, marginTop: 12 }} htmlFor="fp-pass">
                            New password
                        </label>
                        <input
                            id="fp-pass"
                            type="password"
                            autoComplete="new-password"
                            style={field}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            minLength={6}
                            required
                        />
                        <label style={{ ...label, marginTop: 12 }} htmlFor="fp-pass2">
                            Confirm password
                        </label>
                        <input
                            id="fp-pass2"
                            type="password"
                            autoComplete="new-password"
                            style={field}
                            value={password2}
                            onChange={(e) => setPassword2(e.target.value)}
                            minLength={6}
                            required
                        />
                        {error ? (
                            <p style={{ ...p, marginTop: 12, color: "#b45309" }} role="alert">
                                {error}
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
                            {loading ? "Saving…" : "Set new password"}
                        </button>
                        <button
                            type="button"
                            style={{ ...secondaryBtn, marginTop: 12 }}
                            onClick={() => {
                                setStep(1);
                                setCode("");
                                setPassword("");
                                setPassword2("");
                                setInfo("");
                                setError("");
                            }}
                        >
                            Use a different email
                        </button>
                    </form>
                )}
                <p style={{ marginTop: 24 }}>
                    <Link to="/login" style={link}>
                        ← Back to sign in
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
const secondaryBtn = {
    width: "100%",
    padding: "12px",
    borderRadius: 12,
    border: "1px solid #e5e5ea",
    background: "#fafafa",
    color: "#000",
    fontWeight: 600,
    fontSize: "0.9rem",
    cursor: "pointer",
};
const link = { color: "#007aff", fontWeight: 600, textDecoration: "none" };

export default ForgotPassword;
