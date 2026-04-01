/** Age from YYYY-MM-DD in UTC (matches Postgres `date`). Returns null if invalid. */
export function ageFromDateOfBirth(dateStr) {
    if (typeof dateStr !== 'string') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    const today = new Date();
    const t = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    const b = Date.UTC(y, mo - 1, d);
    if (b > t) return null;
    let age = new Date(t).getUTCFullYear() - new Date(b).getUTCFullYear();
    const monthDiff = new Date(t).getUTCMonth() - new Date(b).getUTCMonth();
    const dayDiff = new Date(t).getUTCDate() - new Date(b).getUTCDate();
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age -= 1;
    return age;
}

export const MIN_REGISTER_AGE = 16;
/** Reject implausible birth years (e.g. typos like 1025). */
export const MAX_REGISTER_AGE = 120;
