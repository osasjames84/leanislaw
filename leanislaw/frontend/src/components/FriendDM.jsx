import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authBearerHeaders } from "../apiHeaders";
import { userAvatarUrl } from "../lib/userAvatar";
import { displayNameFriend } from "../lib/formatChatTime";

export default function FriendDM() {
    const { friendId: friendIdParam } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { token, user } = useAuth();
    const inputRef = useRef(null);
    const bottomRef = useRef(null);

    const friendId = Number(friendIdParam);
    const validId = Number.isInteger(friendId) && friendId >= 1;

    const [peer, setPeer] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");

    const loadPeer = useCallback(async () => {
        if (!token || !validId) return;
        try {
            const res = await fetch(`/api/v1/social/lookup/${friendId}`, {
                headers: authBearerHeaders(token),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data.error || "Could not load user.");
                setPeer(null);
                return;
            }
            setPeer(data);
        } catch {
            setError("Could not load user.");
            setPeer(null);
        }
    }, [token, friendId, validId]);

    const loadMessages = useCallback(async () => {
        if (!token || !validId) return;
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`/api/v1/social/dm/${friendId}/messages`, {
                headers: authBearerHeaders(token),
            });
            const data = await res.json().catch(() => ({}));
            if (res.status === 403) {
                setError(data.error || "You can only message friends.");
                setMessages([]);
                return;
            }
            if (!res.ok) {
                setError(data.error || "Could not load messages.");
                setMessages([]);
                return;
            }
            setMessages(Array.isArray(data.messages) ? data.messages : []);
        } catch {
            setError("Could not load messages.");
            setMessages([]);
        } finally {
            setLoading(false);
        }
    }, [token, friendId, validId]);

    useEffect(() => {
        void loadPeer();
    }, [loadPeer]);

    useEffect(() => {
        void loadMessages();
    }, [loadMessages]);

    useEffect(() => {
        if (location.state?.openAttach) {
            inputRef.current?.focus();
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.pathname, location.state, navigate]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages.length, loading]);

    const send = async (e) => {
        e?.preventDefault?.();
        const text = input.trim();
        if (!text || !token || !validId || sending) return;
        setSending(true);
        setError("");
        try {
            const res = await fetch(`/api/v1/social/dm/${friendId}`, {
                method: "POST",
                headers: { ...authBearerHeaders(token), "Content-Type": "application/json" },
                body: JSON.stringify({ content: text }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data.error || "Could not send.");
                setSending(false);
                return;
            }
            setInput("");
            setMessages((prev) => [...prev, data]);
        } catch {
            setError("Could not send.");
        } finally {
            setSending(false);
        }
    };

    if (!validId) {
        return (
            <div style={page}>
                <header style={header}>
                    <button type="button" style={backBtn} onClick={() => navigate("/chat")}>
                        ← Chats
                    </button>
                    <h1 style={title}>Chat</h1>
                    <span style={headerSpacer} />
                </header>
                <p style={{ padding: 16, color: "#8e8e93" }}>Invalid chat.</p>
            </div>
        );
    }

    const peerName = displayNameFriend(peer);
    const peerAvatar = peer?.avatar_url || "/sub5.png";
    const myId = user?.id;

    return (
        <div style={page}>
            <header style={header}>
                <button type="button" style={backBtn} onClick={() => navigate("/chat")}>
                    ← Chats
                </button>
                <div style={headerCenter}>
                    <img src={peerAvatar} alt="" style={headerAvatar} />
                    <h1 style={title}>{peer ? peerName : "…"}</h1>
                </div>
                <span style={headerSpacer} />
            </header>

            <div style={chatWrap}>
                {loading ? <p style={hint}>Loading…</p> : null}
                {error ? <div style={err}>{error}</div> : null}
                {messages.map((m) => {
                    const mine = myId != null && m.sender_id === myId;
                    return (
                        <div
                            key={m.id}
                            style={{
                                ...msgRow,
                                ...(mine ? msgRowUser : msgRowPeer),
                            }}
                        >
                            {!mine ? <img src={peerAvatar} alt="" style={avatar} /> : null}
                            <div style={{ ...bubble, ...(mine ? bubbleUser : bubblePeer) }}>{m.content}</div>
                            {mine ? <img src={userAvatarUrl(user)} alt="" style={avatar} /> : null}
                        </div>
                    );
                })}
                <div ref={bottomRef} />
            </div>

            <div style={composerOuter}>
                <form onSubmit={send} style={composer}>
                    <input
                        ref={inputRef}
                        style={inputStyle}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Message…"
                        maxLength={4000}
                    />
                    <button type="submit" style={sendBtn} disabled={sending || !input.trim()}>
                        Send
                    </button>
                </form>
            </div>
        </div>
    );
}

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
    padding: "calc(10px + env(safe-area-inset-top, 0px)) 12px 10px",
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

const headerCenter = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    maxWidth: "70vw",
};

const headerAvatar = {
    width: 36,
    height: 36,
    borderRadius: "50%",
    objectFit: "cover",
    border: "1px solid #d1d1d6",
};

const title = {
    margin: 0,
    fontSize: "0.95rem",
    fontWeight: 800,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

const headerSpacer = { gridColumn: 3, width: 48 };

const chatWrap = {
    flex: 1,
    overflowY: "auto",
    padding: "14px 12px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
};

const hint = { fontSize: "0.85rem", color: "#8e8e93", margin: 0 };

const err = {
    fontSize: "0.82rem",
    color: "#b45309",
    background: "#fff8eb",
    padding: "8px 10px",
    borderRadius: 10,
};

const msgRow = {
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
};

const msgRowPeer = { justifyContent: "flex-start" };
const msgRowUser = { justifyContent: "flex-end" };

const avatar = {
    width: 30,
    height: 30,
    borderRadius: "50%",
    objectFit: "cover",
    border: "1px solid #d1d1d6",
    flexShrink: 0,
    background: "#fff",
};

const bubble = {
    maxWidth: "78%",
    borderRadius: 18,
    padding: "10px 12px",
    lineHeight: 1.35,
    fontSize: "0.92rem",
    whiteSpace: "pre-wrap",
};

const bubblePeer = { background: "#fff", border: "1px solid #e5e5ea" };
const bubbleUser = { background: "#007aff", color: "#fff" };

const composerOuter = {
    flexShrink: 0,
    padding: "0 12px calc(74px + env(safe-area-inset-bottom, 0px))",
    borderTop: "0.5px solid #d1d1d6",
    background: "rgba(255,255,255,0.94)",
};

const composer = { display: "flex", gap: 8, alignItems: "center", paddingTop: 8 };

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
    fontWeight: 700,
    cursor: "pointer",
};
