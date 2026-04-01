import pool from '../db.js';

let ready = false;

export async function ensureKnowledgeTable() {
    if (ready) return;
    await pool.query(`
        CREATE TABLE IF NOT EXISTS knowledge_chunks (
            id serial PRIMARY KEY,
            source text NOT NULL,
            url text NOT NULL,
            title text NOT NULL,
            chunk_text text NOT NULL,
            created_at timestamp DEFAULT now(),
            UNIQUE(source, url, chunk_text)
        );
    `);
    ready = true;
}

export async function insertKnowledgeChunks(rows) {
    await ensureKnowledgeTable();
    if (!Array.isArray(rows) || rows.length === 0) return 0;
    let inserted = 0;
    for (const r of rows) {
        const source = String(r.source || '').trim();
        const url = String(r.url || '').trim();
        const title = String(r.title || '').trim().slice(0, 300);
        const chunk = String(r.chunk_text || '').trim();
        if (!source || !url || !title || !chunk) continue;
        const res = await pool.query(
            `INSERT INTO knowledge_chunks (source, url, title, chunk_text)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (source, url, chunk_text) DO NOTHING
             RETURNING id`,
            [source, url, title, chunk]
        );
        if (res.rowCount > 0) inserted += 1;
    }
    return inserted;
}

function scoreChunk(query, text) {
    const qWords = String(query || '')
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .filter((w) => w.length > 2);
    if (!qWords.length) return 0;
    const t = String(text || '').toLowerCase();
    let score = 0;
    for (const w of qWords) {
        if (t.includes(w)) score += 1;
    }
    return score;
}

export async function searchKnowledge(query, source = 'bodyrecomposition', limit = 4) {
    await ensureKnowledgeTable();
    const rows = await pool.query(
        `SELECT id, source, url, title, chunk_text
         FROM knowledge_chunks
         WHERE source = $1
         ORDER BY created_at DESC
         LIMIT 1200`,
        [source]
    );
    const scored = rows.rows
        .map((r) => ({ ...r, _score: scoreChunk(query, r.chunk_text + ' ' + r.title) }))
        .filter((r) => r._score > 0)
        .sort((a, b) => b._score - a._score)
        .slice(0, Math.max(1, Math.min(8, Number(limit) || 4)));
    return scored;
}

export async function knowledgeCount(source = 'bodyrecomposition') {
    await ensureKnowledgeTable();
    const r = await pool.query(`SELECT COUNT(*)::int AS c FROM knowledge_chunks WHERE source = $1`, [source]);
    return r.rows[0]?.c || 0;
}

