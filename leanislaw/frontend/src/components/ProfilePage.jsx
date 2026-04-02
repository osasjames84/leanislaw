import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authBearerHeaders } from "../apiHeaders";
import { userAvatarUrl } from "../lib/userAvatar";
import { getChadRank } from "../lib/chadRank";
import { normalizeUsernameClient, usernameRulesText } from "../lib/usernameRules";
import { copyTextToClipboard } from "../lib/copyToClipboard";
import Sub5Image from "../assets/sub5.png";

export default function ProfilePage() {
    const navigate = useNavigate();
    const { token, user, loading: authLoading, refreshUser } = useAuth();

    const [workoutCount, setWorkoutCount] = useState(0);
    const [friends, setFriends] = useState([]);
    const [friendsLoadError, setFriendsLoadError] = useState("");

    const [usernameInput, setUsernameInput] = useState("");
    const [usernameError, setUsernameError] = useState("");
    const [usernameBusy, setUsernameBusy] = useState(false);
    const [availState, setAvailState] = useState({ checking: false, available: null });
    const [usernameEditOpen, setUsernameEditOpen] = useState(false);

    const [avatarUrlInput, setAvatarUrlInput] = useState("");
    const [avatarError, setAvatarError] = useState("");
    const [avatarBusy, setAvatarBusy] = useState(false);
    const [avatarEditOpen, setAvatarEditOpen] = useState(false);

    const [friendUidInput, setFriendUidInput] = useState("");
    const [friendError, setFriendError] = useState("");
    const [friendBusy, setFriendBusy] = useState(false);
    const [lookupPreview, setLookupPreview] = useState(null);
    const [lookupBusy, setLookupBusy] = useState(false);
    const [copyUidHint, setCopyUidHint] = useState("");

    const rankLabel = getChadRank(workoutCount);

    useEffect(() => {
        if (!user) return;
        setUsernameInput(user.username ? `@${user.username}` : "");
        const u = user.profile_image_url != null && String(user.profile_image_url).trim() !== "" ? user.profile_image_url : "";
        setAvatarUrlInput(u);
    }, [user]);

    useEffect(() => {
        if (!token) return;
        const headers = authBearerHeaders(token);
        fetch("/api/v1/workoutSessions", { headers })
            .then((r) => r.json())
            .then((data) => {
                const n = Array.isArray(data) ? data.length : 0;
                setWorkoutCount(n);
            })
            .catch(() => setWorkoutCount(0));
    }, [token]);

    const loadFriends = useCallback(async () => {
        if (!token) {
            setFriends([]);
            return;
        }
        setFriendsLoadError("");
        try {
            const res = await fetch("/api/v1/social/friends", { headers: authBearerHeaders(token) });
            const raw = await res.text();
            let data = null;
            try {
                data = raw ? JSON.parse(raw) : null;
            } catch {
                data = null;
            }
            if (!res.ok) {
                const fallback =
                    res.status === 401
                        ? "Sign in again — your session may have expired."
                        : res.status === 404
                          ? "Friends API missing on the server (404). In Railway: Redeploy latest main, set Root Directory to leanislaw (or repo root with root package.json), and run migration 015."
                          : res.status === 503
                            ? "Database may need migration 015 (user_friendships). On Railway: redeploy so startup migrations run, or run npm run migrate with DATABASE_URL."
                            : res.status === 403
                              ? "Verify your email, or sign in again."
                              : `Could not load friends (${res.status}).`;
                setFriendsLoadError(typeof data?.error === "string" && data.error ? data.error : fallback);
                setFriends([]);
                return;
            }
            setFriends(Array.isArray(data) ? data : []);
        } catch {
            setFriendsLoadError(
                "Couldn’t reach the API (network or CORS). Add your Vercel URL to CORS_ORIGINS on Railway, e.g. https://your-app.vercel.app",
            );
            setFriends([]);
        }
    }, [token]);

    useEffect(() => {
        void loadFriends();
    }, [loadFriends]);

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
        const raw = usernameInput.trim().replace(/^@/, "");
        const norm = normalizeUsernameClient(raw);
        const t = setTimeout(() => {
            if (norm && norm !== user?.username) checkAvailable(norm);
            else setAvailState({ checking: false, available: norm && norm === user?.username ? true : null });
        }, 350);
        return () => clearTimeout(t);
    }, [usernameInput, user?.username, checkAvailable]);

    const copyUid = async () => {
        if (!user?.id) return;
        const ok = await copyTextToClipboard(String(user.id));
        setCopyUidHint(ok ? "Copied!" : "Couldn’t copy — select the number above.");
        window.setTimeout(() => setCopyUidHint(""), ok ? 2000 : 3500);
    };

    const handleSaveUsername = async (e) => {
        e.preventDefault();
        setUsernameError("");
        const raw = usernameInput.trim().replace(/^@/, "");
        const norm = normalizeUsernameClient(raw);
        if (!norm) {
            setUsernameError(usernameRulesText());
            return;
        }
        if (norm !== user?.username) {
            if (availState.available === false) {
                setUsernameError("That username is already taken.");
                return;
            }
            if (availState.checking || availState.available !== true) {
                setUsernameError("Wait for the availability check, or pick another username.");
                return;
            }
        }
        setUsernameBusy(true);
        try {
            const res = await fetch("/api/v1/auth/me", {
                method: "PATCH",
                headers: { ...authBearerHeaders(token), "Content-Type": "application/json" },
                body: JSON.stringify({ username: norm }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Could not save username.");
            await refreshUser();
            setUsernameEditOpen(false);
        } catch (err) {
            setUsernameError(err.message || "Could not save.");
        } finally {
            setUsernameBusy(false);
        }
    };

    const openUsernameEdit = () => {
        setUsernameError("");
        setUsernameInput(user?.username ? `@${user.username}` : "");
        setUsernameEditOpen(true);
    };

    const closeUsernameEdit = () => {
        setUsernameEditOpen(false);
        setUsernameError("");
        setUsernameInput(user?.username ? `@${user.username}` : "");
    };

    const openAvatarEdit = () => {
        setAvatarError("");
        const u =
            user?.profile_image_url != null && String(user.profile_image_url).trim() !== ""
                ? String(user.profile_image_url).trim()
                : "";
        setAvatarUrlInput(u);
        setAvatarEditOpen(true);
    };

    const closeAvatarEdit = () => {
        setAvatarEditOpen(false);
        setAvatarError("");
        const u =
            user?.profile_image_url != null && String(user.profile_image_url).trim() !== ""
                ? String(user.profile_image_url).trim()
                : "";
        setAvatarUrlInput(u);
    };

    const handleSaveAvatar = async (e) => {
        e.preventDefault();
        setAvatarError("");
        const raw = avatarUrlInput.trim();
        setAvatarBusy(true);
        try {
            const res = await fetch("/api/v1/auth/me", {
                method: "PATCH",
                headers: { ...authBearerHeaders(token), "Content-Type": "application/json" },
                body: JSON.stringify({
                    profile_image_url: raw === "" ? null : raw,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Could not save photo.");
            await refreshUser();
            setAvatarEditOpen(false);
        } catch (err) {
            setAvatarError(err.message || "Could not save.");
        } finally {
            setAvatarBusy(false);
        }
    };

    const handleLookupFriend = async () => {
        setFriendError("");
        setLookupPreview(null);
        const raw = String(friendUidInput).trim().replace(/^@/, "");
        if (!raw) {
            setFriendError("Enter a UID or username.");
            return;
        }
        setLookupBusy(true);
        try {
            const fetchUsernameCard = async (norm) => {
                const res = await fetch(`/api/v1/social/lookup/username/${encodeURIComponent(norm)}`, {
                    headers: authBearerHeaders(token),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) return { ok: false, data };
                return { ok: true, data };
            };

            if (/^\d+$/.test(raw)) {
                const id = parseInt(raw, 10);
                const res = await fetch(`/api/v1/social/lookup/${id}`, { headers: authBearerHeaders(token) });
                const data = await res.json().catch(() => ({}));
                if (res.ok) {
                    setLookupPreview(data);
                    return;
                }
                const norm = normalizeUsernameClient(raw);
                if (norm) {
                    const u = await fetchUsernameCard(norm);
                    if (u.ok) {
                        setLookupPreview(u.data);
                        return;
                    }
                }
                setFriendError(
                    res.status === 404
                        ? `No account with id ${id} on this server. UIDs are per database — use the number your friend sees on Profile in this same app (not localhost vs Vercel), or search their @username.`
                        : data.error || "No one found with that UID or username.",
                );
                return;
            }

            const norm = normalizeUsernameClient(raw);
            if (!norm) {
                setFriendError(
                    "Invalid username. Use 3–30 characters: letters, numbers, periods, and underscores.",
                );
                return;
            }
            const u = await fetchUsernameCard(norm);
            if (u.ok) {
                setLookupPreview(u.data);
                return;
            }
            setFriendError(u.data?.error || "No user with that username.");
        } catch {
            setFriendError("Lookup failed.");
        } finally {
            setLookupBusy(false);
        }
    };

    const handleAddFriend = async () => {
        setFriendError("");
        const raw = String(friendUidInput).trim().replace(/^@/, "");
        if (!raw) {
            setFriendError("Enter a UID or username.");
            return;
        }

        let payload;
        if (lookupPreview) {
            payload = { friendUserId: lookupPreview.id };
        } else if (/^\d+$/.test(raw)) {
            payload = { friendUserId: parseInt(raw, 10) };
        } else {
            const norm = normalizeUsernameClient(raw);
            if (!norm) {
                setFriendError("That doesn’t look like a valid username.");
                return;
            }
            payload = { friendUsername: norm };
        }

        const resolvedId = payload.friendUserId;
        if (resolvedId != null && user?.id === resolvedId) {
            setFriendError("That’s your own account.");
            return;
        }

        setFriendBusy(true);
        try {
            const res = await fetch("/api/v1/social/friends", {
                method: "POST",
                headers: { ...authBearerHeaders(token), "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({}));
            if (res.status === 404) {
                setFriendError(data.error || "User not found.");
                return;
            }
            if (!res.ok && res.status !== 200) {
                setFriendError(data.error || "Could not add friend.");
                return;
            }
            if (data.id) {
                setFriends((prev) => {
                    if (prev.some((p) => p.id === data.id)) return prev;
                    return [...prev, data];
                });
            }
            setFriendUidInput("");
            setLookupPreview(null);
        } catch {
            setFriendError("Could not add friend.");
        } finally {
            setFriendBusy(false);
        }
    };

    const handleRemoveFriend = async (friendId) => {
        if (!token) return;
        try {
            const res = await fetch(`/api/v1/social/friends/${friendId}`, {
                method: "DELETE",
                headers: authBearerHeaders(token),
            });
            if (!res.ok) return;
            setFriends((prev) => prev.filter((f) => f.id !== friendId));
        } catch {
            /* noop */
        }
    };

    if (authLoading || !user) {
        return (
            <div style={page}>
                <p style={muted}>Loading…</p>
            </div>
        );
    }

    const usernameNormHint = normalizeUsernameClient(usernameInput.trim().replace(/^@/, ""));
    const isSubhumanStarter =
        rankLabel === "SUBHUMAN" && workoutCount === 0 && friends.length === 0;

    return (
        <div style={page}>
            <header style={topBar}>
                <button type="button" onClick={() => navigate("/dashboard")} style={backBtn}>
                    ← Back
                </button>
                <h1 style={pageTitle}>Profile</h1>
            </header>

            <div style={card}>
                <div style={identityRow}>
                    <div style={avatarWrap}>
                        <img src={userAvatarUrl(user)} alt="" width={72} height={72} style={bigAvatar} />
                        <button
                            type="button"
                            aria-label="Edit profile photo"
                            onClick={openAvatarEdit}
                            style={avatarPencilBtn}
                        >
                            <PencilIcon />
                        </button>
                    </div>
                    <div style={nameColumn}>
                        {!usernameEditOpen ? (
                            <div style={nameRow}>
                                <span style={displayName}>
                                    {user.username
                                        ? user.username
                                        : user.first_name
                                          ? user.first_name
                                          : "Set handle"}
                                </span>
                                <button
                                    type="button"
                                    aria-label="Edit username"
                                    onClick={openUsernameEdit}
                                    style={namePencilSq}
                                >
                                    <PencilIcon />
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSaveUsername} style={usernameEditForm}>
                                {usernameError ? <div style={{ ...errBox, marginBottom: 8 }}>{usernameError}</div> : null}
                                <input
                                    type="text"
                                    autoComplete="username"
                                    style={{ ...input, marginBottom: 6 }}
                                    value={usernameInput}
                                    onChange={(e) => setUsernameInput(e.target.value)}
                                    placeholder="@your_handle"
                                />
                                <p style={{ ...hint, marginBottom: 8 }}>
                                    {availState.checking
                                        ? "Checking…"
                                        : usernameNormHint && usernameNormHint !== user.username
                                          ? availState.available === true
                                              ? "Available"
                                              : availState.available === false
                                                ? "Taken"
                                                : ""
                                          : ""}
                                </p>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    <button type="submit" style={{ ...primaryBtn, padding: "10px 16px" }} disabled={usernameBusy}>
                                        {usernameBusy ? "Saving…" : "Save"}
                                    </button>
                                    <button
                                        type="button"
                                        style={{ ...ghostBtn, padding: "10px 16px" }}
                                        onClick={closeUsernameEdit}
                                        disabled={usernameBusy}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        )}
                        <p style={profileSubline}>
                            <span style={sublineDiamond} aria-hidden>
                                ◆
                            </span>
                            <span>
                                {user.first_name} {user.last_name}
                            </span>
                        </p>
                    </div>
                </div>

                <div style={isSubhumanStarter ? { ...statTilesRow, ...subhumanTilesShell } : statTilesRow}>
                    {isSubhumanStarter ? (
                        <>
                            <div style={{ ...statTile, ...statTileStarter }}>
                                <img src={Sub5Image} alt="" style={subhumanRankThumb} />
                                <span style={subhumanRankTitle}>SUBHUMAN</span>
                                <span style={statTileLabel}>RANK</span>
                                <span style={statTileHint}>Baseline — every lifter’s day one.</span>
                            </div>
                            <div style={{ ...statTile, ...statTileStarter }}>
                                <span style={statTileZero}>0</span>
                                <span style={statTileLabel}>SESSIONS</span>
                                <span style={statTileHint}>Finish a workout to leave the void.</span>
                            </div>
                            <div style={{ ...statTile, ...statTileStarter }}>
                                <span style={statTileZero}>0</span>
                                <span style={statTileLabel}>ALLIES</span>
                                <span style={statTileHint}>Share your UID — accountability hits different.</span>
                            </div>
                        </>
                    ) : (
                        <>
                            <div style={statTile}>
                                <div style={statTileMedallion}>{rankLabel}</div>
                                <span style={statTileLabel}>RANK</span>
                            </div>
                            <div style={statTile}>
                                <span style={statTileValue}>{workoutCount}</span>
                                <span style={statTileLabel}>SESSIONS</span>
                            </div>
                            <div style={statTile}>
                                <span style={statTileValue}>{friends.length}</span>
                                <span style={statTileLabel}>ALLIES</span>
                            </div>
                        </>
                    )}
                </div>

                <div style={uidFooter}>
                    <span style={uidFooterLabel}>UID</span>
                    <code style={{ ...uidFooterCode, userSelect: "text" }} id="profile-uid-value">
                        {user.id}
                    </code>
                    <button type="button" aria-label="Copy UID" onClick={copyUid} style={copyIconBtn}>
                        <CopyIcon />
                    </button>
                </div>
                {copyUidHint ? (
                    <p
                        style={{
                            ...copyHint,
                            color: copyUidHint === "Copied!" ? "#248a3d" : "#c00",
                        }}
                        role="status"
                    >
                        {copyUidHint}
                    </p>
                ) : null}

                {avatarEditOpen ? (
                    <form onSubmit={handleSaveAvatar} style={avatarEditPanel}>
                        {avatarError ? <div style={errBox}>{avatarError}</div> : null}
                        <p style={{ ...hint, marginTop: 0 }}>
                            HTTPS image URL, or a path on this site (e.g. /leaderboard/foo.png).
                        </p>
                        <input
                            type="url"
                            style={input}
                            value={avatarUrlInput}
                            onChange={(e) => setAvatarUrlInput(e.target.value)}
                            placeholder="https://… or /path/to/image.png"
                        />
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                            <button type="submit" style={primaryBtn} disabled={avatarBusy}>
                                {avatarBusy ? "Saving…" : "Save"}
                            </button>
                            <button type="button" style={ghostBtn} onClick={closeAvatarEdit} disabled={avatarBusy}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                style={ghostBtn}
                                disabled={avatarBusy}
                                onClick={() => {
                                    setAvatarUrlInput("");
                                    setAvatarError("");
                                }}
                            >
                                Clear field
                            </button>
                        </div>
                    </form>
                ) : null}
            </div>

            <div style={card}>
                <h2 style={sectionTitle}>Friends</h2>
                <p style={hint}>
                    Search by <strong>UID</strong> or <strong>@username</strong>. UIDs only match users in{" "}
                    <strong>this</strong> deployment (production Vercel ↔ Railway is one world; local dev is another).
                </p>
                {friendsLoadError ? <div style={errBox}>{friendsLoadError}</div> : null}

                <div style={addRow}>
                    <input
                        type="text"
                        autoComplete="off"
                        autoCapitalize="none"
                        style={{ ...input, flex: 1, marginBottom: 0 }}
                        value={friendUidInput}
                        onChange={(e) => setFriendUidInput(e.target.value)}
                        placeholder="UID or username"
                    />
                    <button type="button" style={ghostBtn} onClick={handleLookupFriend} disabled={lookupBusy}>
                        {lookupBusy ? "…" : "Look up"}
                    </button>
                    <button type="button" style={primaryBtn} onClick={handleAddFriend} disabled={friendBusy}>
                        Add
                    </button>
                </div>
                {friendError ? <div style={errBox}>{friendError}</div> : null}

                {lookupPreview ? (
                    <div style={previewCard}>
                        <img
                            src={lookupPreview.avatar_url || "/sub5.png"}
                            alt=""
                            width={40}
                            height={40}
                            style={{ borderRadius: 10, objectFit: "cover" }}
                        />
                        <div>
                            <p style={{ margin: 0, fontWeight: 700 }}>
                                {lookupPreview.username
                                    ? `@${lookupPreview.username}`
                                    : `${lookupPreview.first_name} ${lookupPreview.last_name}`}
                            </p>
                            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#8e8e93" }}>UID {lookupPreview.id}</p>
                        </div>
                    </div>
                ) : null}

                {friends.length === 0 ? (
                    <p style={muted}>No friends yet.</p>
                ) : (
                    <ul style={{ listStyle: "none", margin: "16px 0 0", padding: 0 }}>
                        {friends.map((f) => (
                            <li key={f.id} style={friendRow}>
                                <img
                                    src={f.avatar_url || "/sub5.png"}
                                    alt=""
                                    width={44}
                                    height={44}
                                    style={{ borderRadius: 12, objectFit: "cover" }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ margin: 0, fontWeight: 700 }}>
                                        {f.username ? `@${f.username}` : `${f.first_name} ${f.last_name}`}
                                    </p>
                                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "#8e8e93" }}>UID {f.id}</p>
                                </div>
                                <button type="button" style={dangerBtn} onClick={() => handleRemoveFriend(f.id)}>
                                    Remove
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

function PencilIcon() {
    return (
        <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            aria-hidden
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
    );
}

function CopyIcon() {
    return (
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            aria-hidden
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
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
    padding: "calc(16px + env(safe-area-inset-top, 0px)) 16px 12px",
    background: "#fff",
    borderBottom: "0.5px solid #d1d1d6",
    display: "flex",
    alignItems: "center",
    gap: 12,
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
};

const pageTitle = { margin: 0, fontSize: "1.1rem", fontWeight: 800 };

const card = {
    background: "#fff",
    margin: 16,
    padding: 20,
    borderRadius: 16,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
};

const identityRow = {
    display: "flex",
    gap: 16,
    alignItems: "flex-start",
    marginBottom: 16,
};
const nameColumn = { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 0 };
const nameRow = { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" };
const displayName = {
    fontSize: "1.35rem",
    fontWeight: 900,
    color: "#000",
    letterSpacing: "-0.02em",
    lineHeight: 1.15,
};
const namePencilSq = {
    width: 34,
    height: 34,
    padding: 0,
    borderRadius: 8,
    border: "1px solid #d1d1d6",
    background: "#f2f2f7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: "#3a3a3c",
    flexShrink: 0,
};
const usernameEditForm = { width: "100%" };
const profileSubline = {
    margin: "10px 0 0",
    fontSize: "0.8rem",
    color: "#8e8e93",
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    gap: 6,
};
const sublineDiamond = { color: "#c0362c", fontSize: "0.55rem", lineHeight: 1 };

const statTilesRow = {
    display: "flex",
    gap: 10,
    alignItems: "stretch",
    marginBottom: 16,
};
const subhumanTilesShell = {
    padding: 12,
    marginBottom: 16,
    borderRadius: 14,
    background: "linear-gradient(160deg, #f4f2fa 0%, #fff7f2 55%, #f4f6fb 100%)",
    border: "1px solid #e6e2ef",
    boxSizing: "border-box",
};
const statTileStarter = {
    background: "rgba(255,255,255,0.92)",
    border: "1px solid #e8e6ed",
    boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
    gap: 5,
    justifyContent: "center",
    aspectRatio: "unset",
    minHeight: 124,
    maxHeight: "none",
    alignSelf: "stretch",
};
const subhumanRankThumb = {
    width: 44,
    height: 44,
    objectFit: "contain",
    marginBottom: 2,
};
const subhumanRankTitle = {
    fontSize: "0.58rem",
    fontWeight: 900,
    letterSpacing: "0.14em",
    color: "#4a3f66",
    textAlign: "center",
    lineHeight: 1.2,
};
const statTileZero = {
    fontSize: "1.45rem",
    fontWeight: 900,
    color: "#c7c7cc",
    lineHeight: 1,
};
const statTileHint = {
    fontSize: "0.58rem",
    fontWeight: 600,
    color: "#8e8e93",
    textAlign: "center",
    lineHeight: 1.35,
    padding: "0 4px",
    maxWidth: "100%",
};
const statTile = {
    flex: 1,
    minWidth: 0,
    aspectRatio: "1",
    maxHeight: 108,
    background: "#e8e8ed",
    borderRadius: 12,
    border: "1px solid #cfcfd4",
    boxShadow: "inset 0 1px 3px rgba(0,0,0,0.08)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 6px",
    gap: 6,
};
const statTileMedallion = {
    fontSize: "0.65rem",
    fontWeight: 900,
    color: "#1c1c1e",
    textAlign: "center",
    lineHeight: 1.15,
    maxWidth: "100%",
    display: "-webkit-box",
    WebkitLineClamp: 3,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
};
const statTileValue = {
    fontSize: "1.5rem",
    fontWeight: 900,
    color: "#000",
    lineHeight: 1,
};
const statTileLabel = {
    fontSize: "0.6rem",
    fontWeight: 800,
    color: "#636366",
    letterSpacing: "0.12em",
};

const uidFooter = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    paddingTop: 16,
    borderTop: "0.5px solid #e5e5ea",
};
const uidFooterLabel = { fontWeight: 800, fontSize: "0.8rem", color: "#000" };
const uidFooterCode = {
    fontSize: "0.85rem",
    fontWeight: 650,
    background: "#f2f2f7",
    padding: "6px 10px",
    borderRadius: 8,
    flex: "1 1 auto",
    minWidth: 0,
};
const copyIconBtn = {
    border: "none",
    background: "transparent",
    padding: 8,
    cursor: "pointer",
    color: "#007aff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
};
const copyHint = {
    margin: "8px 0 0",
    fontSize: 13,
    fontWeight: 600,
};
const avatarWrap = {
    position: "relative",
    width: 72,
    height: 72,
    flexShrink: 0,
};
const avatarPencilBtn = {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 30,
    height: 30,
    borderRadius: "50%",
    border: "1px solid #d1d1d6",
    background: "#fff",
    boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    padding: 0,
    color: "#3a3a3c",
};
const avatarEditPanel = {
    marginTop: 16,
    paddingTop: 16,
    borderTop: "0.5px solid #e5e5ea",
};
const bigAvatar = { borderRadius: 16, border: "1px solid #d1d1d6", objectFit: "cover", display: "block" };
const muted = { color: "#8e8e93", textAlign: "center", padding: 40 };
const sectionTitle = { margin: "20px 0 12px", fontSize: "0.95rem", fontWeight: 800 };
const input = {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid #d1d1d6",
    fontSize: 16,
    marginBottom: 8,
};
const hint = { margin: "0 0 12px", fontSize: 13, color: "#8e8e93", lineHeight: 1.4 };
const errBox = {
    background: "#ffecec",
    color: "#c00",
    padding: "10px 12px",
    borderRadius: 10,
    marginBottom: 12,
    fontSize: 14,
};
const primaryBtn = {
    border: "none",
    background: "#007aff",
    color: "#fff",
    padding: "12px 18px",
    borderRadius: 12,
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
};
const ghostBtn = {
    border: "1px solid #d1d1d6",
    background: "#fff",
    color: "#000",
    padding: "12px 14px",
    borderRadius: 12,
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
};
const addRow = { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 };
const previewCard = {
    display: "flex",
    gap: 12,
    alignItems: "center",
    padding: 12,
    background: "#f9f9fb",
    borderRadius: 12,
    marginTop: 8,
};
const friendRow = {
    display: "flex",
    gap: 12,
    alignItems: "center",
    padding: "12px 0",
    borderBottom: "0.5px solid #e5e5ea",
};
const dangerBtn = {
    border: "none",
    background: "transparent",
    color: "#ff3b30",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    padding: "8px 4px",
};
