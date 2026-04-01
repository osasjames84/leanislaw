import pool from '../db.js';
import { cosineSimilarity, embedQuery } from './embeddings.js';

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
    await pool.query(`ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS embedding jsonb`);
    ready = true;
}

function parseEmbedding(row) {
    const e = row.embedding;
    if (e == null) return null;
    if (Array.isArray(e)) return e;
    return null;
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

/** @param {string | string[]} source One source id or list (e.g. ['bodyrecomposition','rapid_fat_loss']) */
export async function searchKnowledge(query, source = 'bodyrecomposition', limit = 4) {
    await ensureKnowledgeTable();
    const sources = (Array.isArray(source) ? source : [source]).map((s) => String(s).trim()).filter(Boolean);
    if (!sources.length) return [];
    const rows = await pool.query(
        `SELECT id, source, url, title, chunk_text, embedding
         FROM knowledge_chunks
         WHERE source = ANY($1::text[])
         ORDER BY created_at DESC
         LIMIT 2000`,
        [sources]
    );
    const lim = Math.max(1, Math.min(12, Number(limit) || 4));
    const list = rows.rows.map((r) => ({
        id: r.id,
        source: r.source,
        url: r.url,
        title: r.title,
        chunk_text: r.chunk_text,
        _vec: parseEmbedding(r),
    }));

    const withVec = list.filter((r) => r._vec);
    const useSemantic =
        process.env.CHAD_USE_SEMANTIC_KNOWLEDGE !== 'false' &&
        Boolean(process.env.OPENAI_API_KEY?.trim()) &&
        withVec.length >= 8 &&
        list.length > 0 &&
        withVec.length / list.length >= 0.35;

    let qVec = null;
    const q = String(query || '').trim();
    if (useSemantic && q.length > 1) {
        try {
            qVec = await embedQuery(q.slice(0, 8000));
        } catch {
            qVec = null;
        }
    }

    const kwScores = list.map((r) => scoreChunk(query, r.chunk_text + ' ' + r.title));
    const kwMax = Math.max(1, ...kwScores);

    let scored;
    if (qVec) {
        scored = list.map((r, i) => {
            const kw = kwScores[i] / kwMax;
            const sem = r._vec ? cosineSimilarity(qVec, r._vec) : 0;
            const hybrid = r._vec ? 0.72 * sem + 0.28 * kw : kw;
            return { ...r, _score: hybrid };
        });
    } else {
        scored = list
            .map((r, i) => ({ ...r, _score: kwScores[i] }))
            .filter((r) => r._score > 0);
    }

    return scored
        .sort((a, b) => b._score - a._score)
        .slice(0, lim)
        .map(({ _vec, _score, ...rest }) => rest);
}

export async function knowledgeCount(source = 'bodyrecomposition') {
    await ensureKnowledgeTable();
    const r = await pool.query(`SELECT COUNT(*)::int AS c FROM knowledge_chunks WHERE source = $1`, [source]);
    return r.rows[0]?.c || 0;
}

/** Counts per source for status UI. */
export async function knowledgeCountsBySource(sources) {
    await ensureKnowledgeTable();
    const list = (Array.isArray(sources) ? sources : [sources]).map((s) => String(s).trim()).filter(Boolean);
    if (!list.length) return {};
    const r = await pool.query(
        `SELECT source, COUNT(*)::int AS c FROM knowledge_chunks WHERE source = ANY($1::text[]) GROUP BY source`,
        [list]
    );
    const out = {};
    for (const s of list) out[s] = 0;
    for (const row of r.rows) out[row.source] = row.c;
    return out;
}

