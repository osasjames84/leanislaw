import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireCoach } from './coaching.js';
import { glossaryMatchesFromText } from '../lib/chadGlossary.js';
import { loreSystemContext } from '../lib/chadLore.js';
import {
    rflBookFaithfulContext,
    rflProteinGPerLbLbm,
    rflReplyLooksGenericDeficit,
} from '../lib/chadRflBookRules.js';
import { chadCorePrinciplesContext } from '../lib/chadPrinciples.js';
import { knowledgeCountsBySource, searchKnowledge } from '../lib/knowledgeStore.js';
import pool, { db } from '../db.js';
import { bodyMetrics, daily_logs, userMacroPlan, userTdeeState, workoutSessions } from '../schema.js';
import { desc, eq } from 'drizzle-orm';

const router = express.Router();

const CHAD_KNOWLEDGE_SOURCES = (process.env.CHAD_KNOWLEDGE_SOURCES || 'bodyrecomposition,rapid_fat_loss')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const SYSTEM_PROMPT =
    'You are Chad Bot for LeanIsLaw: direct, sharp, practical coach voice. ' +
    'Understand looksmaxxing slang and brainrot terms, but keep advice grounded in training, nutrition, grooming, social skills, and discipline. ' +
    'Avoid medical diagnosis; for injuries/health risks suggest professional help briefly.';

function isConversationEnding(text) {
    const t = String(text || '').toLowerCase();
    return /\b(bye|goodbye|see ya|see you|later|gn|good night|talk later|im done|i'm done|that'?s all|thanks|thank you)\b/.test(
        t
    );
}

function normalizeSignoff(reply, shouldSignOff) {
    const cleaned = String(reply || '').replace(/\bLater Gator\.?/gi, '').trim();
    if (!shouldSignOff) return cleaned;
    return cleaned.length ? `${cleaned}\nLater Gator.` : 'Later Gator.';
}

async function callOpenAiChat(apiKey, payload) {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
        const msg = json?.error?.message || `Chat provider error (${resp.status})`;
        throw new Error(msg);
    }
    return json?.choices?.[0]?.message?.content?.trim() || '';
}

function looksLikeMuscleCalorieQuestion(text) {
    const t = String(text || '').toLowerCase();
    return (
        (t.includes('muscle') || t.includes('gain') || t.includes('bulk')) &&
        (t.includes('calorie') || t.includes('tdee') || t.includes('surplus') || t.includes('eat'))
    );
}

function looksLikeRflProtocolQuestion(text) {
    const t = String(text || '').toLowerCase();
    return (
        /\brfl\b/.test(t) ||
        /\brapid fat loss\b/.test(t) ||
        /\bpsmf\b/.test(t) ||
        /\bprotein.?sparing\b/.test(t) ||
        /\blyle\b/.test(t) ||
        /\bmcdonald\b/.test(t) ||
        (/\bprotocol\b/.test(t) && /\b(fat loss|cut|diet|deficit)\b/.test(t)) ||
        (/\baggressive\b/.test(t) && /\b(diet|cut|deficit|fat loss)\b/.test(t))
    );
}

/** User is asking for macro or calorie numbers (not a generic “give me a plan”). */
function looksLikeRflMacroCalorieQuestion(text) {
    const t = String(text || '').toLowerCase();
    return (
        /\b(total|daily)\s+(macros?|kcal|calories?)\b/.test(t) ||
        /\bmacros?\b.*\b(breakdown|fall|land|be|are|numbers?|total)\b/.test(t) ||
        /\b(where|how)\s+(do\s+)?(the\s+)?macros?\b/.test(t) ||
        /\b(macro|calorie|caloric)\s+(breakdown|totals?)\b/.test(t) ||
        /\bhow\s+many\s+(cal|kcal|calories?)\b/.test(t) ||
        /\bwhat\s+(are|would)\s+(my|the)\s+macros?\b/.test(t) ||
        /\btell me\s+where\s+the\s+macros?\b/.test(t)
    );
}

