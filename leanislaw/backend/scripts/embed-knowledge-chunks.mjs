#!/usr/bin/env node
/**
 * Compute OpenAI embeddings for knowledge_chunks (semantic Chad retrieval).
 * Run after ingest:knowledge:local or ingest-bodyrecomp.
 *
 *   cd leanislaw
 *   npm run embed:knowledge
 *
 * Optional: --sources=rapid_fat_loss,bodyrecomposition
 * Optional: --batch=32
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pool from '../db.js';
import { embedTexts } from '../lib/embeddings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

function parseArgs(argv) {
    let sources = null;
    let batch = 32;
    for (const a of argv) {
        if (a.startsWith('--sources=')) {
            sources = a
                .slice('--sources='.length)
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
        } else if (a.startsWith('--batch=')) {
            batch = Math.max(1, Number(a.slice('--batch='.length)) || 32);
        }
    }
    return { sources, batch };
}

const { sources, batch } = parseArgs(process.argv.slice(2));

if (!process.env.OPENAI_API_KEY?.trim()) {
    console.error('OPENAI_API_KEY required for embeddings.');
    process.exit(1);
}

await pool.query(`ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS embedding jsonb`);

const params = [];
let sql = `SELECT id, title, chunk_text, source FROM knowledge_chunks WHERE embedding IS NULL`;
if (sources?.length) {
    sql += ` AND source = ANY($1::text[])`;
    params.push(sources);
}
sql += ` ORDER BY id ASC`;

const { rows } = await pool.query(sql, params);
console.log(`Chunks needing embeddings: ${rows.length}`);

let done = 0;
for (let i = 0; i < rows.length; i += batch) {
    const slice = rows.slice(i, i + batch);
    const inputs = slice.map((r) => `${r.title}\n\n${r.chunk_text}`);
    const vectors = await embedTexts(inputs);
    for (let j = 0; j < slice.length; j++) {
        await pool.query(`UPDATE knowledge_chunks SET embedding = $1::jsonb WHERE id = $2`, [
            JSON.stringify(vectors[j]),
            slice[j].id,
        ]);
        done += 1;
    }
    console.log(`Embedded ${done}/${rows.length}`);
}

console.log('Done.');
await pool.end();
