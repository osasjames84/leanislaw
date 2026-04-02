/**
 * Default profile image: `sub5.png` in frontend `public/` (served at /sub5.png).
 * Override with DEFAULT_PROFILE_AVATAR_URL (full https URL) if the API is on another host.
 */
const DEFAULT_SUB5 =
    process.env.DEFAULT_PROFILE_AVATAR_URL && String(process.env.DEFAULT_PROFILE_AVATAR_URL).trim() !== ''
        ? String(process.env.DEFAULT_PROFILE_AVATAR_URL).trim()
        : '/sub5.png';

/** Kept for callers that pass userId; image is the same for everyone until they set a custom URL. */
export function sub5AvatarUrl(_userId) {
    return DEFAULT_SUB5;
}

/**
 * @param {{ id: number, profile_image_url?: string | null, profileImageUrl?: string | null }} row
 */
export function resolveAvatarUrl(row) {
    if (!row || row.id == null) return DEFAULT_SUB5;
    const custom = row.profile_image_url ?? row.profileImageUrl;
    if (custom != null && String(custom).trim() !== '') {
        return String(custom).trim();
    }
    return DEFAULT_SUB5;
}

/** Accept saved URLs: https or same-origin path. */
export function sanitizeProfileImageUrl(raw) {
    if (raw == null) return null;
    const s = String(raw).trim();
    if (s.length === 0) return null;
    if (s.length > 2048) return null;
    if (/^https:\/\//i.test(s)) return s;
    if (s.startsWith('/')) return s;
    return undefined;
}
