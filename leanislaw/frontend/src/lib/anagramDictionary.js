/**
 * English words for anagram validation (~275k source, filtered to 3–8 letters).
 * Loaded as a separate chunk; built once on first access.
 */
import wordArray from "an-array-of-english-words";

const MIN_LEN = 3;
const MAX_LEN = 8;

let cached = null;

export function getAnagramDictionary() {
    if (cached) return cached;
    cached = new Set();
    for (const w of wordArray) {
        const x = String(w).toLowerCase();
        if (x.length < MIN_LEN || x.length > MAX_LEN) continue;
        if (!/^[a-z]+$/.test(x)) continue;
        cached.add(x);
    }
    return cached;
}
