#!/usr/bin/env node
/**
 * Load a local manuscript (.txt, .md, or .pdf) into knowledge_chunks for Chad retrieval.
 *
 *   cd leanislaw
 *   node backend/scripts/ingest-local-knowledge.mjs ./book.pdf --source=rapid_fat_loss --title="Rapid fat loss"
 *
 * Env: DATABASE_URL or DB_* (same as the app). Loads backend/.env if present.
 */
import { createRequire } from 'node:module';
import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { insertKnowledgeChunks } from '../lib/knowledgeStore.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

function chunkText(text, size = 1400) {
    const out = [];
    const t = String(text || '').trim();
    if (!t) return out;
    for (let i = 0; i < t.length; i += size) {
        out.push(t.slice(i, i + size));
    }
    return out;
}

function normalizeText(t) {
    return String(t || '')
        .replace(/\r\n/g, '\n')
        .replace(/\f/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

async function loadManuscriptText(absPath) {
    const ext = path.extname(absPath).toLowerCase();
    if (ext === '.pdf') {
        const buf = await fs.readFile(absPath);
        const data = await pdfParse(buf);
        const text = normalizeText(data.text);
        if (!text.length) {
            throw new Error('PDF had no extractable text (scanned images need OCR).');
        }
        return text;
    }
    const raw = await fs.readFile(absPath, 'utf8');
    return normalizeText(raw.replace(/\r\n/g, '\n'));
}

function parseArgs(argv) {
    let file = '';
    let source = 'rapid_fat_loss';
    let title = 'Rapid fat loss handbook';
    for (const a of argv) {
        if (a.startsWith('--source=')) source = a.slice('--source='.length).trim() || source;
        else if (a.startsWith('--title=')) title = a.slice('--title='.length).trim() || title;
        else if (!a.startsWith('-')) file = a;
    }
    return { file, source, title };
}

const { file, source, title } = parseArgs(process.argv.slice(2));

if (!file) {
    console.error(
        `Usage: node backend/scripts/ingest-local-knowledge.mjs <file.pdf|.md|.txt> [--source=rapid_fat_loss] [--title="Title"]`
    );
    process.exit(1);
}

const abs = path.isAbsolute(file) ? path.normalize(file) : path.resolve(process.cwd(), file);

let manuscript;
try {
    manuscript = await loadManuscriptText(abs);
} catch (e) {
    console.error(e.message || e);
    process.exit(1);
}

const parts = chunkText(manuscript);

const rows = parts.map((chunk, i) => ({
    source,
    url: `local://${source}#${i + 1}`,
    title: `${title} (section ${i + 1}/${parts.length})`,
    chunk_text: chunk,
}));

const inserted = await insertKnowledgeChunks(rows);
console.log(`File: ${abs}`);
console.log(`Source: ${source} — chunks: ${parts.length}, newly inserted: ${inserted}`);
if (inserted === 0 && parts.length > 0) {
    console.log('(0 new rows usually means this text was already ingested; change content or use a new source id.)');
}
