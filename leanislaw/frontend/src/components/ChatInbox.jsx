import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authBearerHeaders } from "../apiHeaders";
import ChadPhoto from "../assets/creator_photo.png";
import { formatShortTime, displayNameFriend } from "../lib/formatChatTime";

/** Filled bubble (new / you sent) vs outline (last from them) — iOS blue + gray stroke. */
function ChatBubbleIcon({ variant }) {
    if (variant === "outline") {
        return (
            <svg width={16} height={16} viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0 }}>
                <path
                    fill="none"
                    stroke="#8e8e93"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8.5z"
                />
            </svg>
        );
    }
    return (
        <svg width={16} height={16} viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0 }}>
            <path
                fill="#007aff"
                d="M20 2H4a2 2 0 00-2 2v18l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2zm-3 9H7V9h10v2zm0-3H7V6h10v2z"
            />
        </svg>
    );
}

export default function ChatInbox() {
    const navigate = useNavigate();
    const { token } = useAuth();
    const [friends, setFriends] = useState([]);
    const [dmSummaries, setDmSummaries] = useState([]);
    const [chadPreview, setChadPreview] = useState(null);
    const [loadError, setLoadError] = useState("");
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        if (!token) {
            setFriends([]);
            setDmSummaries([]);
            setChadPreview(null);
            setLoading(false);
            return;
        }
        setLoadError("");
        setLoading(true);
        const headers = authBearerHeaders(token);
        try {
            const [frRes, sumRes, prevRes] = await Promise.all([
                fetch("/api/v1/social/friends", { headers }),
                fetch("/api/v1/social/dm/summaries", { headers }),
                fetch("/api/v1/chat/preview", { headers }),
            ]);
            const frData = await frRes.json().catch(() => []);
            const sumData = await sumRes.json().catch(() => []);
            const prevData = await prevRes.json().catch(() => ({}));

            if (!frRes.ok) {
                setLoadError(typeof frData?.error === "string" ? frData.error : "Could not load friends.");
                setFriends([]);
            } else {
                setFriends(Array.isArray(frData) ? frData : []);
            }
            if (!sumRes.ok) {
                setDmSummaries([]);
            } else {
                setDmSummaries(Array.isArray(sumData) ? sumData : []);
            }
            if (prevRes.ok && prevData?.preview) {
                setChadPreview(prevData);
            } else {
                setChadPreview(null);
            }
        } catch {
            setLoadError("Couldn’t load chats.");
            setFriends([]);
            setDmSummaries([]);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        void load();
    }, [load]);

    const summaryByPeer = useMemo(() => {
        const m = new Map();
        for (const s of dmSummaries) {
            if (s?.peer_id != null) m.set(s.peer_id, s);
        }
        return m;
    }, [dmSummaries]);

    const sortedFriends = useMemo(() => {
        const list = [...friends];
        list.sort((a, b) => {
            const sa = summaryByPeer.get(a.id);
            const sb = summaryByPeer.get(b.id);
            const ta = sa?.last_at ? new Date(sa.last_at).getTime() : 0;
            const tb = sb?.last_at ? new Date(sb.last_at).getTime() : 0;
            if (tb !== ta) return tb - ta;
            return displayNameFriend(a).localeCompare(displayNameFriend(b), undefined, { sensitivity: "base" });
        });
        return list;
    }, [friends, summaryByPeer]);

    const chadActive =
        chadPreview?.last_at &&
        Date.now() - new Date(chadPreview.last_at).getTime() < 5 * 60 * 1000;

    const chadStatus = useMemo(() => {
        if (!chadPreview?.preview) {
            return {
                bubble: "accent",
                text: "New chat · Training, diet, and games",
                time: "",
            };
        }
        const short = formatShortTime(chadPreview.last_at);
        const snippet =
            chadPreview.preview.length > 42 ? `${chadPreview.preview.slice(0, 40)}…` : chadPreview.preview;
        if (chadPreview.last_from_me) {
            return {
                bubble: "filled",
                text: `You: ${snippet}`,
                time: short,
            };
        }
        return {
            bubble: "outline",
            text: snippet,
            time: short,
        };
    }, [chadPreview]);

    const friendStatus = (f) => {
        const s = summaryByPeer.get(f.id);
        if (!s?.preview) {
            return {
                bubble: "accent",
                text: "New chat · Say hey",
                time: "",
            };
        }
        const short = formatShortTime(s.last_at);
        const snippet = s.preview.length > 44 ? `${s.preview.slice(0, 42)}…` : s.preview;
        if (s.from_me) {
            return {
                bubble: "filled",
                text: `You: ${snippet}`,
                time: short,
            };
        }
        return {
            bubble: "outline",
            text: snippet,
            time: short,
        };
    };

    return (
        <div style={page}>
            <header style={topBar}>
                <button type="button" style={backBtn} onClick={() => navigate("/dashboard")}>
                    ← Back
                </button>
                <h1 style={pageTitle}>Chads</h1>
                <span style={headerSpacer} aria-hidden />
            </header>

            {loadError ? (
                <div style={errorWrap}>
                    <div style={errBox}>{loadError}</div>
                </div>
            ) : null}

            <div style={listCard}>
                {loading ? <p style={muted}>Loading…</p> : null}

                <button
                    type="button"
                    style={{
                        ...rowBtn,
                        ...(sortedFriends.length === 0 ? rowBtnLast : {}),
                    }}
                    onClick={() => navigate("/chat/chad")}
                    aria-label="Open Chad Bot"
                >
                    <div style={avatarWrap}>
                        <img src={ChadPhoto} alt="" style={avatar} />
                        {chadActive ? <span style={onlineDot} aria-hidden /> : null}
                    </div>
                    <div style={textCol}>
                        <div style={nameLine}>Chad Bot</div>
                        <div style={statusRow}>
                            <ChatBubbleIcon variant={chadStatus.bubble} />
                            <span style={statusText}>{chadStatus.text}</span>
                            {chadStatus.time ? (
                                <>
                                    <span style={statusSep}>·</span>
                                    <span style={statusTime}>{chadStatus.time}</span>
                                </>
                            ) : null}
                        </div>
                    </div>
                </button>

                {sortedFriends.map((f, idx) => {
                    const st = friendStatus(f);
                    return (
                        <button
                            key={f.id}
                            type="button"
                            style={{
                                ...rowBtn,
                                ...(idx === sortedFriends.length - 1 ? rowBtnLast : {}),
                            }}
                            onClick={() => navigate(`/chat/friend/${f.id}`)}
                            aria-label={`Open chat with ${displayNameFriend(f)}`}
                        >
                            <div style={avatarWrap}>
                                <img src={f.avatar_url || "/sub5.png"} alt="" style={avatar} />
                            </div>
                            <div style={textCol}>
                                <div style={nameLine}>{displayNameFriend(f)}</div>
                                <div style={statusRow}>
                                    <ChatBubbleIcon variant={st.bubble} />
                                    <span style={statusText}>{st.text}</span>
                                    {st.time ? (
                                        <>
                                            <span style={statusSep}>·</span>
                                            <span style={statusTime}>{st.time}</span>
                                        </>
                                    ) : null}
                                </div>
                            </div>
                        </button>
                    );
                })}

                {!loading && friends.length === 0 ? (
                    <p style={emptyHint}>Add friends from Profile to message them here.</p>
                ) : null}
            </div>
        </div>
    );
}

