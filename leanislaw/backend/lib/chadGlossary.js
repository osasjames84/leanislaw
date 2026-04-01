export const CHAD_GLOSSARY = [
    {
        term: "mog",
        meaning: "to look better than someone; dominate in appearance",
        allowed_usage: "all",
        coaching_safe_rewrite:
            "Focus on improving your own physique, style, and presence instead of comparing",
    },
    {
        term: "ascend",
        meaning: "to improve looks, status, or life outcomes",
        allowed_usage: "all",
        coaching_safe_rewrite:
            "Commit to consistent progress in fitness, grooming, and discipline",
    },
    {
        term: "cope",
        meaning: "dismissal of someone as making excuses",
        allowed_usage: "all",
        coaching_safe_rewrite:
            "Identify what is in your control and take action instead of focusing on excuses",
    },
    {
        term: "chad",
        meaning: "highly attractive, confident male archetype",
        allowed_usage: "all",
        coaching_safe_rewrite:
            "Build confidence, physique, and social skills to improve attractiveness",
    },
    {
        term: "chadlite",
        meaning: "above average but not elite in attractiveness",
        allowed_usage: "all",
        coaching_safe_rewrite:
            "Aim for steady improvement; small gains compound over time",
    },
    {
        term: "stacy",
        meaning: "highly attractive female archetype",
        allowed_usage: "all",
        coaching_safe_rewrite:
            "Focus on becoming your best self rather than idealizing others",
    },
    {
        term: "becky",
        meaning: "average-looking female",
        allowed_usage: "all",
        coaching_safe_rewrite:
            "Attraction is subjective; focus on compatibility and self-growth",
    },
    {
        term: "ltb",
        meaning: "looks threshold barrier (minimum attractiveness level)",
        allowed_usage: "all",
        coaching_safe_rewrite:
            "Improve fundamentals like grooming, fitness, and posture to raise baseline attractiveness",
    },
    {
        term: "htb",
        meaning: "high-tier barrier (top-level attractiveness threshold)",
        allowed_usage: "all",
        coaching_safe_rewrite:
            "Maximize what you can control and focus on high-impact improvements",
    },
    {
        term: "mtn",
        meaning: "mid-tier normie (average person)",
        allowed_usage: "all",
        coaching_safe_rewrite:
            "Being average is a starting point; consistent effort can set you apart",
    },
    {
        term: "ltn",
        meaning: "low-tier normie (below average)",
        allowed_usage: "all",
        coaching_safe_rewrite:
            "Start with foundational habits; fitness, grooming, and mindset can significantly improve results",
    },
    {
        term: "htn",
        meaning: "high-tier normie (above average but not elite)",
        allowed_usage: "all",
        coaching_safe_rewrite: "Focus on refining details to move from good to great",
    },
    {
        term: "looksmax",
        meaning: "maximizing physical appearance",
        allowed_usage: "all",
        coaching_safe_rewrite:
            "Work on fitness, skincare, grooming, posture, and style",
    },
    {
        term: "brutal",
        meaning: "used to emphasize harsh or difficult truths",
        allowed_usage: "all",
        coaching_safe_rewrite:
            "Acknowledge challenges, but focus on actionable steps forward",
    },
    {
        term: "it's over",
        meaning: "expression of hopelessness about improvement",
        allowed_usage: "all",
        coaching_safe_rewrite:
            "Progress is still possible; focus on what you can improve step by step",
    },
    {
        term: "blackpill",
        meaning: "belief that genetics determine everything and effort is useless",
        allowed_usage: "all",
        coaching_safe_rewrite:
            "Genetics matter, but effort in fitness, grooming, and mindset can still create meaningful change",
    },
    {
        term: "redpill",
        meaning: "belief in certain truths about attraction and dynamics",
        allowed_usage: "all",
        coaching_safe_rewrite:
            "Focus on self-improvement, confidence, and communication skills",
    },
    {
        term: "gymcel",
        meaning: "someone who trains but feels unattractive",
        allowed_usage: "all",
        coaching_safe_rewrite:
            "Stay consistent; progress in the gym and lifestyle changes take time",
    },
    {
        term: "truecel",
        meaning: "someone who believes they cannot attract partners at all",
        allowed_usage: "all",
        coaching_safe_rewrite:
            "Work on controllable factors like fitness, grooming, and social exposure",
    },
    {
        term: "subhuman",
        meaning: "extreme negative self-label or insult",
        allowed_usage: "all",
        coaching_safe_rewrite:
            "Avoid negative labels; focus on building skills and improving step by step",
    },
];

function esc(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function glossaryMatchesFromText(text) {
    const raw = String(text || "").toLowerCase();
    const matches = [];
    for (const item of CHAD_GLOSSARY) {
        const re = new RegExp(`\\b${esc(item.term.toLowerCase())}\\b`, "i");
        if (re.test(raw)) matches.push(item);
    }
    return matches;
}

