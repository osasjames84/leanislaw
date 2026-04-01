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
        fetch("/api/v1/chat/history", { headers })
            .then((r) => r.json().catch(() => ({})))
            .then((hData) => {
                const history = Array.isArray(hData.messages)
                    ? hData.messages
                          .filter((m) => m?.role === "assistant" || m?.role === "user")
                          .map((m) => ({
                              role: m.role,
                              content: String(m.content || "").trim(),
                          }))
                          .filter((m) => m.content.length > 0)
                    : [];
                if (history.length) {
                    setMessages(history);
                }
            })
            .catch(() => {});
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

    return (
        <div style={page}>
            <header style={header}>
                <button type="button" style={backBtn} onClick={() => navigate("/dashboard")}>
                    ← Home
                </button>
                <h1 style={title}>Chad Bot</h1>
                <span style={headerSpacer} aria-hidden />
            </header>

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
                        {m.role === "user" ? <img src={Sub5Image} alt="Sub-5" style={avatar} /> : null}
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
        </div>
    );
};

const page = {
    position: "fixed",
    inset: 0,
    height: "100dvh",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    background: "#f2f2f7",
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
};
const header = {
    flexShrink: 0,
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
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
    justifySelf: "start",
};
const title = { margin: 0, fontSize: "1.05rem", fontWeight: "800", gridColumn: 2 };
const headerSpacer = { gridColumn: 3, width: 48 };
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
    flexShrink: 0,
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

export default CoachChat;
