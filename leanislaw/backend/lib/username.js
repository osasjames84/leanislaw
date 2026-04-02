const MIN = 3;
const MAX = 30;

/** Letters, digits, "." and "_"; stored lowercase; 3–30 chars; no "..", no leading/trailing "." */
export function normalizeUsername(raw) {
    if (raw == null) return null;
    if (raw === '') return null;
    const s = String(raw).trim().toLowerCase();
    if (s.length < MIN || s.length > MAX) return undefined;
    if (!/^[a-z0-9]([a-z0-9._]*[a-z0-9])?$/.test(s)) return undefined;
    if (s.includes('..')) return undefined;
    if (s.startsWith('.') || s.endsWith('.')) return undefined;
    return s;
}

export function usernameValidationHint() {
    return `3–${MAX} characters: letters, numbers, periods, and underscores (no consecutive periods).`;
}
