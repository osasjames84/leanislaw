/**
 * English words for anagram validation (~275k source, filtered to 3–8 letters).
 * Also builds the six-letter master bank for racks (500+ words) in the same pass.
 */
import wordArray from "an-array-of-english-words";

const MIN_LEN = 3;
const MAX_LEN = 8;

let cached = null;
/** @type {string[] | null} */
let sixLetterMasterBank = null;

export function getAnagramDictionary() {
    if (cached) return cached;
    cached = new Set();
    const six = [];
    const sixSeen = new Set();
    for (const w of wordArray) {
        const x = String(w).toLowerCase();
        if (x.length < MIN_LEN || x.length > MAX_LEN) continue;
        if (!/^[a-z]+$/.test(x)) continue;
        cached.add(x);
        if (x.length === 6 && !sixSeen.has(x)) {
            sixSeen.add(x);
            six.push(x);
        }
    }
    sixLetterMasterBank = six;
    return cached;
}

/** All unique six-letter words from the list (used as random round masters). */
export function getSixLetterMasterBank() {
    getAnagramDictionary();
    return sixLetterMasterBank ?? [];
}
