import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authBearerHeaders } from "../apiHeaders";
import ChadPhoto from "../assets/creator_photo.png";
import Sub5Image from "../assets/sub5.png";
import AnagramGame from "./AnagramGame";
import AnagramVictoryCard from "./AnagramVictoryCard";
import ChessChatCard from "./ChessChatCard";
import ChessGame from "./ChessGame";

const ANAGRAM_MSG_PREFIX = "[anagram:v1]";
const CHESS_MSG_PREFIX = "[chess:v1]";
const LS_CHESS_PAUSE = "leanislaw_chess_pause";
const LS_ANAGRAM_PAUSE = "leanislaw_anagram_pause";

function parseAnagramPayload(content) {
    const s = String(content ?? "");
    if (!s.startsWith(ANAGRAM_MSG_PREFIX)) return null;
    try {
        return JSON.parse(s.slice(ANAGRAM_MSG_PREFIX.length));
    } catch {
        return null;
    }
}

function parseChessPayload(content) {
    const s = String(content ?? "");
    if (!s.startsWith(CHESS_MSG_PREFIX)) return null;
    try {
        return JSON.parse(s.slice(CHESS_MSG_PREFIX.length));
    } catch {
        return null;
    }
}

function contentForChatApi(content) {
    const s = String(content ?? "");
    if (s.startsWith(CHESS_MSG_PREFIX)) {
        try {
            const d = JSON.parse(s.slice(CHESS_MSG_PREFIX.length));
            if (d.paused) return "[Chess] Game paused — open Chess to resume.";
            if (d.winner === "white") return "[Chess] You won.";
            if (d.winner === "black") return "[Chess] Chad won.";
            return "[Chess] Draw.";
        } catch {
            return "[Chess] Game update.";
        }
    }
    if (!s.startsWith(ANAGRAM_MSG_PREFIX)) return s;
    try {
        const d = JSON.parse(s.slice(ANAGRAM_MSG_PREFIX.length));
        if (d.paused) return "[Anagrams] Game paused — open Anagrams to resume.";
        const side = d.won ? "You beat Chad" : "Chad won";
        return `[Anagrams] ${side} (${d.youPts ?? 0}–${d.chadPts ?? 0}).`;
    } catch {
        return "[Anagrams] Match finished.";
    }
}

/** iMessage-style mini-apps: prompt games fill the composer; Anagrams opens the mini-game. */
const CHAD_GAMES = [
    { id: "chess", label: "Chess", emoji: "♟️", playable: true },
    {
        id: "wyr",
        label: "Would you rather",
        emoji: "⚖️",
        playable: false,
        prompt: "Would you rather lose 5% on bench in 8 weeks or skip leg day for a month? Pick for me and justify it.",
    },
    { id: "anagrams", label: "Anagrams", emoji: "🔤", playable: true },
];

/** Turn `**like this**` into real bold (OpenAI-style emphasis). */
function renderWithBold(text) {
    const s = String(text ?? "");
    const nodes = [];
    let i = 0;
    let k = 0;
    while (i < s.length) {
        const open = s.indexOf("**", i);
        if (open === -1) {
            if (i < s.length) nodes.push(<span key={`t${k++}`}>{s.slice(i)}</span>);
            break;
        }
        if (open > i) {
            nodes.push(<span key={`t${k++}`}>{s.slice(i, open)}</span>);
        }
        const close = s.indexOf("**", open + 2);
        if (close === -1) {
            nodes.push(<span key={`t${k++}`}>{s.slice(open)}</span>);
            break;
        }
        nodes.push(
            <strong key={`b${k++}`} style={{ fontWeight: 800 }}>
                {s.slice(open + 2, close)}
            </strong>
        );
        i = close + 2;
    }
    return <>{nodes}</>;
}

