/**
 * Hybrid AI weekly overview.
 *
 * The deterministic engine (build_report + progression) already computes exact
 * numbers, flags and overload suggestions. This module turns those into a short
 * coach-facing narrative + recommended actions using Claude — the LLM only
 * narrates pre-computed facts, it never invents numbers.
 *
 * Degrades gracefully: with no ANTHROPIC_API_KEY it returns a deterministic
 * template summary so the feature still works offline ({ ai: false }).
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

/** Compact, factual digest of the week — the only numbers the model may use. */
export function buildOverviewFacts({ model, progression = [], flags = [] }) {
    const m = model || {};
    const t = m.training || {};
    const n = m.nutrition || {};
    const b = m.body || {};
    const c = m.checkin || {};
    const trend = b.trend || null;

    const lifts = (progression || []).slice(0, 4).map((p) => ({
        exercise: p.exercise,
        est_1rm: p.latest?.est_1rm,
        delta_1rm: p.delta_1rm,
        top: p.latest ? `${p.latest.top_weight}kg x ${p.latest.top_reps}` : null,
        suggestion: p.suggestion,
    }));

    return {
        name: m.name,
        goal: m.goal,
        training: {
            completed: t.completed ?? null,
            assigned: t.assigned ?? null,
            adherence_pct: t.adherence ?? null,
        },
        nutrition: {
            logged_days: n.logged_days ?? null,
            target_days: n.target_days ?? 7,
            avg_calories: n.avg_calories ?? null,
            target_calories: n.target_calories ?? null,
            protein_hit_rate_pct: n.protein_hit_rate ?? null,
        },
        bodyweight: trend
            ? { start: trend.start, end: trend.end, change_kg: trend.change, pct_change: trend.pct_change, unit: b.unit || 'kg' }
            : null,
        checkin: c.submitted
            ? { sleep_h: c.sleep_h, energy_1to5: c.energy_1to5, stress_1to5: c.stress_1to5, steps_avg: c.steps_avg, notes: c.notes || null }
            : null,
        strength: lifts,
        coach_flags: flags || [],
    };
}

/** Deterministic fallback narrative (no LLM). */
function templateOverview(facts) {
    const parts = [];
    const t = facts.training;
    if (t.assigned != null) {
        parts.push(`Training: ${t.completed ?? 0}/${t.assigned} sessions${t.adherence_pct != null ? ` (${t.adherence_pct}%)` : ''}.`);
    }
    const n = facts.nutrition;
    if (n.logged_days != null) {
        parts.push(`Nutrition logged ${n.logged_days}/${n.target_days} days${n.protein_hit_rate_pct != null ? `, protein hit ${n.protein_hit_rate_pct}%` : ''}.`);
    }
    if (facts.bodyweight) {
        const bw = facts.bodyweight;
        parts.push(`Bodyweight ${bw.start}→${bw.end}${bw.unit} (${bw.change_kg > 0 ? '+' : ''}${bw.change_kg}${bw.unit}).`);
    }
    if (facts.checkin) {
        parts.push(`Check-in: sleep ${facts.checkin.sleep_h ?? '—'}h, energy ${facts.checkin.energy_1to5 ?? '—'}/5, stress ${facts.checkin.stress_1to5 ?? '—'}/5.`);
    }
    const actions = [];
    for (const l of facts.strength) {
        if (l.suggestion) actions.push(`${l.exercise}: ${l.suggestion}`);
    }
    for (const f of facts.coach_flags) actions.push(f);
    return {
        summary: parts.join(' ') || 'Not enough data logged this week to summarise.',
        actions: actions.slice(0, 4),
    };
}

/** Parse the model's JSON answer defensively. */
function parseModelJson(text) {
    if (!text) return null;
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
        const obj = JSON.parse(match[0]);
        return {
            summary: typeof obj.summary === 'string' ? obj.summary.trim() : '',
            actions: Array.isArray(obj.actions) ? obj.actions.map((a) => String(a)).slice(0, 5) : [],
        };
    } catch {
        return null;
    }
}

export async function generateAiOverview({ model, progression = [], flags = [] }) {
    const facts = buildOverviewFacts({ model, progression, flags });
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        return { ai: false, model: null, ...templateOverview(facts), facts };
    }

    const system = [
        'You are an expert strength & physique coach writing a private weekly note FOR A COACH about one client.',
        'You are given a JSON digest of the week. Use ONLY the numbers in it — never invent figures.',
        'Be concise, practical and warm. Focus on what changed and what to do next.',
        'Duty of care: this is a coaching tool, not medical advice. If coach_flags mention very low intake or fast weight drop, advise a supportive human check-in, never alarming language.',
        'Respond with STRICT JSON only: {"summary": string (2-4 sentences), "actions": string[] (2-4 short imperative next steps)}.',
    ].join(' ');

    try {
        const resp = await fetch(ANTHROPIC_URL, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: DEFAULT_MODEL,
                max_tokens: 700,
                system,
                messages: [
                    { role: 'user', content: `Weekly digest JSON:\n${JSON.stringify(facts, null, 2)}` },
                ],
            }),
        });
        if (!resp.ok) {
            const detail = await resp.text().catch(() => '');
            console.error('aiOverview anthropic error:', resp.status, detail.slice(0, 300));
            return { ai: false, model: null, ...templateOverview(facts), facts, error: `LLM ${resp.status}` };
        }
        const data = await resp.json();
        const text = (data?.content || []).map((b) => b?.text || '').join('\n');
        const parsed = parseModelJson(text);
        if (!parsed || !parsed.summary) {
            return { ai: false, model: null, ...templateOverview(facts), facts };
        }
        return { ai: true, model: DEFAULT_MODEL, summary: parsed.summary, actions: parsed.actions, facts };
    } catch (err) {
        console.error('aiOverview failed:', err);
        return { ai: false, model: null, ...templateOverview(facts), facts, error: err.message };
    }
}
