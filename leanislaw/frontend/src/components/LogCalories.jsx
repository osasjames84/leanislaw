import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authBearerHeaders } from "../apiHeaders";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const LogCalories = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { token } = useAuth();
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

    useEffect(() => {
        const q = searchParams.get("date");
        if (q && DATE_RE.test(q)) setDate(q);
    }, [searchParams]);
    const [calories, setCalories] = useState("");
    const [steps, setSteps] = useState("");
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState("");
    const [saveHint, setSaveHint] = useState("");

    const loadDay = useCallback(async () => {
        if (!token) return;
        setLoadError("");
        try {
            const res = await fetch(`/api/v1/tdee/day-log?date=${encodeURIComponent(date)}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Could not load day");
            setCalories(data.calories != null ? String(data.calories) : "");
            setSteps(data.steps != null ? String(data.steps) : "");
        } catch (e) {
            setLoadError(e.message);
        }
    }, [date, token]);

    useEffect(() => {
        loadDay();
    }, [loadDay]);

    const save = async (e) => {
        e.preventDefault();
        const c = Math.max(0, Math.floor(Number(calories) || 0));
        const stepsTrim = steps.trim();
        const s = stepsTrim === "" ? null : Math.max(0, Math.floor(Number(steps) || 0));
        if (c <= 0 && stepsTrim === "") {
            setLoadError("Enter calories and/or steps.");
            return;
        }
        setSaving(true);
        setSaveHint("");
        setLoadError("");
        try {
            const body = { date };
            if (c > 0) body.calories = c;
            if (stepsTrim !== "") body.steps = s;
            const res = await fetch("/api/v1/tdee/day-log", {
                method: "PUT",
                headers: { ...authBearerHeaders(token), "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Save failed");
            setSaveHint("Saved. TDEE will update from your trend.");
            await loadDay();
        } catch (err) {
            setLoadError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={page}>
            <header style={header}>
                <button type="button" onClick={() => navigate("/dashboard")} style={backBtn}>
                    ← Home
                </button>
                <h1 style={title}>Log calories</h1>
                <div style={{ width: 72 }} />
            </header>

            <div style={content}>
                <p style={lead}>Track intake and optional steps for a single day. Use today or backfill.</p>

                {loadError ? <div style={errBox}>{loadError}</div> : null}
                {saveHint ? <div style={okBox}>{saveHint}</div> : null}

                <form onSubmit={save} style={form}>
                    <label style={label}>Date</label>
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        style={input}
                    />

                    <label style={label}>Calories (kcal)</label>
                    <input
                        style={input}
                        placeholder="e.g. 2400"
                        value={calories}
                        onChange={(e) => setCalories(e.target.value)}
                        inputMode="numeric"
                    />

                    <label style={label}>Steps (optional)</label>
                    <input
                        style={input}
                        placeholder="Optional — updates step count for this day"
                        value={steps}
                        onChange={(e) => setSteps(e.target.value)}
                        inputMode="numeric"
                    />

                    <button type="submit" disabled={saving} style={btn}>
                        {saving ? "Saving…" : "Save day"}
                    </button>
                </form>

                <p style={footer}>
                    <Link to="/tdee" style={link}>
                        View TDEE & metabolism
                    </Link>
                </p>
            </div>
        </div>
    );
};

const page = {
    minHeight: "100vh",
    backgroundColor: "#f2f2f7",
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
};

const header = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px",
    backgroundColor: "#fff",
    borderBottom: "0.5px solid #d1d1d6",
    position: "sticky",
    top: 0,
    zIndex: 5,
};

const backBtn = {
    border: "none",
    background: "none",
    fontSize: "1rem",
    color: "#007aff",
    fontWeight: "600",
    cursor: "pointer",
    padding: "4px 0",
};

const title = { margin: 0, fontSize: "1.05rem", fontWeight: "800" };

const content = { padding: "20px 16px 32px", maxWidth: 480, margin: "0 auto" };

const lead = {
    margin: "0 0 18px",
    fontSize: "0.92rem",
    color: "#636366",
    lineHeight: 1.45,
};

const form = { display: "flex", flexDirection: "column", gap: 4 };

const label = {
    display: "block",
    fontSize: "0.68rem",
    fontWeight: "800",
    color: "#8e8e93",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginTop: 10,
    marginBottom: 6,
};

const input = {
    width: "100%",
    boxSizing: "border-box",
    padding: "14px 16px",
    fontSize: "1rem",
    border: "1px solid #e5e5ea",
    borderRadius: 14,
    backgroundColor: "#fff",
};

const btn = {
    marginTop: 20,
    width: "100%",
    padding: "16px 18px",
    borderRadius: 14,
    border: "none",
    backgroundColor: "#000",
    color: "#fff",
    fontWeight: "800",
    fontSize: "1rem",
    cursor: "pointer",
};

const errBox = {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
    fontSize: "0.9rem",
    marginBottom: 12,
};

const okBox = {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#ecfdf3",
    color: "#047857",
    fontSize: "0.9rem",
    marginBottom: 12,
    fontWeight: "600",
};

const footer = { textAlign: "center", marginTop: 28 };

const link = { color: "#007aff", fontWeight: "600", textDecoration: "none" };

export default LogCalories;