const page = {
    minHeight: "100vh",
    background: "#f2f2f7",
    paddingBottom: "calc(48px + 62px + env(safe-area-inset-bottom, 0px))",
    fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
};

const topBar = {
    position: "sticky",
    top: 0,
    zIndex: 99,
    flexShrink: 0,
    /* Extra space under notch / Dynamic Island; min when env() is 0 in some WebViews */
    paddingTop: "max(44px, calc(env(safe-area-inset-top, 0px) + 18px))",
    paddingBottom: "12px",
    paddingLeft: "max(12px, env(safe-area-inset-left, 0px))",
    paddingRight: "max(12px, env(safe-area-inset-right, 0px))",
    background: "#fff",
    borderBottom: "0.5px solid #d1d1d6",
    display: "grid",
    gridTemplateColumns: "minmax(72px, 1fr) auto minmax(72px, 1fr)",
    alignItems: "center",
    boxSizing: "border-box",
};

const backBtn = {
    border: "none",
    background: "none",
    color: "#007aff",
    fontWeight: 600,
    fontSize: "1rem",
    cursor: "pointer",
    padding: "4px 0",
    justifySelf: "start",
    gridColumn: 1,
};

const pageTitle = {
    margin: 0,
    fontSize: "1.1rem",
    fontWeight: 800,
    color: "#000",
    gridColumn: 2,
    justifySelf: "center",
    textAlign: "center",
};

const headerSpacer = { gridColumn: 3, justifySelf: "end" };

const errorWrap = { margin: "0 0 12px", padding: "0 16px", boxSizing: "border-box" };

const errBox = {
    background: "#ffecec",
    color: "#c00",
    padding: "10px 12px",
    borderRadius: 10,
    fontSize: 14,
};

const listCard = {
    background: "#fff",
    margin: 0,
    padding: 0,
    borderRadius: 0,
    boxShadow: "none",
    boxSizing: "border-box",
};

const muted = { color: "#8e8e93", padding: "16px 16px", margin: 0, fontSize: "0.95rem" };

const emptyHint = {
    color: "#8e8e93",
    padding: "12px 16px 16px",
    margin: 0,
    fontSize: "0.9rem",
    lineHeight: 1.45,
};

const rowBtn = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    padding: "12px 16px",
    border: "none",
    borderBottom: "0.5px solid #e5e5ea",
    background: "transparent",
    cursor: "pointer",
    textAlign: "left",
    color: "inherit",
    boxSizing: "border-box",
};

const rowBtnLast = {
    borderBottom: "none",
};

const avatarWrap = {
    position: "relative",
    width: 56,
    height: 56,
    flexShrink: 0,
};

const avatar = {
    width: 56,
    height: 56,
    borderRadius: "50%",
    objectFit: "cover",
    background: "#f2f2f7",
    border: "1px solid #d1d1d6",
    display: "block",
};

const onlineDot = {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: "50%",
    background: "#34c759",
    border: "2px solid #fff",
    boxSizing: "border-box",
};

const textCol = { flex: 1, minWidth: 0 };

const nameLine = {
    fontSize: "1rem",
    fontWeight: 700,
    color: "#000",
    marginBottom: 4,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

const statusRow = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    fontSize: "0.88rem",
    lineHeight: 1.25,
};

const statusText = {
    color: "#3a3a3c",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
    flex: 1,
};

const statusSep = {
    color: "#c7c7cc",
    flexShrink: 0,
};

const statusTime = {
    color: "#8e8e93",
    flexShrink: 0,
};
