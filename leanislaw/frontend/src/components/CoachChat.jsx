import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authBearerHeaders } from "../apiHeaders";
import ChadPhoto from "../assets/creator_photo.png";
import Sub5Image from "../assets/sub5.png";

const CoachChat = () => {
    const navigate = useNavigate();
    const { token } = useAuth();
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [showTraining, setShowTraining] = useState(false);
    const [trainingQuestions, setTrainingQuestions] = useState([]);
    const [trainingAnswers, setTrainingAnswers] = useState([]);
    const [qIdx, setQIdx] = useState(0);
    const [savingTraining, setSavingTraining] = useState(false);
    const [messages, setMessages] = useState([
        {
            role: "assistant",
            content: "Whats up bro?",
        },
    ]);

    const canSend = useMemo(
        () => Boolean(token && input.trim().length > 0 && !loading),
        [token, input, loading]
    );

    useEffect(() => {
        if (!token) return;
        const headers = authBearerHeaders(token);
        Promise.all([
            fetch("/api/v1/chat/training/questions", { headers }).then((r) => r.json().catch(() => ({}))),
            fetch("/api/v1/chat/training", { headers }).then((r) => r.json().catch(() => ({}))),
        ])
            .then(([qData, aData]) => {
                const qs = Array.isArray(qData.questions) ? qData.questions : [];
                const saved = Array.isArray(aData.answers) ? aData.answers : [];
                setTrainingQuestions(qs);
                const merged = qs.map((q, i) => ({
                    question: q,
                    answer: String(saved[i]?.answer || ""),
                }));
                setTrainingAnswers(merged);
            })
            .catch(() => {
                setTrainingQuestions([]);
                setTrainingAnswers([]);
            });
    }, [token]);

    const send = async (e) => {
        e?.preventDefault?.();
        if (!canSend) return;
        const nextUser = { role: "user", content: input.trim() };
        const nextMsgs = [...messages, nextUser];
        setMessages(nextMsgs);
        setInput("");
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/v1/chat", {
                method: "POST",
                headers: { ...authBearerHeaders(token), "Content-Type": "application/json" },
                body: JSON.stringify({ messages: nextMsgs }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Chat failed");
            setMessages((prev) => [...prev, { role: "assistant", content: data.reply || "..." }]);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const saveTraining = async () => {
        if (!token) return;
        setSavingTraining(true);
        setError("");
        try {
            const res = await fetch("/api/v1/chat/training", {
                method: "PUT",
                headers: { ...authBearerHeaders(token), "Content-Type": "application/json" },
                body: JSON.stringify({ answers: trainingAnswers }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Could not save training");
            setShowTraining(false);
        } catch (err) {
            setError(err.message);
        } finally {
            setSavingTraining(false);
        }
    };

    return (
        <div style={page}>
            <header style={header}>
                <button type="button" style={backBtn} onClick={() => navigate("/dashboard")}>
                    ← Home
                </button>
                <h1 style={title}>Chad Bot</h1>
                <button type="button" style={trainBtn} onClick={() => setShowTraining((v) => !v)}>
                    {showTraining ? "Chat" : "Train"}
                </button>
            </header>

            {showTraining ? (
                <div style={trainingWrap}>
                    <p style={trainingHead}>
                        Train Chad Bot in your exact coaching voice ({qIdx + 1}/{Math.max(1, trainingQuestions.length)})
                    </p>
                    <p style={trainingQuestion}>{trainingQuestions[qIdx] || "No question loaded."}</p>
                    <textarea
                        style={trainingInput}
                        value={trainingAnswers[qIdx]?.answer || ""}
                        onChange={(e) =>
                            setTrainingAnswers((prev) =>
                                prev.map((row, i) => (i === qIdx ? { ...row, answer: e.target.value } : row))
                            )
                        }
                        placeholder="Write how YOU would answer this..."
                    />
                    <div style={trainingActions}>
                        <button
                            type="button"
                            style={ghostBtn}
                            disabled={qIdx === 0}
                            onClick={() => setQIdx((i) => Math.max(0, i - 1))}
                        >
                            Prev
                        </button>
                        <button
                            type="button"
                            style={ghostBtn}
                            disabled={qIdx >= trainingQuestions.length - 1}
                            onClick={() =>
                                setQIdx((i) => Math.min(Math.max(0, trainingQuestions.length - 1), i + 1))
                            }
                        >
                            Next
                        </button>
                        <button type="button" style={saveBtn} onClick={saveTraining} disabled={savingTraining}>
                            {savingTraining ? "Saving..." : "Save Training"}
                        </button>
                    </div>
                    {error ? <div style={err}>{error}</div> : null}
                </div>
            ) : (
                <>
                    <div style={chatWrap}>
                        {messages.map((m, i) => (
                            <div
                                key={`${m.role}-${i}`}
                                style={{
                                    ...msgRow,
                                    ...(m.role === "user" ? msgRowUser : msgRowAssistant),
                                }}
                            >
                                {m.role === "assistant" ? (
                                    <img src={ChadPhoto} alt="Chad Bot" style={avatar} />
                                ) : null}
                                <div
                                    style={{
                                        ...bubble,
                                        ...(m.role === "user" ? bubbleUser : bubbleAssistant),
                                    }}
                                >
                                    {m.content}
                                </div>
                                {m.role === "user" ? (
                                    <img src={Sub5Image} alt="Sub-5" style={avatar} />
                                ) : null}
                            </div>
                        ))}
                        {loading ? <div style={typing}>Chad is typing…</div> : null}
                        {error ? <div style={err}>{error}</div> : null}
                    </div>

                    <form onSubmit={send} style={composer}>
                        <input
                            style={inputStyle}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask Chad Bot…"
                        />
                        <button type="submit" style={{ ...sendBtn, opacity: canSend ? 1 : 0.55 }} disabled={!canSend}>
                            Send
                        </button>
                    </form>
                </>
            )}
        </div>
    );
};

const page = {
    height: "100dvh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    background: "#f2f2f7",
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
};
const header = {
    position: "sticky",
    top: 0,
    zIndex: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 12px",
    borderBottom: "0.5px solid #d1d1d6",
    background: "#fff",
};
const backBtn = {
    border: "none",
    background: "none",
    color: "#007aff",
    fontWeight: "700",
    fontSize: "0.95rem",
    cursor: "pointer",
};
const title = { margin: 0, fontSize: "1.05rem", fontWeight: "800" };
const trainBtn = {
    border: "none",
    background: "none",
    color: "#007aff",
    fontWeight: "700",
    fontSize: "0.9rem",
    cursor: "pointer",
};
const chatWrap = {
    flex: 1,
    overflowY: "auto",
    padding: "14px 12px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
};
const msgRow = {
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
};
const msgRowAssistant = { justifyContent: "flex-start" };
const msgRowUser = { justifyContent: "flex-end" };
const avatar = {
    width: 30,
    height: 30,
    borderRadius: "50%",
    objectFit: "cover",
    border: "1px solid #d1d1d6",
    background: "#fff",
    flexShrink: 0,
};
const bubble = {
    maxWidth: "78%",
    borderRadius: 18,
    padding: "10px 12px",
    lineHeight: 1.35,
    fontSize: "0.92rem",
    whiteSpace: "pre-wrap",
};
const bubbleAssistant = { alignSelf: "flex-start", background: "#fff", border: "1px solid #e5e5ea" };
const bubbleUser = { alignSelf: "flex-end", background: "#007aff", color: "#fff" };
const typing = { fontSize: "0.78rem", color: "#8e8e93", marginTop: 4 };
const err = { fontSize: "0.82rem", color: "#b45309", background: "#fff8eb", padding: "8px 10px", borderRadius: 10 };
const composer = {
    position: "sticky",
    bottom: 0,
    zIndex: 10,
    // Keep input bar above fixed bottom nav.
    padding: "10px 12px calc(74px + env(safe-area-inset-bottom, 0px))",
    borderTop: "0.5px solid #d1d1d6",
    background: "rgba(255,255,255,0.94)",
    display: "flex",
    gap: 8,
};
const inputStyle = {
    flex: 1,
    border: "1px solid #d1d1d6",
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: "0.95rem",
    background: "#fff",
};
const sendBtn = {
    border: "none",
    borderRadius: 12,
    padding: "10px 14px",
    background: "#000",
    color: "#fff",
    fontWeight: "700",
    cursor: "pointer",
};
const trainingWrap = {
    flex: 1,
    overflowY: "auto",
    padding: "14px 12px calc(74px + env(safe-area-inset-bottom, 0px))",
    display: "flex",
    flexDirection: "column",
    gap: 10,
};
const trainingHead = { margin: 0, fontSize: "0.8rem", color: "#636366", fontWeight: "700" };
const trainingQuestion = { margin: 0, fontSize: "1rem", fontWeight: "800", color: "#000" };
const trainingInput = {
    width: "100%",
    minHeight: 170,
    boxSizing: "border-box",
    border: "1px solid #d1d1d6",
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: "0.95rem",
    resize: "vertical",
    background: "#fff",
};
const trainingActions = { display: "flex", gap: 8, marginTop: 6 };
const ghostBtn = {
    border: "1px solid #d1d1d6",
    background: "#fff",
    borderRadius: 10,
    padding: "10px 12px",
    fontWeight: "700",
    cursor: "pointer",
};
const saveBtn = {
    marginLeft: "auto",
    border: "none",
    background: "#000",
    color: "#fff",
    borderRadius: 10,
    padding: "10px 14px",
    fontWeight: "700",
    cursor: "pointer",
};

export default CoachChat;

