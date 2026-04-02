import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authBearerHeaders } from "../apiHeaders";
import { normalizeUsernameClient, usernameRulesText } from "../lib/usernameRules";

const nextPathAfterUsername = (user) => {
    if (!user) return "/dashboard";
    if (user.role === "coach") return "/coach";
    if (user.tdee_onboarding_done === false) return "/setup/tdee";
    return "/dashboard";
};

const UsernameOnboarding = () => {
    const navigate = useNavigate();
    const { token, user, loading: authLoading, refreshUser } = useAuth();
    const [value, setValue] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [availState, setAvailState] = useState({ checking: false, available: null });

    const normalized = useMemo(() => normalizeUsernameClient(value), [value]);

    const checkAvailable = useCallback(
        async (norm) => {
            if (!token || !norm) {
                setAvailState({ checking: false, available: null });
                return;
            }
            setAvailState({ checking: true, available: null });
            try {
                const res = await fetch(
                    `/api/v1/auth/username-available?u=${encodeURIComponent(norm)}`,
                    { headers: authBearerHeaders(token) },
                );
                const j = await res.json().catch(() => ({}));
                if (!res.ok) {
                    setAvailState({ checking: false, available: false });
                    return;
                }
                setAvailState({ checking: false, available: Boolean(j.available) });
            } catch {
                setAvailState({ checking: false, available: null });
            }
        },
        [token],
    );

    useEffect(() => {
        const t = setTimeout(() => {
            if (normalized) checkAvailable(normalized);
            else setAvailState({ checking: false, available: null });
        }, 350);
        return () => clearTimeout(t);
    }, [normalized, checkAvailable]);

    if (authLoading || !user) {
        return (
            <div style={page}>
                <p style={{ color: "#8e8e93", textAlign: "center", padding: 40 }}>Loading…</p>
            </div>
        );
    }

    if (user.username_setup_done !== false) {
        return <Navigate to={nextPathAfterUsername(user)} replace />;
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        const norm = normalizeUsernameClient(value);
        if (!norm) {
            setError(usernameRulesText());
            return;
        }
        if (availState.available === false) {
            setError("That username is already taken. Try another.");
            return;
        }
        if (availState.checking || availState.available !== true) {
            setError("Check that your username is available, then try again.");
            return;
        }
        setBusy(true);
        try {
            const res = await fetch("/api/v1/auth/me", {
                method: "PATCH",
                headers: { ...authBearerHeaders(token), "Content-Type": "application/json" },
                body: JSON.stringify({ username: norm }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Could not save username.");
            const fresh = await refreshUser();
            navigate(nextPathAfterUsername(fresh), { replace: true });
        } catch (err) {
            setError(err.message || "Something went wrong.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div style={page}>
            <div style={inner}>
                <div style={card}>
                    <p style={kicker}>One more step</p>
                    <h1 style={title}>Choose a username</h1>
                    <p style={sub}>Pick a unique handle. You can use letters, numbers, periods, and underscores.</p>

                    <form onSubmit={handleSubmit}>
                        {error ? (
                            <div style={errBox} role="alert">
                                {error}
                            </div>
                        ) : null}

                        <label style={label} htmlFor="username-field">
                            Username
                        </label>
                        <input
                            id="username-field"
                            style={input}
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            autoComplete="username"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            maxLength={30}
                            placeholder="e.g. chad.lifts_01"
                        />
                        <p style={hint}>{usernameRulesText()}</p>

                        {normalized ? (
                            <p style={availLine(availState.available, availState.checking)}>
                                {availState.checking
                                    ? "Checking…"
                                    : availState.available === true
                                      ? `Available: @${normalized}`
                                      : availState.available === false
                                        ? "Already taken"
                                        : ""}
                            </p>
                        ) : value.trim() ? (
                            <p style={{ ...hint, color: "#b45309" }}>Fix the format to check availability.</p>
                        ) : null}

                        <button type="submit" style={btn} disabled={busy}>
                            {busy ? "Saving…" : "Continue"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

function availLine(available, checking) {
    return {
        margin: "8px 0 16px",
        fontSize: "0.88rem",
        fontWeight: "600",
        color: checking ? "#8e8e93" : available === true ? "#047857" : available === false ? "#b45309" : "#8e8e93",
    };
}

const page = {
    minHeight: "100vh",
    backgroundColor: "#f2f2f7",
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
    boxSizing: "border-box",
    padding: "calc(20px + env(safe-area-inset-top, 0px)) 16px 32px",
};

const inner = {
    maxWidth: 400,
    margin: "0 auto",
};

const card = {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: "28px 24px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.06)",
    border: "0.5px solid #e5e5ea",
};

const kicker = {
    margin: 0,
    fontSize: "0.7rem",
    fontWeight: "800",
    color: "#8e8e93",
    letterSpacing: "1px",
    textTransform: "uppercase",
};

const title = {
    margin: "10px 0 8px",
    fontSize: "1.45rem",
    fontWeight: "800",
    color: "#000",
    letterSpacing: "-0.5px",
};

const sub = {
    margin: "0 0 20px",
    fontSize: "0.9rem",
    color: "#636366",
    lineHeight: 1.45,
};

const label = {
    display: "block",
    fontSize: "0.8rem",
    fontWeight: "700",
    color: "#3a3a3c",
    marginBottom: 6,
};

const input = {
    width: "100%",
    padding: "12px 14px",
    fontSize: "1rem",
    borderRadius: 12,
    border: "1px solid #d1d1d6",
    boxSizing: "border-box",
};

const hint = {
    margin: "8px 0 0",
    fontSize: "0.78rem",
    color: "#8e8e93",
    lineHeight: 1.35,
};

const errBox = {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fff2f2",
    color: "#b91c1c",
    fontSize: "0.88rem",
    marginBottom: 12,
};

const btn = {
    width: "100%",
    marginTop: 8,
    padding: "14px 16px",
    borderRadius: 14,
    border: "none",
    background: "#007aff",
    color: "#fff",
    fontWeight: "700",
    fontSize: "1rem",
    cursor: "pointer",
};

export default UsernameOnboarding;
