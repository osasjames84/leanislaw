import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authBearerHeaders, authJsonHeaders } from "../apiHeaders";

const ADH = {
    on_track: { label: "On track", color: "#30a46c" },
    slightly_off: { label: "A bit off", color: "#f5a623" },
    off_track: { label: "Off track", color: "#e5484d" },
    no_data: { label: "No data yet", color: "#8e8e93" },
};

const card = {
    background: "#fff",
    borderRadius: 16,
    padding: 18,
    border: "0.5px solid #e5e5ea",
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
    marginBottom: 14,
};

function Pill({ status }) {
    const a = ADH[status] || ADH.no_data;
    return (
        <span style={{ background: `${a.color}22`, color: a.color, borderRadius: 999, padding: "3px 10px", fontSize: "0.78rem", fontWeight: 700 }}>
            {a.label}
        </span>
    );
}

const MyWeek = () => {
    const navigate = useNavigate();
    const { token } = useAuth();
    const [data, setData] = useState(null);
    const [form, setForm] = useState({ sleep_h: "", energy_1to5: "", stress_1to5: "", notes: "" });
    const [saved, setSaved] = useState(false);
    const [err, setErr] = useState("");

    const load = useCallback(async () => {
        try {
            const r = await fetch("/api/v1/safeguarding/my-week", { headers: authBearerHeaders(token) });
            const d = await r.json();
            if (d.error) setErr(d.error);
            else setData(d);
        } catch {
            setErr("Could not load your week.");
        }
    }, [token]);

    useEffect(() => {
        if (token) load();
    }, [token, load]);

    const submitCheckin = async () => {
        setErr("");
        try {
            const body = {};
            for (const k of ["sleep_h", "energy_1to5", "stress_1to5"]) {
                if (form[k] !== "") body[k] = Number(form[k]);
            }
            if (form.notes) body.notes = form.notes;
            const r = await fetch("/api/v1/safeguarding/checkin", {
                method: "POST",
                headers: authJsonHeaders(token),
                body: JSON.stringify(body),
            });
            const d = await r.json();
            if (d.error) setErr(d.error);
            else {
                setSaved(true);
                setTimeout(() => setSaved(false), 2500);
            }
        } catch {
            setErr("Could not save your check-in.");
        }
    };

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
                onClick={() => navigate("/dashboard")}
                style={{ border: "none", background: "none", color: "#007aff", fontWeight: 700, cursor: "pointer", padding: 0 }}
            >
                ← Dashboard
            </button>
            <h1 style={{ margin: "12px 0 2px", fontSize: "1.5rem", fontWeight: 800 }}>My week</h1>
            <p style={{ margin: "0 0 14px", color: "#8e8e93", fontSize: "0.9rem" }}>
                {data?.week_start ? `${data.week_start} → ${data.week_end}` : "Loading…"}
            </p>

            {err ? <div style={{ ...card, color: "#b42318" }}>{err}</div> : null}

            {data?.has_report ? (
                <div style={card}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
                        <span style={{ color: "#1c1c1e", fontWeight: 600 }}>Training</span>
                        <span>
                            {!data.hide_raw_numbers && data.training.assigned != null ? (
                                <span style={{ color: "#8e8e93", marginRight: 8, fontSize: "0.85rem" }}>
                                    {data.training.completed}/{data.training.assigned}
                                </span>
                            ) : null}
                            <Pill status={data.training.status} />
                        </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderTop: "1px solid #f0f0f3" }}>
                        <span style={{ color: "#1c1c1e", fontWeight: 600 }}>Nutrition logging</span>
                        <span>
                            {!data.hide_raw_numbers && data.nutrition_logging.logged_days != null ? (
                                <span style={{ color: "#8e8e93", marginRight: 8, fontSize: "0.85rem" }}>
                                    {data.nutrition_logging.logged_days}/{data.nutrition_logging.target_days} days
                                </span>
                            ) : null}
                            <Pill status={data.nutrition_logging.status} />
                        </span>
                    </div>
                    <p style={{ margin: "12px 0 0", color: "#636366", fontSize: "0.85rem", lineHeight: 1.45 }}>
                        {data.message}
                    </p>
                </div>
            ) : data ? (
                <div style={card}>
                    <p style={{ margin: 0, color: "#636366", lineHeight: 1.45 }}>{data.message}</p>
                </div>
            ) : null}

            <div style={card}>
                <h2 style={{ margin: "0 0 4px", fontSize: "1.05rem", fontWeight: 800 }}>Weekly check-in</h2>
                <p style={{ margin: "0 0 12px", color: "#8e8e93", fontSize: "0.82rem" }}>
                    How was your week? This goes straight to your coach.
                </p>
                {[
                    { k: "sleep_h", label: "Avg sleep (hours)", min: 0, max: 24, step: 0.5 },
                    { k: "energy_1to5", label: "Energy (1–5)", min: 1, max: 5, step: 1 },
                    { k: "stress_1to5", label: "Stress (1–5)", min: 1, max: 5, step: 1 },
                ].map((f) => (
                    <label key={f.k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
                        <span style={{ fontSize: "0.9rem", color: "#1c1c1e" }}>{f.label}</span>
                        <input
                            type="number"
                            min={f.min}
                            max={f.max}
                            step={f.step}
                            value={form[f.k]}
                            onChange={(e) => setForm((s) => ({ ...s, [f.k]: e.target.value }))}
                            style={{ width: 80, padding: 8, borderRadius: 10, border: "1px solid #d1d1d6" }}
                        />
                    </label>
                ))}
                <textarea
                    value={form.notes}
                    onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                    rows={3}
                    placeholder="Anything you want your coach to know…"
                    style={{ width: "100%", marginTop: 8, padding: 10, borderRadius: 10, border: "1px solid #d1d1d6", fontFamily: "inherit", resize: "vertical" }}
                />
                <button
                    type="button"
                    onClick={submitCheckin}
                    style={{
                        width: "100%",
                        marginTop: 12,
                        padding: 13,
                        borderRadius: 12,
                        border: "none",
                        background: saved ? "#30a46c" : "#007aff",
                        color: "#fff",
                        fontWeight: 700,
                        cursor: "pointer",
                    }}
                >
                    {saved ? "Saved ✓" : "Submit check-in"}
                </button>
            </div>
        </div>
    );
};

export default MyWeek;
