import express from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const CHAD_LINES = [
    'Brutal move. It\'s over.',
    'Cold calculation.',
    'You walked into that one.',
    'I saw that five moves ago.',
    'Respect the tempo.',
];

const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);

/**
 * GET /api/v1/chess/move?fen=<FEN>&difficulty=easy|medium|hard
 * Proxies to Python chess service; returns { uci, done, result?, line? }.
 */
router.get('/move', requireAuth, async (req, res) => {
    const fen = String(req.query.fen ?? '').trim();
    if (!fen) {
        return res.status(400).json({ error: 'fen query parameter is required' });
    }
    const rawDiff = String(req.query.difficulty ?? 'medium').toLowerCase();
    const difficulty = DIFFICULTIES.has(rawDiff) ? rawDiff : 'medium';

    const base = (process.env.CHESS_AI_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
    const url = new URL('/best-move', `${base}/`);
    url.searchParams.set('fen', fen);
    url.searchParams.set('difficulty', difficulty);

    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 25_000);
        const r = await fetch(url.toString(), { signal: ctrl.signal });
        clearTimeout(t);
        const text = await r.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            return res.status(502).json({ error: 'Chess AI returned invalid JSON', detail: text.slice(0, 200) });
        }
        if (!r.ok) {
            return res.status(502).json({ error: data.detail || data.error || 'Chess AI error', status: r.status });
        }
        const line = CHAD_LINES[Math.floor(Math.random() * CHAD_LINES.length)];
        return res.json({ ...data, line });
    } catch (err) {
        const msg = err.name === 'AbortError' ? 'Chess AI timed out' : err.message || String(err);
        console.error('chess proxy:', msg);
        return res.status(502).json({ error: 'Chess AI unavailable', detail: msg });
    }
});

export default router;
