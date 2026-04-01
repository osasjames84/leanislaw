import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import ChadPhoto from "../assets/creator_photo.png";

const Login = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const coachMode = searchParams.get("coach") === "1" || searchParams.get("mode") === "coach";
    const { login } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSubmitting(true);
        try {
            const u = await login(email.trim(), password);
            if (coachMode) {
                if (u?.role !== "coach") {
                    throw new Error("This sign-in is for coach accounts only. Use the regular sign in for clients.");
                }
                navigate("/coach", { replace: true });
                return;
            }
            if (u?.role === "coach") {
                navigate("/coach", { replace: true });
                return;
            }
            const needsSetup = u && u.tdee_onboarding_done === false;
            navigate(needsSetup ? "/setup/tdee" : "/dashboard", { replace: true });
        } catch (err) {
            setError(err.message || "Something went wrong. Try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={shell}>
            <div style={card}>
                <div style={hero}>
                    <div style={avatarRing}>
                        <img src={ChadPhoto} alt="The way of the chad" style={avatarImg} />
                    </div>
                    <h1 style={title}>Lean is Law</h1>
                    <p style={subtitle}>
                        {coachMode ? "Coach sign in" : "Sign in to continue"}
                    </p>
                </div>

                <form onSubmit={handleSubmit} style={form}>
                    {error && <div style={errorBanner} role="alert">{error}</div>}

                    <label style={label} htmlFor="login-email">Email</label>
                    <input
                        id="login-email"
                        type="email"
                        autoComplete="email"
                        style={field}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                    />

                    <label style={{ ...label, marginTop: 14 }} htmlFor="login-password">Password</label>
                    <input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        style={field}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                    />

                    <label style={showRow}>
                        <input
                            type="checkbox"
                            checked={showPassword}
                            onChange={(e) => setShowPassword(e.target.checked)}
                            style={showCheck}
                        />
                        <span style={showLabel}>Show password</span>
                    </label>

                    <button
                        type="submit"
                        disabled={submitting}
                        style={{ ...primaryBtn, opacity: submitting ? 0.55 : 1, cursor: submitting ? "default" : "pointer" }}
                    >
                        {submitting ? "Signing in…" : "Sign in"}
                    </button>
                </form>

                <p style={footerLine}>
                    New here?{" "}
                    <Link to="/register" style={link}>Create an account</Link>
                </p>
                {!coachMode ? (
                    <p style={{ ...footerLine, marginTop: 12 }}>Coach?{" "}
                        <Link to="/login?coach=1" style={link}>Sign in as coach</Link>
                    </p>
                ) : (
                    <p style={{ ...footerLine, marginTop: 12 }}>
                        <Link to="/login" style={link}>Client sign in</Link>
                    </p>
                )}
            </div>
        </div>
    );
};

const shell = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "32px 20px",
    backgroundColor: "#f2f2f7",
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
    boxSizing: "border-box",
};

const card = {
    width: "100%",
    maxWidth: 380,
    padding: "40px 32px 36px",
    backgroundColor: "#fff",
    borderRadius: 24,
    boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
    boxSizing: "border-box",
};

const hero = { textAlign: "center", marginBottom: 28 };
const avatarRing = {
    width: 96,
    height: 96,
    margin: "0 auto 20px",
    borderRadius: 20,
    padding: 3,
    background: "linear-gradient(135deg, #007aff 0%, #5856d6 100%)",
    boxShadow: "0 12px 32px rgba(0, 122, 255, 0.25)",
};
const avatarImg = {
    width: "100%",
    height: "100%",
    borderRadius: 17,
    objectFit: "cover",
    display: "block",
    backgroundColor: "#e5e5ea",
};

const title = {
    margin: 0,
    fontSize: "1.5rem",
    fontWeight: "800",
    letterSpacing: "-0.4px",
    color: "#000",
};
const subtitle = { margin: "8px 0 0", fontSize: "0.95rem", color: "#8e8e93", fontWeight: "500" };

const form = { display: "flex", flexDirection: "column" };
const label = {
    display: "block",
    fontSize: "0.7rem",
    fontWeight: "700",
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

const showRow = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    marginBottom: 4,
    cursor: "pointer",
    userSelect: "none",
};
const showCheck = { width: 16, height: 16, accentColor: "#007aff", cursor: "pointer" };
const showLabel = { fontSize: "0.85rem", color: "#636366", fontWeight: "500" };

const primaryBtn = {
    width: "100%",
    marginTop: 22,
    padding: "16px 20px",
    borderRadius: 14,
    border: "none",
    backgroundColor: "#000",
    color: "#fff",
    fontWeight: "700",
    fontSize: "1rem",
    boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
};

const errorBanner = {
    padding: "12px 14px",
    borderRadius: 12,
    backgroundColor: "#fff2f2",
    color: "#c00",
    fontSize: "0.85rem",
    textAlign: "center",
    marginBottom: 16,
    border: "1px solid #ffd4d4",
};

const footerLine = {
    textAlign: "center",
    margin: "28px 0 0",
    fontSize: "0.9rem",
    color: "#8e8e93",
    fontWeight: "500",
};
const link = { color: "#007aff", fontWeight: "700", textDecoration: "none" };

export default Login;
