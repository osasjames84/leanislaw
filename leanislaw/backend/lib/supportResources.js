/**
 * Region-appropriate eating-disorder support signposts. UK default = Beat.
 * Override/extend via SUPPORT_RESOURCES_JSON (a JSON object keyed by region code).
 */

const DEFAULTS = {
    UK: {
        name: 'Beat',
        url: 'https://www.beateatingdisorders.org.uk',
        phone: '0808 801 0677',
    },
    US: {
        name: 'NEDA',
        url: 'https://www.nationaleatingdisorders.org',
        phone: '1-800-931-2237',
    },
    AU: {
        name: 'Butterfly Foundation',
        url: 'https://butterfly.org.au',
        phone: '1800 33 4673',
    },
};

const DISCLAIMER =
    'Lean is Law is a coaching tool, not medical care. If you’re struggling with food, ' +
    'eating or how you feel about your body, the service below offers free, confidential support.';

let cache = null;

function resources() {
    if (cache) return cache;
    cache = { ...DEFAULTS };
    const raw = process.env.SUPPORT_RESOURCES_JSON;
    if (raw) {
        try {
            const extra = JSON.parse(raw);
            if (extra && typeof extra === 'object') {
                for (const [region, val] of Object.entries(extra)) {
                    if (val && typeof val === 'object') cache[region] = val;
                }
            }
        } catch (e) {
            console.warn('[support] SUPPORT_RESOURCES_JSON ignored (invalid JSON):', e.message);
        }
    }
    return cache;
}

/** Support signpost for a region, falling back to UK. */
export function supportForRegion(region) {
    const all = resources();
    const r = all[String(region || 'UK').toUpperCase()] || all.UK;
    return { region: String(region || 'UK').toUpperCase(), disclaimer: DISCLAIMER, ...r };
}
