/**
 * The daily Looksmax coach line. Claude speaks in the creator's voice, grounded
 * in their own principles file (knowledge/chad-core-principles.txt via
 * chadCorePrinciplesContext) and today's game state. Degrades to a punchy
 * deterministic line when ANTHROPIC_API_KEY isn't set.
 */

import { chadCorePrinciplesContext } from '../chadPrinciples.js';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';

function deterministicLine(j) {
    const q = j.quests.filter((x) => !x.done);
    if (j.streak >= 7) return `${j.streak}-day streak. You're ${j.rank.name}. Protect the chain — ${q[0] ? q[0].label.toLowerCase() : 'finish today clean'}.`;
    if (!j.active_today) return `Nothing logged yet today. One action starts the streak — ${q[0] ? q[0].label.toLowerCase() : 'log something'}.`;
    if (j.score >= 65) return `Score ${j.score}. Chad tier. Don't coast — close today's quests and push the streak.`;
    return `Score ${j.score}, ${j.rank.name}. ${q.length ? `${q.length} quests left — ${q[0].label.toLowerCase()} next.` : 'All quests done. Lock it in tomorrow.'}`;
}

export async function dailyCoachLine(journey) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { ai: false, line: deterministicLine(journey) };

    const principles = chadCorePrinciplesContext();
    const system = [
        'You are the in-app coach for a fitness "looksmaxing" app. You speak in the creator\'s voice: blunt, motivating, no fluff, a little playful, never cringe.',
        'Goal for every user: lose fat AND gain muscle (recomp). Keep advice grounded in training, nutrition, and consistency — never body-shaming, never medical claims.',
        principles ? principles : '',
        'You are given the user\'s game state as JSON. Write ONE short line (max ~24 words) of coaching for TODAY that reacts to their score, streak, and unfinished quests. Output only the line, no quotes.',
    ].filter(Boolean).join('\n\n');

    try {
        const resp = await fetch(ANTHROPIC_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({
                model: MODEL, max_tokens: 120, system,
                messages: [{ role: 'user', content: JSON.stringify({
                    score: journey.score, rank: journey.rank.name, level: journey.level, streak: journey.streak,
                    active_today: journey.active_today, goal: journey.goal,
                    quests_remaining: journey.quests.filter((q) => !q.done).map((q) => q.label),
                }) }],
            }),
        });
        if (!resp.ok) return { ai: false, line: deterministicLine(journey) };
        const data = await resp.json();
        const line = (data?.content || []).map((b) => b?.text || '').join(' ').trim().replace(/^["']|["']$/g, '');
        return line ? { ai: true, model: MODEL, line } : { ai: false, line: deterministicLine(journey) };
    } catch {
        return { ai: false, line: deterministicLine(journey) };
    }
}
