import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authBearerHeaders } from "../apiHeaders";
import ChadPhoto from "../assets/creator_photo.png";
import { formatSentAgo, displayNameFriend } from "../lib/formatChatTime";

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

    const chadSubtitle = useMemo(() => {
        if (!chadPreview?.preview) {
            return "Message Chad Bot — training, diet, games";
        }
        const you = chadPreview.last_from_me ? "You: " : "";
        const time = formatSentAgo(chadPreview.last_at);
        return `${you}${chadPreview.preview}${time ? ` · ${time}` : ""}`;
    }, [chadPreview]);

    const friendSubtitle = (f) => {
        const s = summaryByPeer.get(f.id);
        if (!s?.preview) return "Tap to message";
        const prefix = s.from_me ? "You: " : "";
        const time = formatSentAgo(s.last_at);
        return `${prefix}${s.preview}${time ? ` · ${time}` : ""}`;
    };

    const goChad = (_e, opts = {}) => {
        navigate("/chat/chad", { state: opts.openAttach ? { openAttach: true } : undefined });
    };

    const goFriend = (f, openAttach) => {
        navigate(`/chat/friend/${f.id}`, { state: openAttach ? { openAttach: true } : undefined });
    };

    return (
        <div style={page}>
            <header style={header}>
                <h1 style={title}>Chats</h1>
            </header>

            {loadError ? <div style={errBanner}>{loadError}</div> : null}

            <div style={listWrap}>
                {loading ? <p style={muted}>Loading…</p> : null}

                <div style={rowOuter}>
                    <button type="button" style={rowMain} onClick={() => goChad()} aria-label="Open Chad Bot">
                        <div style={avatarWrap}>
                            <img src={ChadPhoto} alt="" style={avatar} />
                            {chadActive ? <span style={onlineDot} aria-hidden /> : null}
                        </div>
                        <div style={textCol}>
                            <div style={nameLine}>Chad Bot</div>
                            <div style={subLine}>{chadSubtitle}</div>
                        </div>
                    </button>
                    <button
                        type="button"
                        style={camBtn}
                        aria-label="Open Chad Bot composer"
                        onClick={() => goChad(null, { openAttach: true })}
                    >
                        <CameraIcon />
                    </button>
                </div>

                {sortedFriends.map((f) => (
                    <div key={f.id} style={rowOuter}>
                        <button
                            type="button"
                            style={rowMain}
                            onClick={() => goFriend(f, false)}
                            aria-label={`Open chat with ${displayNameFriend(f)}`}
                        >
                            <div style={avatarWrap}>
                                <img src={f.avatar_url || "/sub5.png"} alt="" style={avatar} />
                            </div>
                            <div style={textCol}>
                                <div style={nameLine}>{displayNameFriend(f)}</div>
                                <div style={subLine}>{friendSubtitle(f)}</div>
                            </div>
                        </button>
                        <button
                            type="button"
                            style={camBtn}
                            aria-label="Open chat composer"
                            onClick={() => goFriend(f, true)}
                        >
                            <CameraIcon />
                        </button>
                    </div>
                ))}

                {!loading && friends.length === 0 ? (
                    <p style={emptyHint}>Add friends from Profile to message them here.</p>
                ) : null}
            </div>
        </div>
    );
}

function CameraIcon() {
    return (
        <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.5">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.37-.586.88-.586 1.407V16.2c0 1.108.806 2.057 1.907 2.185a48.208 48.208 0 007.186 0 2.1 2.1 0 001.907-2.185v-8.226c0-.621-.294-1.208-.806-1.59l-1.42-1.066a1.13 1.13 0 00-1.591.327l-1.184 2.073a1.13 1.13 0 01-1.591.327L6.827 6.175z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    );
}

const page = {
    minHeight: "100vh",
    background: "#000",
    color: "#f5f5f5",
    paddingBottom: "calc(56px + env(safe-area-inset-bottom, 0px))",
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
};

const header = {
    padding: "calc(14px + env(safe-area-inset-top, 0px)) 16px 12px",
    borderBottom: "0.5px solid #262626",
    background: "#000",
    position: "sticky",
    top: 0,
    zIndex: 10,
};

const title = { margin: 0, fontSize: "1.35rem", fontWeight: 800 };

const errBanner = {
    margin: "12px 16px 0",
    padding: "10px 12px",
    borderRadius: 10,
    background: "#2a1515",
    color: "#ffb4b4",
    fontSize: "0.88rem",
};

const listWrap = { padding: "4px 0 24px" };

const muted = { color: "#a8a8a8", padding: "16px", margin: 0, fontSize: "0.95rem" };

const emptyHint = {
    color: "#737373",
    padding: "20px 20px 8px",
    margin: 0,
    fontSize: "0.9rem",
    lineHeight: 1.45,
};

const rowOuter = {
    display: "flex",
    alignItems: "center",
    width: "100%",
    paddingRight: 4,
    boxSizing: "border-box",
};

const rowMain = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flex: 1,
    minWidth: 0,
    padding: "12px 8px 12px 16px",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    textAlign: "left",
    color: "inherit",
    boxSizing: "border-box",
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
    background: "#262626",
    display: "block",
};

const onlineDot = {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: "50%",
    background: "#3acf5c",
    border: "2px solid #000",
    boxSizing: "border-box",
};

const textCol = { flex: 1, minWidth: 0 };

const nameLine = {
    fontSize: "1rem",
    fontWeight: 600,
    marginBottom: 4,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

const subLine = {
    fontSize: "0.88rem",
    color: "#a8a8a8",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

const camBtn = {
    flexShrink: 0,
    border: "none",
    background: "transparent",
    color: "#a8a8a8",
    padding: 8,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
};
