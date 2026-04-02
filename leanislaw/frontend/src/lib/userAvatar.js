/** Same asset as `public/sub5.png` — default for everyone until `profile_image_url` is set. */
const DEFAULT_SUB5 = "/sub5.png";

/** Resolved avatar for UI (uses `avatar_url` from API when present). */
export function userAvatarUrl(user) {
    if (!user) return DEFAULT_SUB5;
    if (user.avatar_url) return user.avatar_url;
    const custom = user.profile_image_url;
    if (custom != null && String(custom).trim() !== "") return String(custom).trim();
    return DEFAULT_SUB5;
}
