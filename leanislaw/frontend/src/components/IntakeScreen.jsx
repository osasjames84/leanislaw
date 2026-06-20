import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authJsonHeaders } from "../apiHeaders";

// Standard PAR-Q (Physical Activity Readiness Questionnaire).
const PARQ = [
    { id: "heart_condition", q: "Has a doctor ever said you have a heart condition and that you should only do physical activity recommended by a doctor?" },
    { id: "chest_pain_activity", q: "Do you feel pain in your chest when you do physical activity?" },
    { id: "chest_pain_rest", q: "In the past month, have you had chest pain when you were not doing physical activity?" },
    { id: "dizziness", q: "Do you lose your balance from dizziness, or ever lose consciousness?" },
    { id: "joint_problem", q: "Do you have a bone or joint problem that could be made worse by a change in your activity?" },
    { id: "bp_medication", q: "Is a doctor currently prescribing drugs for your blood pressure or heart condition?" },
    { id: "other_reason", q: "Do you know of any other reason why you should not do physical activity?" },
];

const card = {
    background: "#fff",
    borderRadius: 16,
    padding: 18,
    border: "0.5px solid #e5e5ea",
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
    marginBottom: 14,
};

const IntakeScreen = () => {
    const navigate = useNavigate();
    const { token } = useAuth();
    const [answers, setAnswers] = useState({});
    const [wellbeing, setWellbeing] = useState("");
    const [region, setRegion] = useState("UK");
    const [err, setErr] = useState("");
    const [busy, setBusy] = useState(false);

    const set = (id, val) => setAnswers((a) => ({ ...a, [id]: val }));
    const allAnswered = PARQ.every((p) => answers[p.id] === true || answers[p.id] === false);
    const anyYes = PARQ.some((p) => answers[p.id] === true);

    const submit = async () => {
        if (!allAnswered) {
            setErr("Please answer every question.");
            return;
        }
        setBusy(true);
        setErr("");
        try {
            const r = await fetch("/api/v1/safeguarding/intake", {
                method: "POST",
                headers: authJsonHeaders(token),
                body: JSON.stringify({ par_q: answers, wellbeing_note: wellbeing, support_region: region }),
            });
            const data = await r.json();
            if (data.error) setErr(data.error);
            else navigate("/dashboard", { replace: true });
        } catch {
            setErr("Could not save. Please try again.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div
            style={{
                minHeight: "100vh",
                background: "#f2f2f7",
                padding:
                    "calc(20px + env(safe-area-inset-top, 0px)) 16px calc(40px + env(safe-area-inset-bottom, 0px))",
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
            }}
        >
            <h1 style={{ margin: "0 0 4px", fontSize: "1.5rem", fontWeight: 800 }}>Before we start</h1>
            <p style={{ margin: "0 0 16px", color: "#8e8e93", fontSize: "0.9rem", lineHeight: 1.45 }}>
                A quick health check so your coaching is safe for you. This is coaching, not medical care.
            </p>

            <div style={card}>
                {PARQ.map((p) => (
                    <div key={p.id} style={{ padding: "10px 0", borderBottom: "1px solid #f0f0f3" }}>
                        <p style={{ margin: "0 0 8px", fontSize: "0.9rem", lineHeight: 1.4 }}>{p.q}</p>
                        <div style={{ display: "flex", gap: 8 }}>
                            {[["Yes", true], ["No", false]].map(([label, val]) => (
                                <button
                                    key={label}
                                    type="button"
                                    onClick={() => set(p.id, val)}
                                    style={{
                                        flex: 1,
                                        padding: 8,
                                        borderRadius: 10,
                                        border: "1px solid #d1d1d6",
                                        background: answers[p.id] === val ? "#007aff" : "#fff",
                                        color: answers[p.id] === val ? "#fff" : "#1c1c1e",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                    }}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div style={card}>
                <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: "0.92rem" }}>
                    How is your relationship with food and your body right now? (optional)
                </p>
                <textarea
                    value={wellbeing}
                    onChange={(e) => setWellbeing(e.target.value)}
                    rows={3}
                    placeholder="Anything you'd like your coach to know."
                    style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #d1d1d6", fontFamily: "inherit", resize: "vertical" }}
                />
                <label style={{ display: "block", marginTop: 12, fontSize: "0.8rem", color: "#636366" }}>
                    Your region (for support resources)
                    <select
                        value={region}
                        onChange={(e) => setRegion(e.target.value)}
                        style={{ display: "block", marginTop: 4, padding: 8, borderRadius: 10, border: "1px solid #d1d1d6" }}
                    >
                        <option value="UK">United Kingdom</option>
                        <option value="US">United States</option>
                        <option value="AU">Australia</option>
                    </select>
                </label>
            </div>

            {anyYes ? (
                <div style={{ ...card, borderColor: "#f5c2b8", background: "#fff7f5" }}>
                    <p style={{ margin: 0, color: "#9a3412", fontSize: "0.85rem", lineHeight: 1.45 }}>
                        You answered “yes” to one or more questions. We’ll flag this for your coach and recommend
                        checking with your doctor before increasing activity.
                    </p>
                </div>
            ) : null}

            {err ? <p style={{ color: "#b42318", fontSize: "0.85rem" }}>{err}</p> : null}

            <button
                type="button"
                onClick={submit}
                disabled={busy}
                style={{
                    width: "100%",
                    padding: 14,
                    borderRadius: 14,
                    border: "none",
                    background: busy ? "#9bc4ff" : "#007aff",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: "1rem",
                    cursor: busy ? "default" : "pointer",
                }}
            >
                {busy ? "Saving…" : "Finish setup"}
            </button>
        </div>
    );
};

export default IntakeScreen;
