import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { ageFromDateOfBirth, MIN_REGISTER_AGE, MAX_REGISTER_AGE } from "../utils/registerRules";

const Register = () => {
    const navigate = useNavigate();
    const { register } = useAuth();
    const [form, setForm] = useState({
        first_name: "",
        last_name: "",
        email: "",
        password: "",
        date_of_birth: "",
    });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleChange = (field) => (e) => {
        setForm((f) => ({ ...f, [field]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSubmitting(true);
        try {
            const age = ageFromDateOfBirth(form.date_of_birth);
            if (age == null) {
                setError("Use a valid date of birth (not in the future).");
                return;
            }
            if (age < MIN_REGISTER_AGE) {
                setError(`You must be at least ${MIN_REGISTER_AGE} years old to register.`);
                return;
            }
            if (age > MAX_REGISTER_AGE) {
                setError("Please enter a valid date of birth.");
                return;
            }
            const u = await register({
                first_name: form.first_name.trim(),
                last_name: form.last_name.trim(),
                email: form.email.trim(),
                password: form.password,
                date_of_birth: form.date_of_birth,
                role: "client",
            });
            if (u?.needsVerification) {
                navigate(`/check-email?email=${encodeURIComponent(u.email || "")}`, { replace: true });
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
                <div style={headerBlock}>
                    <Link to="/login" style={backLink}>← Back</Link>
                    <h1 style={title}>Create account</h1>
                    <p style={subtitle}>Join Lean is Law</p>
                </div>

                <form onSubmit={handleSubmit} style={formStyle}>
                    {error && <div style={errorBanner} role="alert">{error}</div>}

                    <div style={nameRow}>
                        <div style={fieldGroup}>
                            <label style={label}>First name</label>
                            <input
                                style={field}
                                value={form.first_name}
                                onChange={handleChange("first_name")}
                                autoComplete="given-name"
                                required
                            />
                        </div>
                        <div style={fieldGroup}>
                            <label style={label}>Last name</label>
                            <input
                                style={field}
                                value={form.last_name}
                                onChange={handleChange("last_name")}
                                autoComplete="family-name"
                                required
                            />
                        </div>
                    </div>

                    <label style={{ ...label, marginTop: 12 }}>Email</label>
                    <input
                        type="email"
                        style={field}
                        value={form.email}
                        onChange={handleChange("email")}
                        autoComplete="email"
                        required
                    />

                    <label style={{ ...label, marginTop: 12 }}>Date of birth</label>
                    <input
                        type="date"
                        style={field}
                        value={form.date_of_birth}
                        onChange={handleChange("date_of_birth")}
                        required
                    />

                    <label style={{ ...label, marginTop: 12 }}>Password</label>
                    <input
                        type={showPassword ? "text" : "password"}
                        style={field}
                        value={form.password}
                        onChange={handleChange("password")}
                        minLength={6}
                        autoComplete="new-password"
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
                        {submitting ? "Creating account…" : "Create account"}
                    </button>
                </form>

                <p style={footerLine}>
                    Already have an account?{" "}
                    <Link to="/login" style={link}>Sign in</Link>
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
    padding: "32px 20px",
    backgroundColor: "#f2f2f7",
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
    boxSizing: "border-box",
};

const card = {
    width: "100%",
    maxWidth: 400,
    padding: "32px 28px 36px",
    backgroundColor: "#fff",
    borderRadius: 24,
    boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
    boxSizing: "border-box",
};

const headerBlock = { marginBottom: 24 };
const backLink = { color: "#007aff", fontWeight: "600", fontSize: "0.9rem", textDecoration: "none", display: "inline-block", marginBottom: 16 };
const title = { margin: 0, fontSize: "1.45rem", fontWeight: "800", letterSpacing: "-0.4px", color: "#000" };
const subtitle = { margin: "6px 0 0", fontSize: "0.95rem", color: "#8e8e93", fontWeight: "500" };

const formStyle = { display: "flex", flexDirection: "column" };
const nameRow = { display: "flex", gap: 12 };
const fieldGroup = { flex: 1, display: "flex", flexDirection: "column" };

const label = {
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
    padding: "12px 14px",
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
    marginTop: 10,
    cursor: "pointer",
    userSelect: "none",
};
const showCheck = { width: 16, height: 16, accentColor: "#007aff", cursor: "pointer" };
const showLabel = { fontSize: "0.85rem", color: "#636366", fontWeight: "500" };

const primaryBtn = {
    width: "100%",
    marginTop: 20,
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
    margin: "24px 0 0",
    fontSize: "0.9rem",
    color: "#8e8e93",
    fontWeight: "500",
};
const link = { color: "#007aff", fontWeight: "700", textDecoration: "none" };

export default Register;