function primaryTdeeKcalFromState(state) {
    if (!state) return null;
    const ema = state.ema_tdee != null ? Number(state.ema_tdee) : NaN;
    const base = state.baseline_tdee != null ? Number(state.baseline_tdee) : NaN;
    if (Number.isFinite(ema) && ema >= 800 && ema <= 20000) return Math.round(ema);
    if (Number.isFinite(base) && base >= 800 && base <= 20000) return Math.round(base);
    return null;
}

function stageFromRank(rank) {
    if (rank === 'SUBHUMAN' || rank === 'SUB-5' || rank === 'LTN') return 'beginner';
    if (rank === 'MTN' || rank === 'HTN') return 'intermediate';
    return 'advanced';
}

function monthlyGainPctRange(stage) {
    if (stage === 'beginner') return { minPct: 1.0, maxPct: 1.5 };
    if (stage === 'intermediate') return { minPct: 0.5, maxPct: 1.0 };
    return { minPct: 0.25, maxPct: 0.5 };
}

function muscleSurplusFromLyleModel({ weightKg, rank }) {
    const wKg = Number(weightKg);
    if (!Number.isFinite(wKg) || wKg <= 0) return null;
    const wLb = wKg * 2.2046226218;
    const stage = stageFromRank(rank);
    const { minPct, maxPct } = monthlyGainPctRange(stage);
    const monthlyGainLbMin = wLb * (minPct / 100);
    const monthlyGainLbMax = wLb * (maxPct / 100);
    // Lyle article framing often uses ~3500 kcal per pound of gain (practical rule of thumb).
    const kcalMonthMin = monthlyGainLbMin * 3500;
    const kcalMonthMax = monthlyGainLbMax * 3500;
    const dailyMin = Math.max(20, Math.round(kcalMonthMin / 30));
    const dailyMax = Math.max(dailyMin, Math.round(kcalMonthMax / 30));
    return { stage, dailyMin, dailyMax };
}

function getOpenAiConfig() {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
    return { apiKey, model };
}

const TRAINING_QUESTIONS = [
    'How blunt should Chad Bot be (1-10)?',
    'What phrases instantly sound cringe to you?',
    'What phrases should Chad Bot use often?',
    'How do you respond when someone says "it is over"?',
    'How do you respond to excuse-making?',
    'How should Chad Bot talk about looksmaxxing?',
    'How should Chad Bot handle dating/attraction frustration?',
    'What is your default structure for giving advice?',
    'How long should replies usually be?',
    'When should Chad Bot use bullets vs plain text?',
    'What tone do you want: ruthless, balanced, supportive, or hybrid?',
    'How should Chad Bot speak when user is low rank (SUB-5/LTN)?',
    'How should Chad Bot speak when user is high rank (HTN/CHAD)?',
    'What coaching principles are non-negotiable for you?',
    'What health/safety boundaries should Chad Bot never cross?',
    'Give 3 example user prompts and your exact reply style.',
    'What slang should Chad Bot embrace? What slang to avoid?',
    'How should Chad Bot end responses (if at all)?',
    'How should Chad Bot call out inconsistency without sounding fake?',
    'What is your signature one-liner coaching mantra?',
];

let profileTableReady = false;
async function ensureProfileTable() {
    if (profileTableReady) return;
    await pool.query(`
        CREATE TABLE IF NOT EXISTS user_chad_profile (
            user_id integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            answers jsonb NOT NULL DEFAULT '[]'::jsonb,
            updated_at timestamp DEFAULT now()
        );
    `);
    profileTableReady = true;
}

let historyTableReady = false;
async function ensureChatHistoryTable() {
    if (historyTableReady) return;
    await pool.query(`
        CREATE TABLE IF NOT EXISTS chat_messages (
            id serial PRIMARY KEY,
            user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role text NOT NULL CHECK (role IN ('user','assistant')),
            content text NOT NULL,
            created_at timestamp DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created_at
            ON chat_messages (user_id, created_at DESC);
    `);
    historyTableReady = true;
}

