/**
 * Week-range helpers. A reported week is Mon..Sun, keyed by its Monday
 * (week_start), matching the Python engine's run_weekly.last_monday().
 */

function pad(n) {
    return String(n).padStart(2, '0');
}

/** YYYY-MM-DD in local time (date columns are stored/compared as plain dates). */
export function isoDate(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Monday of the given date's week (00:00 local). */
export function mondayOf(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const dow = (d.getDay() + 6) % 7; // 0 = Monday
    d.setDate(d.getDate() - dow);
    return d;
}

/** Monday of the last *completed* week (the default the weekly job reports on). */
export function lastMonday(today = new Date()) {
    const thisMon = mondayOf(today);
    thisMon.setDate(thisMon.getDate() - 7);
    return thisMon;
}

/**
 * Resolve a week_start input to { weekStart, weekEnd, startDate, endExclusive }.
 * `input` may be a YYYY-MM-DD string (any day in the week) or omitted (last week).
 */
export function resolveWeek(input) {
    let base;
    if (input) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(input).trim());
        if (!m) throw new Error('week_start must be YYYY-MM-DD');
        base = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        if (Number.isNaN(base.getTime())) throw new Error('Invalid week_start');
        base = mondayOf(base);
    } else {
        base = lastMonday();
    }
    const startDate = base;
    const endExclusive = new Date(base);
    endExclusive.setDate(endExclusive.getDate() + 7);
    const endDate = new Date(base);
    endDate.setDate(endDate.getDate() + 6);
    return {
        weekStart: isoDate(startDate),
        weekEnd: isoDate(endDate),
        startDate,
        endExclusive,
    };
}

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Mon".."Sun" for a date or date-string. */
export function dayAbbr(value) {
    const d = value instanceof Date ? value : new Date(value);
    return DAY_ABBR[d.getDay()] ?? '';
}
