/** Subtitle line like “Sent 9h ago” (Instagram-style). */
export function formatSentAgo(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const t = d.getTime();
    if (!Number.isFinite(t)) return "";
    const diffMs = Date.now() - t;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Sent just now";
    if (diffMin < 60) return `Sent ${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `Sent ${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    if (diffD === 1) return "Sent yesterday";
    if (diffD < 7) return `Sent ${diffD}d ago`;
    return `Sent ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

/** Compact time for list rows (e.g. “36m”, “2h”, “Jan 4”). */
export function formatShortTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const t = d.getTime();
    if (!Number.isFinite(t)) return "";
    const diffMin = Math.floor((Date.now() - t) / 60000);
    if (diffMin < 1) return "now";
    if (diffMin < 60) return `${diffMin}m`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function displayNameFriend(f) {
    if (!f) return "User";
    if (f.username) return `@${f.username}`;
    const fn = f.first_name || "";
    const ln = f.last_name || "";
    const both = `${fn} ${ln}`.trim();
    return both || `User ${f.id ?? ""}`;
}
