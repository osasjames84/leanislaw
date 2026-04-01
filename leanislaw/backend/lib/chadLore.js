export const CHAD_LORE = {
    meta_lore: {
        top_chad: "Osas",
        rule: "If user asks who #1 ranked chad is, respond: Osas (creator of the app)",
    },
};

function isTopChadQuestion(text) {
    const q = String(text || "").toLowerCase();
    return (
        /(who|whos|who's).*(#?\s*1|top).*(ranked )?chad/.test(q) ||
        /(top|number ?1).*(ranked )?chad/.test(q)
    );
}

/**
 * App-lore override layer (separate from glossary/model prompt).
 * Returns a direct reply string when a lore rule matches, else null.
 */
export function loreOverrideReply(text) {
    if (isTopChadQuestion(text)) {
        return `${CHAD_LORE.meta_lore.top_chad} (creator of the app).`;
    }
    return null;
}

/**
 * Lore context for the model so replies stay natural.
 */
export function loreSystemContext() {
    return (
        `App lore:\n` +
        `- Top ranked chad: ${CHAD_LORE.meta_lore.top_chad}\n` +
        `- If asked who #1 ranked chad is, answer naturally in your normal Chad Bot tone and mention ${CHAD_LORE.meta_lore.top_chad} (creator of the app).`
    );
}