async function getProfileAnswers(userId) {
    await ensureProfileTable();
    const r = await pool.query('SELECT answers FROM user_chad_profile WHERE user_id = $1 LIMIT 1', [userId]);
    return Array.isArray(r.rows?.[0]?.answers) ? r.rows[0].answers : [];
}

const MAX_IMAGE_B64_CHARS = 14_000_000;

function sanitizeMessages(input) {
    const arr = Array.isArray(input) ? input : [];
    return arr
        .map((m) => {
            const role = m?.role === 'assistant' ? 'assistant' : 'user';
            const content = String(m?.content ?? '').trim();
            let image = null;
            const rawB64 = m?.image_base64;
            if (typeof rawB64 === 'string' && rawB64.length > 0) {
                let b64 = rawB64.replace(/^data:image\/\w+;base64,/, '').trim();
                const mime = String(m?.image_mime || 'image/jpeg').trim() || 'image/jpeg';
                if (b64.length > MAX_IMAGE_B64_CHARS) b64 = b64.slice(0, MAX_IMAGE_B64_CHARS);
                if (b64.length > 200) image = { base64: b64, mime };
            }
            return { role, content, image };
        })
        .filter((m) => m.content.length > 0 || m.image)
        .slice(-20);
}

function openAiMessageFromTurn(m) {
    if (m.role === 'assistant') {
        return { role: 'assistant', content: m.content };
    }
    if (m.image) {
        const text = m.content.length ? m.content : 'What do you think? (photo attached)';
        const url = `data:${m.image.mime};base64,${m.image.base64}`;
        return {
            role: 'user',
            content: [
                { type: 'text', text },
                { type: 'image_url', image_url: { url, detail: 'low' } },
            ],
        };
    }
    return { role: 'user', content: m.content };
}

function persistUserLine(lastUserTurn) {
    if (!lastUserTurn || lastUserTurn.role !== 'user') return '';
    const base = String(lastUserTurn.content || '').trim();
    if (lastUserTurn.image) {
        return base.length ? `${base}\n[image attached]` : '[image attached]';
    }
    return base;
}

function getChadRank(workoutCount) {
    if (workoutCount === 0) return 'SUBHUMAN';
    if (workoutCount < 5) return 'SUB-5';
    if (workoutCount < 50) return 'LTN';
    if (workoutCount < 100) return 'MTN';
    if (workoutCount < 200) return 'HTN';
    if (workoutCount < 300) return 'CHAD LITE';
    return 'CHAD';
}

async function userRank(userId) {
    const rows = await db
        .select({ id: workoutSessions.id })
        .from(workoutSessions)
        .where(eq(workoutSessions.user_id, userId));
    return getChadRank(rows.length);
}

