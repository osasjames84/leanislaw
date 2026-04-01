import { insertKnowledgeChunks } from '../lib/knowledgeStore.js';

const BASE = 'https://bodyrecomposition.com';

function uniq(arr) {
    return [...new Set(arr)];
}

function stripHtml(html) {
    return String(html || '')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function chunkText(text, size = 1400) {
    const out = [];
    const t = String(text || '').trim();
    if (!t) return out;
    for (let i = 0; i < t.length; i += size) {
        out.push(t.slice(i, i + size));
    }
    return out;
}

function extractLinks(html) {
    const links = [];
    const re = /href="([^"]+)"/g;
    let m;
    while ((m = re.exec(html))) {
        links.push(m[1]);
    }
    return uniq(
        links
            .map((u) => {
                if (u.startsWith('http')) return u;
                if (u.startsWith('/')) return `${BASE}${u}`;
                return null;
            })
            .filter(Boolean)
            .filter((u) => u.startsWith(BASE))
            .filter((u) => !u.includes('/wp-'))
            .filter((u) => !u.includes('/tag/'))
            .filter((u) => !u.includes('/category/'))
            .filter((u) => !u.includes('/shop'))
    );
}

async function fetchText(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`fetch failed: ${url} (${r.status})`);
    return await r.text();
}

async function main() {
    const homepage = await fetchText(`${BASE}/`);
    const links = extractLinks(homepage).slice(0, 80);
    let attempted = 0;
    let insertedTotal = 0;
    for (const url of links) {
        try {
            const html = await fetchText(url);
            const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
            const title = titleMatch ? stripHtml(titleMatch[1]).slice(0, 240) : url;
            const body = stripHtml(html);
            if (body.length < 800) continue;
            const chunks = chunkText(body, 1400).slice(0, 10).map((c) => ({
                source: 'bodyrecomposition',
                url,
                title,
                chunk_text: c,
            }));
            const inserted = await insertKnowledgeChunks(chunks);
            insertedTotal += inserted;
            attempted += 1;
            console.log(`ingested: ${url} (+${inserted})`);
        } catch {
            // skip bad page
        }
    }
    console.log(`done. pages: ${attempted}, chunks inserted: ${insertedTotal}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});

