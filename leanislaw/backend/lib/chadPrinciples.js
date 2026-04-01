import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Optional file: backend/knowledge/chad-core-principles.txt (or .md) — always injected; edit with your non‑negotiables. */
const CANDIDATE_FILES = ['chad-core-principles.txt', 'chad-core-principles.md'];

let cache = { text: '', pathRead: null, mtime: 0 };

/**
 * Short text always included in Chad’s system prompt (not retrieval-dependent).
 * Put distilled principles here so nuance you care about is always visible to the model.
 */
export function chadCorePrinciplesContext() {
    const override = process.env.CHAD_PRINCIPLES_PATH?.trim();
    const baseDir = path.join(__dirname, '..', 'knowledge');
    const tryPaths = override
        ? [path.resolve(override)]
        : CANDIDATE_FILES.map((f) => path.join(baseDir, f));

    for (const p of tryPaths) {
        try {
            const st = fs.statSync(p);
            if (!st.isFile()) continue;
            if (cache.pathRead === p && cache.mtime === Number(st.mtimeMs)) {
                return cache.text;
            }
            const text = fs.readFileSync(p, 'utf8').trim();
            cache = { text, pathRead: p, mtime: Number(st.mtimeMs) };
            if (!text) continue;
            return (
                `Core principles (always follow these; retrieved snippets add detail and numbers):\n${text.slice(0, 6000)}`
            );
        } catch {
            /* missing */
        }
    }
    return '';
}