async function userStatsContext(userId) {
    const [state] = await db
        .select()
        .from(userTdeeState)
        .where(eq(userTdeeState.user_id, userId))
        .limit(1);
    const [weight] = await db
        .select()
        .from(bodyMetrics)
        .where(eq(bodyMetrics.user_id, userId))
        .orderBy(desc(bodyMetrics.date))
        .limit(1);
    const [plan] = await db
        .select()
        .from(userMacroPlan)
        .where(eq(userMacroPlan.user_id, userId))
        .limit(1);
    const recentLogs = await db
        .select()
        .from(daily_logs)
        .where(eq(daily_logs.userId, userId))
        .orderBy(desc(daily_logs.date))
        .limit(7);
    const sessions = await db
        .select()
        .from(workoutSessions)
        .where(eq(workoutSessions.user_id, userId))
        .orderBy(desc(workoutSessions.date))
        .limit(40);

    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentWorkoutCount = sessions.filter(
        (s) => !s.is_template && new Date(s.date) >= weekAgo
    ).length;

    const lastLog = recentLogs[0];
    const avgCals7 =
        recentLogs.length > 0
            ? Math.round(
                  recentLogs.reduce((sum, r) => sum + (Number(r.calories) || 0), 0) / recentLogs.length
              )
            : null;
    const avgSteps7 =
        recentLogs.length > 0
            ? Math.round(
                  recentLogs.reduce((sum, r) => sum + (Number(r.steps) || 0), 0) / recentLogs.length
              )
            : null;

    const rankLabel = await userRank(userId);
    const anchorTdee = primaryTdeeKcalFromState(state);
    const bfStr =
        weight?.body_fat_pct != null && Number(weight.body_fat_pct) >= 0
            ? `, latest BF ~${weight.body_fat_pct}%`
            : '';

    let rflProteinHint = '';
    if (weight?.weight_kg != null && weight?.body_fat_pct != null) {
        const wkg = Number(weight.weight_kg);
        const bf = Number(weight.body_fat_pct);
        if (Number.isFinite(wkg) && Number.isFinite(bf) && wkg > 0 && bf >= 0 && bf <= 60) {
            const mult = rflProteinGPerLbLbm(bf);
            if (mult != null) {
                const lbmKg = wkg * (1 - bf / 100);
                const lbmLb = lbmKg * 2.2046226218;
                const gProt = Math.round(lbmLb * mult);
                rflProteinHint =
                    `- RFL protein (latest metrics, book-style): LBM ~${lbmLb.toFixed(1)} lb @ ~${bf}% BF → ~${mult} g/lb LBM ≈ **${gProt} g protein/day** (exact lines must match retrieved [rapid_fat_loss] text).\n`;
            }
        }
    } else if (weight?.weight_kg != null) {
        rflProteinHint =
            `- RFL: log **body fat %** (or known LBM) to set protein from g/lb LBM — weight alone is not enough.\n`;
    }

    return (
        `ANCHOR — maintenance TDEE (context for cuts; for RFL, protein-from-LBM rules still drive setup): ${anchorTdee != null ? `${anchorTdee} kcal/day` : 'unknown (no TDEE row — ask them to finish TDEE setup)'}. (ema_tdee when present, else baseline_tdee.)\n` +
        `User app stats snapshot:\n` +
        `- Rank: ${rankLabel}\n` +
        `- Workouts in last 7d: ${recentWorkoutCount}\n` +
        `- Latest weight: ${weight?.weight_kg != null ? `${weight.weight_kg} kg` : 'unknown'}${bfStr}\n` +
        (rflProteinHint ? `${rflProteinHint}` : '') +
        `- Latest log day: ${lastLog?.date || 'none'} (cals: ${lastLog?.calories ?? '—'}, steps: ${lastLog?.steps ?? '—'})\n` +
        `- Avg daily calories (last ${recentLogs.length} logs): ${avgCals7 ?? '—'}\n` +
        `- Avg daily steps (last ${recentLogs.length} logs): ${avgSteps7 ?? '—'}\n` +
        `- Maintenance/TDEE baseline: ${state?.baseline_tdee ?? '—'} kcal, ema_tdee: ${state?.ema_tdee ?? '—'}\n` +
        `- Macro goal: ${plan?.goal ?? 'unknown'}, weekly_change_kg: ${plan?.weekly_change_kg ?? '—'}`
    );
}

async function latestWeightKg(userId) {
    const [weight] = await db
        .select()
        .from(bodyMetrics)
        .where(eq(bodyMetrics.user_id, userId))
        .orderBy(desc(bodyMetrics.date))
        .limit(1);
    return weight?.weight_kg != null ? Number(weight.weight_kg) : null;
}

router.get('/training/questions', requireAuth, requireCoach, async (_req, res) => {
    res.json({ questions: TRAINING_QUESTIONS });
});

