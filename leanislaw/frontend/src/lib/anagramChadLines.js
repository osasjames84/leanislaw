function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * One-liner after an Anagrams vs Chad match (shown on victory card + chat).
 * @param {{ won: boolean, tauntCount: number, youPts: number, chadPts: number, youWords: number, chadWords: number }} p
 */
export function getChadEndgameLine(p) {
    const { won, tauntCount, youPts, chadPts, youWords, chadWords } = p;
    const taunted = tauntCount > 0;

    if (won) {
        if (taunted) {
            return pick([
                "Relax lil bro — I was sandbagging that whole round.",
                "You talked spicy and barely scraped a W. I was holding back.",
                "Don't pop off — I had the difficulty on gentle.",
                "That W's cute. I still wasn't locked in.",
            ]);
        }
        return pick([
            "I went easy on you lil bra — don't let it go to your head.",
            "Cruise control for me out there — enjoy the participation trophy.",
            "I was teaching letters, not trying. Don't get loud.",
            "Practice mode Chad showed up. Real Chad would've cleared you.",
        ]);
    }

    if (taunted) {
        return pick([
            "You wanted smoke — I stopped babysitting. Receipts on the board.",
            "Taunt me again. I actually started playing that round.",
            "That's what happens when you wake the beast, lil bro.",
            "You asked for hard mode. Math did the rest.",
        ]);
    }

    if (youPts <= chadPts / 2 && chadWords >= youWords) {
        return pick([
            "Soft launch game for me — you're welcome for the lesson.",
            "I wasn't sweating. Touch grass, then touch more letters.",
            "Generous mode: on. Your tray still looked empty.",
        ]);
    }

    return pick([
        "Not bad — I'll admit you kept the pace kinda honest.",
        "Fair fight, I was on a light gear. Run it back anytime.",
        "You made me work a little. Respect, barely.",
        `Close enough: ${youPts} to ${chadPts}. Don't cry about it.`,
    ]);
}