async function compressImageFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const maxW = 1280;
                let w = img.width;
                let h = img.height;
                if (w > maxW) {
                    h = (h * maxW) / w;
                    w = maxW;
                }
                const canvas = document.createElement("canvas");
                canvas.width = Math.max(1, Math.round(w));
                canvas.height = Math.max(1, Math.round(h));
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
                const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
                if (!m) {
                    reject(new Error("compress failed"));
                    return;
                }
                resolve({ dataUrl, base64: m[2], mime: m[1] });
            };
            img.onerror = () => reject(new Error("image load failed"));
            img.src = reader.result;
        };
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(file);
    });
}

function messagesToApiPayload(msgs) {
    return msgs.map((m) => {
        const base = { role: m.role, content: contentForChatApi(m.content) };
        if (m.role === "user" && m.imageBase64) {
            return { ...base, image_base64: m.imageBase64, image_mime: m.imageMime || "image/jpeg" };
        }
        return base;
    });
}

const CoachChat = () => {
    const navigate = useNavigate();
    const { token } = useAuth();
    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);
    const inputRef = useRef(null);

    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [attachOpen, setAttachOpen] = useState(false);
    const [pendingImage, setPendingImage] = useState(null);
    const [anagramOpen, setAnagramOpen] = useState(false);
    const [anagramResume, setAnagramResume] = useState(null);
    const [chessOpen, setChessOpen] = useState(false);
    const [chessBoot, setChessBoot] = useState(null);
    const [chessSessionKey, setChessSessionKey] = useState(0);
    const [messages, setMessages] = useState([
        {
            role: "assistant",
            content: "Whats up bro?",
        },
    ]);

    const canSend = useMemo(
        () => Boolean(token && (input.trim().length > 0 || pendingImage) && !loading),
        [token, input, pendingImage, loading]
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
                    setMessages(
                        history.map((row) => ({
                            role: row.role,
                            content: row.content,
                            ...(row.created_at ? { created_at: row.created_at } : {}),
                        }))
                    );
                }
            })
            .catch(() => {});
    }, [token]);

    const pickPhoto = () => {
        setAttachOpen(false);
        fileInputRef.current?.click();
    };

    const pickCamera = () => {
        setAttachOpen(false);
        cameraInputRef.current?.click();
    };

    const onFileChange = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file || !file.type.startsWith("image/")) return;
        try {
            const compressed = await compressImageFile(file);
            setPendingImage(compressed);
        } catch {
            setError("Couldn’t use that photo — try another.");
        }
    };

    const chooseGame = (prompt) => {
        setInput(prompt);
        setAttachOpen(false);
        inputRef.current?.focus();
    };

    const pushUserAndFetch = async (nextMsgs) => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/v1/chat", {
                method: "POST",
                headers: { ...authBearerHeaders(token), "Content-Type": "application/json" },
                body: JSON.stringify({ messages: messagesToApiPayload(nextMsgs) }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Chat failed");
            setMessages([...nextMsgs, { role: "assistant", content: data.reply || "..." }]);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const send = async (e) => {
        e?.preventDefault?.();
        if (!canSend) return;
        const caption = input.trim();
        const text = caption || (pendingImage ? "Sent a photo." : "");
        const nextUser = {
            role: "user",
            content: text,
            ...(pendingImage
                ? {
                      imagePreview: pendingImage.dataUrl,
                      imageBase64: pendingImage.base64,
                      imageMime: pendingImage.mime,
                  }
                : {}),
        };
        const nextMsgs = [...messages, nextUser];
        setMessages(nextMsgs);
        setInput("");
        setPendingImage(null);
        await pushUserAndFetch(nextMsgs);
    };

    const appendAssistantStructured = async (content) => {
        if (!token) return;
        const cardMsg = { role: "assistant", content };
        setMessages((prev) => [...prev, cardMsg]);
        try {
            await fetch("/api/v1/chat/append", {
                method: "POST",
                headers: { ...authBearerHeaders(token), "Content-Type": "application/json" },
                body: JSON.stringify({ messages: [{ role: "assistant", content }] }),
            });
        } catch {
            /* offline */
        }
    };

    const handleChessPause = async ({ fen, difficulty }) => {
        try {
            localStorage.setItem(LS_CHESS_PAUSE, JSON.stringify({ fen, difficulty }));
        } catch {
            /* ignore */
        }
        if (!token) return;
        const body = { v: 1, paused: true, difficulty };
        await appendAssistantStructured(`${CHESS_MSG_PREFIX}${JSON.stringify(body)}`);
    };

    const handleChessFinished = async (payload) => {
        if (!token) return;
        try {
            localStorage.removeItem(LS_CHESS_PAUSE);
        } catch {
            /* ignore */
        }
        const body = {
            v: 1,
            paused: false,
            winner: payload.winner,
            resultLabel: payload.resultLabel,
            difficulty: payload.difficulty,
            chadQuote: payload.chadQuote || "",
        };
        await appendAssistantStructured(`${CHESS_MSG_PREFIX}${JSON.stringify(body)}`);
    };

    const handleAnagramPause = async (snap) => {
        try {
            localStorage.setItem(LS_ANAGRAM_PAUSE, JSON.stringify(snap));
        } catch {
            /* ignore */
        }
        if (!token) return;
        const body = { v: 1, paused: true };
        await appendAssistantStructured(`${ANAGRAM_MSG_PREFIX}${JSON.stringify(body)}`);
    };

    const handleAnagramComplete = async (payload) => {
        if (!token) return;
        setAnagramOpen(false);
        setAnagramResume(null);
        try {
            localStorage.removeItem(LS_ANAGRAM_PAUSE);
        } catch {
            /* ignore */
        }
        const body = {
            v: 1,
            won: payload.won,
            youPts: payload.youPoints,
            chadPts: payload.chadPoints,
            youWords: payload.yourWords?.length ?? 0,
            chadWords: payload.chadWords?.length ?? 0,
            quote: payload.chadLine,
            taunts: payload.tauntCount ?? 0,
        };
        const content = `${ANAGRAM_MSG_PREFIX}${JSON.stringify(body)}`;
        const cardMsg = { role: "assistant", content };
        setMessages((prev) => [...prev, cardMsg]);
        try {
            const raw = localStorage.getItem("leanislaw_anagram_stats");
            const prevStats = raw ? JSON.parse(raw) : {};
            const bestScore = Math.max(Number(prevStats.bestScore) || 0, Number(payload.youPoints) || 0);
            const wins = Number(prevStats.wins) || 0;
            const losses = Number(prevStats.losses) || 0;
            localStorage.setItem(
                "leanislaw_anagram_stats",
                JSON.stringify({
                    bestScore,
                    wins: wins + (payload.won ? 1 : 0),
                    losses: losses + (payload.won ? 0 : 1),
                    lastMatch: {
                        at: Date.now(),
                        won: payload.won,
                        youPoints: payload.youPoints,
                        chadPoints: payload.chadPoints,
                        tauntCount: payload.tauntCount ?? 0,
                    },
                })
            );
        } catch {
            /* ignore */
        }
        try {
            await fetch("/api/v1/chat/append", {
                method: "POST",
                headers: { ...authBearerHeaders(token), "Content-Type": "application/json" },
                body: JSON.stringify({ messages: [{ role: "assistant", content }] }),
            });
        } catch {
            /* offline: still in UI */
        }
    };

    return (
        <div style={page}>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFileChange} />
            <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: "none" }}
                onChange={onFileChange}
            />

            <header style={header}>
                <button type="button" style={backBtn} onClick={() => navigate("/dashboard")}>
                    ← Home
                </button>
                <h1 style={title}>Chad Bot</h1>
                <span style={headerSpacer} aria-hidden />
            </header>

            {anagramOpen ? (
                <AnagramGame
                    resumeSnapshot={anagramResume}
                    onPause={handleAnagramPause}
                    onClose={() => {
                        setAnagramOpen(false);
                        setAnagramResume(null);
                    }}
                    onGameComplete={handleAnagramComplete}
                />
            ) : null}
            {chessOpen ? (
                <ChessGame
                    key={chessSessionKey}
                    token={token}
                    initialSnapshot={chessBoot}
                    onPause={handleChessPause}
                    onFinished={handleChessFinished}
                    onClose={() => {
                        setChessOpen(false);
                        setChessBoot(null);
                    }}
                />
            ) : null}

            <div style={chatWrap}>
                {messages.map((m, i) => {
                    const anagram = parseAnagramPayload(m.content);
                    const chess = parseChessPayload(m.content);
                    return (
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
                                {m.imagePreview ? (
                                    <img src={m.imagePreview} alt="" style={bubbleImage} />
                                ) : null}
                                {chess ? (
                                    <ChessChatCard
                                        paused={Boolean(chess.paused)}
                                        winner={chess.winner != null ? String(chess.winner) : ""}
                                        resultLabel={String(chess.resultLabel || "")}
                                        difficulty={String(chess.difficulty || "")}
                                        quote={String(chess.chadQuote || "")}
                                    />
                                ) : anagram ? (
                                    <AnagramVictoryCard
                                        paused={Boolean(anagram.paused)}
                                        won={Boolean(anagram.won)}
                                        youPts={Number(anagram.youPts) || 0}
                                        chadPts={Number(anagram.chadPts) || 0}
                                        quote={String(anagram.quote || "")}
                                    />
                                ) : m.content ? (
                                    <div>{renderWithBold(m.content)}</div>
                                ) : null}
                            </div>
                            {m.role === "user" ? <img src={Sub5Image} alt="Sub-5" style={avatar} /> : null}
                        </div>
                    );
                })}
                {loading ? <div style={typing}>Chad is typing…</div> : null}
                {error ? <div style={err}>{error}</div> : null}
            </div>

            {attachOpen ? (
                <button type="button" style={sheetBackdrop} aria-label="Close menu" onClick={() => setAttachOpen(false)} />
            ) : null}

            <div style={composerOuter}>
                {attachOpen ? (
                    <div style={attachSheet}>
                        <div style={sheetTitle}>More</div>
                        <div style={actionsRow}>
                            <button type="button" style={actionTile} onClick={pickPhoto}>
                                <span style={actionEmoji}>🖼️</span>
                                <span style={actionLabel}>Photos</span>
                            </button>
                            <button type="button" style={actionTile} onClick={pickCamera}>
                                <span style={actionEmoji}>📷</span>
                                <span style={actionLabel}>Camera</span>
                            </button>
                        </div>
                        <div style={gamesHeader}>Games</div>
                        <div style={gamesGrid}>
                            {CHAD_GAMES.map((g) => (
                                <button
                                    key={g.id}
                                    type="button"
                                    style={gameTile}
                                    onClick={() => {
                                        setAttachOpen(false);
                                        if (g.id === "anagrams") {
                                            try {
                                                const raw = localStorage.getItem(LS_ANAGRAM_PAUSE);
                                                setAnagramResume(raw ? JSON.parse(raw) : null);
                                            } catch {
                                                setAnagramResume(null);
                                            }
                                            setAnagramOpen(true);
                                        } else if (g.id === "chess") {
                                            if (!token) {
                                                setError("Log in to play chess.");
                                                return;
                                            }
                                            try {
                                                const raw = localStorage.getItem(LS_CHESS_PAUSE);
                                                setChessBoot(raw ? JSON.parse(raw) : null);
                                            } catch {
                                                setChessBoot(null);
                                            }
                                            setChessSessionKey((k) => k + 1);
                                            setChessOpen(true);
                                        } else chooseGame(g.prompt);
                                    }}
                                >
                                    <span style={gameEmoji}>{g.emoji}</span>
                                    <span style={gameLabel}>{g.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : null}

                {pendingImage ? (
                    <div style={pendingRow}>
                        <img src={pendingImage.dataUrl} alt="" style={pendingThumb} />
                        <button type="button" style={pendingRemove} onClick={() => setPendingImage(null)}>
                            Remove
                        </button>
                    </div>
                ) : null}

                <form onSubmit={send} style={composer}>
                    <button
                        type="button"
                        style={{ ...plusBtn, ...(attachOpen ? plusBtnActive : {}) }}
                        aria-expanded={attachOpen}
                        aria-label="Add photos or games"
                        onClick={() => setAttachOpen((o) => !o)}
                    >
                        +
                    </button>
                    <input
                        ref={inputRef}
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
const bubbleImage = {
    display: "block",
    maxWidth: "100%",
    maxHeight: 200,
    borderRadius: 12,
    marginBottom: 8,
    objectFit: "cover",
};
const typing = { fontSize: "0.78rem", color: "#8e8e93", marginTop: 4 };
const err = { fontSize: "0.82rem", color: "#b45309", background: "#fff8eb", padding: "8px 10px", borderRadius: 10 };

const sheetBackdrop = {
    position: "fixed",
    inset: 0,
    zIndex: 40,
    border: "none",
    padding: 0,
    margin: 0,
    background: "rgba(0,0,0,0.22)",
    cursor: "default",
};

const composerOuter = {
    flexShrink: 0,
    position: "relative",
    zIndex: 50,
    padding: "0 12px calc(74px + env(safe-area-inset-bottom, 0px))",
    borderTop: "0.5px solid #d1d1d6",
    background: "rgba(255,255,255,0.94)",
};

const attachSheet = {
    position: "absolute",
    bottom: "100%",
    left: 0,
    right: 0,
    marginBottom: 8,
    background: "#fff",
    borderRadius: 16,
    boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
    border: "0.5px solid #e5e5ea",
    padding: "14px 14px 12px",
    maxHeight: "min(52vh, 420px)",
    overflowY: "auto",
};

const sheetTitle = {
    fontSize: "0.72rem",
    fontWeight: "700",
    color: "#8e8e93",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginBottom: 10,
};

const actionsRow = {
    display: "flex",
    gap: 10,
    marginBottom: 16,
};

const actionTile = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    padding: "14px 8px",
    borderRadius: 14,
    border: "none",
    background: "#f2f2f7",
    cursor: "pointer",
};

const actionEmoji = { fontSize: "1.75rem", lineHeight: 1 };
const actionLabel = { fontSize: "0.8rem", fontWeight: "650", color: "#1c1c1e" };

const gamesHeader = {
    fontSize: "0.72rem",
    fontWeight: "700",
    color: "#8e8e93",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginBottom: 10,
};

const gamesGrid = {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 10,
};

const gameTile = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    padding: "12px 6px",
    borderRadius: 14,
    border: "none",
    background: "#f2f2f7",
    cursor: "pointer",
};

const gameEmoji = { fontSize: "1.5rem", lineHeight: 1 };
const gameLabel = { fontSize: "0.68rem", fontWeight: "650", color: "#1c1c1e", textAlign: "center" };

const pendingRow = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 0 6px",
};

const pendingThumb = {
    width: 48,
    height: 48,
    borderRadius: 10,
    objectFit: "cover",
    border: "1px solid #d1d1d6",
};

const pendingRemove = {
    border: "none",
    background: "none",
    color: "#ff3b30",
    fontWeight: "600",
    fontSize: "0.85rem",
    cursor: "pointer",
};

const composer = {
    display: "flex",
    gap: 8,
    alignItems: "center",
    paddingTop: 6,
};

const plusBtn = {
    width: 36,
    height: 36,
    flexShrink: 0,
    borderRadius: "50%",
    border: "1px solid #c7c7cc",
    background: "#e5e5ea",
    color: "#1c1c1e",
    fontSize: "1.35rem",
    fontWeight: "400",
    lineHeight: 1,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    paddingBottom: 2,
};

const plusBtnActive = {
    background: "#d1d1d6",
    transform: "rotate(45deg)",
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
