const MODEL = 'text-embedding-3-small';

export async function embedTexts(strings) {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not set');
    }
    const list = strings.map((s) => String(s || '').slice(0, 8000));
    const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: MODEL, input: list }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.error?.message || `OpenAI embeddings HTTP ${res.status}`);
    }
    if (!data.data || !Array.isArray(data.data)) {
        throw new Error('Invalid embeddings response');
    }
    return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

export async function embedQuery(text) {
    const [vec] = await embedTexts([text]);
    return vec;
}

export function cosineSimilarity(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) {
        return 0;
    }
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
        const x = a[i];
        const y = b[i];
        dot += x * y;
        na += x * x;
        nb += y * y;
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    return denom === 0 ? 0 : dot / denom;
}
