/** Mirrors backend: letters, numbers, "." and "_"; 3–30; lowercased; no ".." or leading/trailing "." */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

export function normalizeUsernameClient(raw) {
    if (raw == null || raw === "") return null;
    const s = String(raw).trim().toLowerCase();
    if (s.length < USERNAME_MIN || s.length > USERNAME_MAX) return null;
    if (!/^[a-z0-9]([a-z0-9._]*[a-z0-9])?$/.test(s)) return null;
    if (s.includes("..")) return null;
    if (s.startsWith(".") || s.endsWith(".")) return null;
    return s;
}

export function usernameRulesText() {
    return `${USERNAME_MIN}–${USERNAME_MAX} characters: letters, numbers, periods (.), and underscores (_). No consecutive periods.`;
}