router.get('/knowledge/status', requireAuth, async (_req, res) => {
    try {
        const chunksBySource = await knowledgeCountsBySource(CHAD_KNOWLEDGE_SOURCES);
        const emb = await pool.query(
            `SELECT source,
                    COUNT(*)::int AS chunks,
                    COUNT(*) FILTER (WHERE embedding IS NOT NULL)::int AS embedded
             FROM knowledge_chunks
             WHERE source = ANY($1::text[])
             GROUP BY source`,
            [CHAD_KNOWLEDGE_SOURCES]
        );
        const embeddingsBySource = {};
        for (const row of emb.rows) {
            embeddingsBySource[row.source] = { chunks: row.chunks, embedded: row.embedded };
        }
        res.json({
            sources: CHAD_KNOWLEDGE_SOURCES,
            chunksBySource,
            embeddingsBySource,
            semanticRetrievalEnabled:
                process.env.CHAD_USE_SEMANTIC_KNOWLEDGE !== 'false' && Boolean(process.env.OPENAI_API_KEY),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/training', requireAuth, requireCoach, async (req, res) => {
    try {
        const userId = Number(req.userId);
        const answers = await getProfileAnswers(userId);
        res.json({ answers });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/** Persist chat lines without calling the model (e.g. game results). */
router.post('/append', requireAuth, async (req, res) => {
    try {
        const userId = Number(req.userId);
        const raw = req.body?.messages;
        if (!Array.isArray(raw) || raw.length === 0) {
            return res.status(400).json({ error: 'messages array is required' });
        }
        const slice = raw.slice(0, 10);
        const messages = slice
            .map((m) => {
                const role = m?.role === 'assistant' ? 'assistant' : 'user';
                const content = String(m?.content ?? '').trim().slice(0, 100_000);
                return { role, content };
            })
            .filter((m) => m.content.length > 0);
        if (!messages.length) {
            return res.status(400).json({ error: 'no valid messages' });
        }
        await ensureChatHistoryTable();
        for (const m of messages) {
            await pool.query(`INSERT INTO chat_messages (user_id, role, content) VALUES ($1, $2, $3)`, [
                userId,
                m.role,
                m.content,
            ]);
        }
        return res.json({ ok: true, count: messages.length });
    } catch (err) {
        console.error('chat append error:', err);
        return res.status(500).json({ error: err.message });
    }
});

router.get('/history', requireAuth, async (req, res) => {
    try {
        const userId = Number(req.userId);
        await ensureChatHistoryTable();
        const r = await pool.query(
            `SELECT role, content, created_at
             FROM chat_messages
             WHERE user_id = $1
             ORDER BY created_at ASC, id ASC
             LIMIT 200`,
            [userId]
        );
        const messages = r.rows.map((row) => ({
            role: row.role,
            content: row.content,
            created_at: row.created_at,
        }));
        res.json({ messages });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/training', requireAuth, requireCoach, async (req, res) => {
    try {
        const userId = Number(req.userId);
        const incoming = Array.isArray(req.body?.answers) ? req.body.answers : [];
        const answers = incoming
            .map((a, idx) => ({
                question: String(a?.question || TRAINING_QUESTIONS[idx] || '').slice(0, 240),
                answer: String(a?.answer || '').slice(0, 2000),
            }))
            .slice(0, TRAINING_QUESTIONS.length);
        await ensureProfileTable();
        await pool.query(
            `INSERT INTO user_chad_profile (user_id, answers, updated_at)
             VALUES ($1, $2::jsonb, now())
             ON CONFLICT (user_id)
             DO UPDATE SET answers = EXCLUDED.answers, updated_at = now()`,
            [userId, JSON.stringify(answers)]
        );
        res.json({ ok: true, count: answers.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/chat { messages: [{role, content}] }
router.post('/', requireAuth, async (req, res) => {
    try {
        const { apiKey, model } = getOpenAiConfig();
        const userId = Number(req.userId);
        const messages = sanitizeMessages(req.body?.messages);
        if (!messages.length) {
            return res.status(400).json({ error: 'messages are required' });
        }
        const lastUserTurn = [...messages].reverse().find((m) => m.role === 'user');
        const latestUser =
            (lastUserTurn?.content && String(lastUserTurn.content).trim()) ||
            (lastUserTurn?.image ? '(user sent a photo)' : '');
        const rank = await userRank(userId);
        const statsContext = await userStatsContext(userId);
        const recentText = messages
            .map((m) => m.content || (m.image ? '[photo]' : ''))
            .filter(Boolean)
            .join('\n');
        const isRflQ = looksLikeRflProtocolQuestion(recentText);
        const knowledgeQueryText = isRflQ
            ? `${recentText}\nRFL rapid fat loss PSMF protein sparing modified diet no cardio lean body mass gram per pound LBM vegetables trace fat refeed fish oil EPA DHA 2.5g multivitamin electrolytes sodium potassium magnesium`
            : recentText;
        const isMuscleCalQ = looksLikeMuscleCalorieQuestion(latestUser);
        let modelSpecificCalorieRule = '';
        if (isMuscleCalQ) {
            const wKg = await latestWeightKg(userId);
            const rec = muscleSurplusFromLyleModel({ weightKg: wKg, rank });
            if (rec) {
                modelSpecificCalorieRule =
                    `Muscle gain calorie rule for this user (from stage model): ` +
                    `${rec.stage} stage, target surplus ${rec.dailyMin}-${rec.dailyMax} kcal/day above maintenance. ` +
                    `Do not exceed this range unless user explicitly asks for aggressive gain. ` +
                    `Do not output +600/day by default.`;
            }
        }
        const rflCalorieRule = isRflQ ? rflBookFaithfulContext() : '';
        const rflMacroDetailQ = isRflQ && looksLikeRflMacroCalorieQuestion(latestUser);
        const rflMacroAnswerBoost = rflMacroDetailQ
            ? `\nRFL — **this turn is a macro/kcal question:** **Protein g + protein kcal** first (from hint). **No “aim for X g fat”** — RFL has **no fat macro target**, only **trace** from lean protein + supps; **no meaningful carb target** — **barely incidental** from fibrous veg, not a carb line to optimize. Give **~total kcal** as mostly protein plus **small incidentals** described in words (not a 3-macro grid). **Supps:** ~**2.5 g/day EPA+DHA** (labels), **multi**, **electrolytes**. Sound human; no meal-plan rehash.\n`
            : '';
        const profileAnswers = await getProfileAnswers(userId);
        const principlesContext = chadCorePrinciplesContext();
        const retrieved = await searchKnowledge(knowledgeQueryText, CHAD_KNOWLEDGE_SOURCES, isRflQ ? 10 : 8);
        const glossaryHits = glossaryMatchesFromText(recentText).slice(0, 12);
        const glossaryContext =
            glossaryHits.length > 0
                ? `Glossary terms detected:\n${glossaryHits
                      .map(
                          (g) =>
                              `- ${g.term}: ${g.meaning}. Coaching-safe framing: ${g.coaching_safe_rewrite}`
                      )
                      .join('\n')}`
                : 'No glossary terms detected.';
        const profileContext =
            profileAnswers.length > 0
                ? `Coach profile:\n${profileAnswers
                      .filter((a) => a?.answer)
                      .map((a) => `Q: ${a.question}\nA: ${a.answer}`)
                      .join('\n\n')}`
                : 'Coach profile not trained yet.';
        const knowledgeContext =
            retrieved.length > 0
                ? `Knowledge snippets (retrieved via keyword + semantic match when embeddings exist; source in brackets):\n${retrieved
                      .map(
                          (k, i) =>
                              `[${i + 1}] [${k.source}] ${k.title} (${k.url})\n${String(k.chunk_text).slice(0, 900)}`
                      )
                      .join('\n\n')}`
                : 'No knowledge snippets matched for this message.';

        const openAiTurns = messages.map(openAiMessageFromTurn);
        const payload = {
            model,
            temperature: isRflQ ? 0.28 : 0.4,
            messages: [
                {
                    role: 'system',
                    content:
                        `${SYSTEM_PROMPT} User id: ${userId}. ` +
                        `Style rules (strict):
- Keep replies short: 2-6 lines usually.
- Sound like a blunt coach, not a therapist.
- No cringe motivation language.
- Never use phrases like: "best version of yourself", "you've got this", "celebrate progress", "channel that energy", "journey", "thrive".
- If asked social/looks questions (e.g. "do you mog me"), answer directly in slang-aware tone first, then give a practical next step.
- Rank-aware tone rule: current user rank is ${rank}.
- If user rank is below CHAD and they call you "lil bro", check them and keep authority.
- If asked "do you mog me", answer in-character based on rank first, then give one practical next action.
- Prefer concrete actions over generic lists.
- If giving a plan, max 4 bullets (macro/kcal-only follow-ups can be a short paragraph instead).
- You may wrap short emphasis phrases in **double asterisks**; the app shows those as bold. Do not use other markdown (lists are fine as plain lines with numbers or hyphens).
- Use "Later Gator." ONLY when the user is clearly ending the conversation; otherwise never include it.
- If core principles are listed above retrieved snippets, treat them as standing rules; snippets add numbers and specifics.
- If referencing retrieved knowledge snippets, do not invent numbers not present there. If uncertain, say the value is not in the current snippets.
- Never default to generic muscle-gain surplus ranges (e.g. +300 to +500) unless the retrieved source explicitly states that range.
- For muscle-gain calorie questions, stay source-faithful and emphasize that required surplus may be smaller than people think when that appears in sources.
- For RFL/PSMF / rapid fat loss: follow the **RFL book-faithful constraints** block when present (LBM-based protein; **no cardio**; **supplement stack** — EPA+DHA ~2.5 g/day combined from fish oil labels, multivitamin, electrolytes; not “percentage deficit” as the main definition). TDEE in stats is context, not a replacement for that structure.
Do not moralize; keep it practical.\n\n${principlesContext ? `${principlesContext}\n\n` : ''}${glossaryContext}\n\n${profileContext}\n\n${loreSystemContext()}\n\n${knowledgeContext}\n\n${statsContext}\n\n${rflCalorieRule}${rflMacroAnswerBoost}\n\n${modelSpecificCalorieRule}`,
                },
                ...openAiTurns,
            ],
        };

        let text = await callOpenAiChat(apiKey, payload);
        const isLilBroTrigger = /\blil bro\b/i.test(latestUser) && rank !== 'CHAD';
        const hasBoundaryLanguage = /\b(don't|do not|not)\s+lil[- ]?bro\b|\brank\b/i.test(text);
        if (isLilBroTrigger && !hasBoundaryLanguage) {
            const rewritePayload = {
                model,
                temperature: 0.35,
                messages: [
                    {
                        role: 'system',
                        content:
                            'Rewrite the assistant reply in the same tone but enforce authority. ' +
                            'First line must clearly reject being lil-broed because user rank is below CHAD. ' +
                            'Keep it short (2-4 lines), practical, and non-cringe.',
                    },
                    {
                        role: 'user',
                        content:
                            `User message: ${latestUser}\n` +
                            `Current rank: ${rank}\n` +
                            `Draft reply:\n${text}`,
                    },
                ],
            };
            try {
                text = await callOpenAiChat(apiKey, rewritePayload);
            } catch {
                // keep original draft if rewrite fails
            }
        }

        // Grounding guard: prevent generic surplus hallucinations on muscle-calorie questions.
        const hasGenericSurplus = /\b(250|300|350|400|450|500)\s*[-to]{0,3}\s*(300|350|400|450|500)?\s*cal/i.test(
            text
        );
        const hasBad600 = /\b600\s*(cal|kcal)\b/i.test(text);
        if (isMuscleCalQ && retrieved.length > 0 && (hasGenericSurplus || hasBad600)) {
            const groundPayload = {
                model,
                temperature: 0.2,
                messages: [
                    {
                        role: 'system',
                        content:
                            'Rewrite the reply to be strictly grounded in provided source snippets. ' +
                            'Remove unsupported generic surplus ranges and remove default +600/day style claims. Keep concise, practical, and in Chad Bot tone.',
                    },
                    {
                        role: 'user',
                        content:
                            `User question: ${latestUser}\n\n` +
                            `Draft reply:\n${text}\n\n` +
                            `Source snippets:\n${knowledgeContext}\n\n` +
                            `Model calorie rule:\n${modelSpecificCalorieRule}`,
                    },
                ],
            };
            try {
                text = await callOpenAiChat(apiKey, groundPayload);
            } catch {
                // keep prior draft if rewrite fails
            }
        }

        if (isRflQ) {
            const cardioSlip =
                /\b(hiit|high[- ]intensity|steady[- ]state)\b/i.test(text) ||
                (/\bcardio\b/i.test(text) &&
                    /\b(2|3|two|three|times|×|x|sessions?|per week|\/week|days?\s*a\s*week)\b/i.test(text));
            const cardioOk =
                /\b(no cardio|without cardio|avoid cardio|skip cardio|don'?t do cardio|no extra cardio)\b/i.test(text);
            if (cardioSlip && !cardioOk) {
                try {
                    text = await callOpenAiChat(apiKey, {
                        model,
                        temperature: 0.15,
                        messages: [
                            {
                                role: 'system',
                                content:
                                    'Rewrite shorter in the same blunt Chad voice. RFL: remove HIIT, steady-state, and extra cardio blocks — standard book framing is **no cardio**. Keep protein-from-LBM setup, fibrous veggies. Do not reintroduce cardio.',
                            },
                            { role: 'user', content: text },
                        ],
                    });
                } catch {
                    /* keep draft */
                }
            }

            if (rflReplyLooksGenericDeficit(text)) {
                try {
                    text = await callOpenAiChat(apiKey, {
                        model,
                        temperature: 0.15,
                        messages: [
                            {
                                role: 'system',
                                content:
                                    'Rewrite the reply in the same blunt Chad voice. Max 4 short bullets/lines. ' +
                                    'RFL / PSMF book setup: **Lead with protein from LBM × g/lb** (use user stats RFL protein hint if present; else say you need **weight + body-fat %** or known LBM — no guessing, no default “150 g”). ' +
                                    '**Macros:** **no prescribed fat grams** (no 25–50 g “targets”) — **trace only**; **no carb macro to hit** — near-zero intentional carbs. Carbs = **incidental from veg**, not 30–60 g planned. Not 100–150 g starches. ' +
                                    '**Food:** lean protein + fibrous vegetables; **do not** suggest bread, toast, grains, rice, pasta, oats as routine meals. ' +
                                    '**Supplements (required):** ~**2.5 g/day combined EPA+DHA** (fish oil label), **multivitamin**, **electrolytes** per book/snippets — not “consider fish oil.” ' +
                                    '**No cardio.** Do **not** center the plan on a **calorie number range** or “% below maintenance.” Match snippet numbers.',
                            },
                            {
                                role: 'user',
                                content:
                                    `Stats block (for protein hint / missing data):\n${statsContext}\n\n` +
                                    `Draft to fix:\n${text}`,
                            },
                        ],
                    });
                } catch {
                    /* keep draft */
                }
            }
        }

        const reply = normalizeSignoff(text, isConversationEnding(latestUser));
        await ensureChatHistoryTable();
        const userPersist = persistUserLine(lastUserTurn);
        await pool.query(
            `INSERT INTO chat_messages (user_id, role, content)
             VALUES ($1, 'user', $2), ($1, 'assistant', $3)`,
            [userId, userPersist, reply]
        );
        return res.json({ reply });
    } catch (err) {
        console.error('chat error:', err);
        if (String(err.message || '').includes('Chat provider error')) {
            return res.status(502).json({ error: err.message });
        }
        return res.status(500).json({ error: err.message });
    }
});

export default router;

