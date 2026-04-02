import { useEffect, useMemo, useRef, useState } from "react";
import Sub5Image from "../assets/sub5.png";
import ChadPhoto from "../assets/creator_photo.png";
import anagramBg from "../assets/anagram_bg.png";
import { getChadEndgameLine } from "../lib/anagramChadLines.js";
import { playUiSound } from "../lib/uiSounds.js";

/** Extra valid words (gym slang) in addition to the English dictionary. */
const WORD_BANK = [
    "bench",
    "squat",
    "press",
    "curls",
    "chalk",
    "reps",
    "bulk",
    "delta",
    "core",
    "flex",
    "lean",
    "lift",
    "gain",
    "shred",
    "snatch",
    "clean",
    "jerk",
    "macros",
    "protein",
    "plates",
    "delts",
    "lats",
    "traps",
    "quads",
    "calves",
    "cardio",
    "swole",
    "grind",
    "stack",
    "ripped",
    "deload",
    "superset",
];

const SESSION_SECONDS = 60;
const NAV_LIFT_PX = 72;
const MIN_WORD_LEN = 3;

function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/** Fixed rack positions: slot index stays stable when other letters are picked. */
function withPoolSlots(tiles) {
    return tiles.map((t, i) => ({ ...t, poolSlot: i }));
}

function letterCountsFromWord(word) {
    const m = {};
    for (const c of word.toLowerCase()) {
        m[c] = (m[c] || 0) + 1;
    }
    return m;
}

/** Word's letters fit inside the bank multiset (for validation). */
function wordFitsBank(wordLower, bankCounts) {
    const need = letterCountsFromWord(wordLower);
    for (const c of Object.keys(need)) {
        if ((bankCounts[c] || 0) < need[c]) return false;
    }
    return true;
}

/** Valid plays = English dictionary + gym WORD_BANK, intersect multiset of bank. */
function buildValidWordSet(bankCounts, dict) {
    const set = new Set();
    for (const w of dict) {
        if (wordFitsBank(w, bankCounts)) set.add(w);
    }
    for (const w of WORD_BANK) {
        const wl = w.toLowerCase();
        if (wl.length < MIN_WORD_LEN) continue;
        if (wordFitsBank(wl, bankCounts)) set.add(wl);
    }
    return set;
}

const MIN_FORMABLE_WORDS = 4;
const MASTER_PICK_ATTEMPTS = 160;

function hasEnoughFormableWords(bankCounts, dict, minRequired) {
    let n = 0;
    for (const w of dict) {
        if (wordFitsBank(w, bankCounts)) {
            n++;
            if (n >= minRequired) return true;
        }
    }
    for (const w of WORD_BANK) {
        const wl = w.toLowerCase();
        if (wl.length < MIN_WORD_LEN || dict.has(wl)) continue;
        if (wordFitsBank(wl, bankCounts)) {
            n++;
            if (n >= minRequired) return true;
        }
    }
    return false;
}

/**
 * Random six-letter master from {@link SIX_LETTER_MASTER_BANK} each round.
 * Rejects boards with too few plays until MIN_FORMABLE_WORDS or attempts exhausted.
 */
function pickMasterWord(dict, masterPool) {
    if (!masterPool.length) return "plates";
    for (let attempt = 0; attempt < MASTER_PICK_ATTEMPTS; attempt++) {
        const master = masterPool[Math.floor(Math.random() * masterPool.length)];
        const counts = letterCountsFromWord(master);
        if (hasEnoughFormableWords(counts, dict, MIN_FORMABLE_WORDS)) {
            return master;
        }
    }
    return masterPool[Math.floor(Math.random() * masterPool.length)];
}

const CHAD_QUIPS = [
    "Fine, that one was easy.",
    "Okay, keep going.",
    "I'll pretend that took brain power.",
    "Find another — same letters.",
    "Not bad — what else you got?",
];

function tilesForWord(word, key) {
    const lower = word.toLowerCase();
    return lower.split("").map((char, i) => ({
        id: `k${key}-i${i}`,
        char: char.toUpperCase(),
    }));
}

function formatTimeMmSs(sec) {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
}

function padScore(n) {
    return String(Math.min(999_999, Math.max(0, n))).padStart(6, "0");
}

/** Points by word length (rack is always 6 letters; longest play is 6). */
function pointsForWordLength(len) {
    if (len <= 3) return 100;
    if (len === 4) return 400;
    if (len === 5) return 1200;
    return 2000;
}

function computeWinner(youPts, chadPts, youWords, chadWords) {
    if (youPts > chadPts) return true;
    if (youPts < chadPts) return false;
    if (youWords > chadWords) return true;
    if (youWords < chadWords) return false;
    return false;
}

/**
 * Full-screen anagram mini-game — Sub-5 profile as backdrop (dashboard look).
 * One 60s round vs Chad: he starts easy; taunting makes him hunt harder words faster.
 */
const ANAGRAM_SNAPSHOT_V = 1;

export default function AnagramGame({ onClose, onGameComplete, resumeSnapshot, onPause }) {
    const [phase, setPhase] = useState("intro");
    const [pool, setPool] = useState([]);
    const [guess, setGuess] = useState([]);
    const [feedback, setFeedback] = useState("");
    const [feedbackTone, setFeedbackTone] = useState("neutral");
    const [solvedWords, setSolvedWords] = useState([]);
    const [points, setPoints] = useState(0);
    const [timeLeft, setTimeLeft] = useState(SESSION_SECONDS);
    const [sessionKey, setSessionKey] = useState(0);
    const [bankLetterCount, setBankLetterCount] = useState(0);
    const sessionEndHandled = useRef(false);
    const bankTilesRef = useRef([]);
    /** Filled when dictionary loads; six-letter words for random racks. */
    const masterBankRef = useRef([]);
    const validWordsRef = useRef(new Set());
    const englishDictRef = useRef(null);
    const [dictReady, setDictReady] = useState(false);
    const [scorePulse, setScorePulse] = useState(false);
    const [floatPoints, setFloatPoints] = useState(null);
    const [invalidX, setInvalidX] = useState(false);
    const [chadSolvedWords, setChadSolvedWords] = useState([]);
    const [chadPoints, setChadPoints] = useState(0);
    const [tauntLevel, setTauntLevel] = useState(0);
    const [masterWord, setMasterWord] = useState("");
    const solvedWordsRef = useRef([]);
    const chadSolvedRef = useRef([]);
    const onGameCompleteRef = useRef(onGameComplete);
    const completeSentRef = useRef(false);
    const endSnapRef = useRef({});
    const skipNextPlayInitRef = useRef(false);
    const lastResumeKeyRef = useRef("");

    const guessString = useMemo(() => guess.map((t) => t.char).join("").toLowerCase(), [guess]);

    const poolTileBySlot = useMemo(() => {
        const m = new Map();
        for (const t of pool) {
            const s = t.poolSlot;
            if (typeof s === "number") m.set(s, t);
        }
        return m;
    }, [pool]);
    const wordCount = solvedWords.length;
    const chadWordCount = chadSolvedWords.length;

    useEffect(() => {
        onGameCompleteRef.current = onGameComplete;
    }, [onGameComplete]);

    useEffect(() => {
        solvedWordsRef.current = solvedWords;
    }, [solvedWords]);

    useEffect(() => {
        chadSolvedRef.current = chadSolvedWords;
    }, [chadSolvedWords]);

    useEffect(() => {
        let cancelled = false;
        import("../lib/anagramDictionary.js")
            .then(({ getAnagramDictionary, getSixLetterMasterBank }) => {
                if (cancelled) return;
                englishDictRef.current = getAnagramDictionary();
                masterBankRef.current = getSixLetterMasterBank();
                if (
                    typeof import.meta !== "undefined" &&
                    import.meta.env?.DEV &&
                    masterBankRef.current.length < 500
                ) {
                    console.warn(
                        `[anagram] six-letter master bank has only ${masterBankRef.current.length} words (expected 500+)`
                    );
                }
                setDictReady(true);
            })
            .catch(() => {
                if (cancelled) return;
                englishDictRef.current = new Set(
                    WORD_BANK.filter((x) => x.length >= MIN_WORD_LEN).map((x) => x.toLowerCase())
                );
                masterBankRef.current = WORD_BANK.filter((w) => w.length === 6).map((w) => w.toLowerCase());
                setDictReady(true);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!resumeSnapshot && lastResumeKeyRef.current) {
            lastResumeKeyRef.current = "";
        }
    }, [resumeSnapshot]);

    useEffect(() => {
        if (!resumeSnapshot || resumeSnapshot.v !== ANAGRAM_SNAPSHOT_V || !dictReady || !englishDictRef.current) {
            return;
        }
        const key = JSON.stringify(resumeSnapshot);
        if (key === lastResumeKeyRef.current) return;
        lastResumeKeyRef.current = key;

        skipNextPlayInitRef.current = true;
        const dict = englishDictRef.current;
        const master = String(resumeSnapshot.masterWord || "plates").toLowerCase();
        const sk = Number(resumeSnapshot.sessionKey) || 0;
        const tiles = tilesForWord(master, sk);
        bankTilesRef.current = tiles;
        validWordsRef.current = buildValidWordSet(letterCountsFromWord(master), dict);
        setMasterWord(master);
        setSessionKey(sk);
        setBankLetterCount(tiles.length);
        setPool(
            Array.isArray(resumeSnapshot.pool) && resumeSnapshot.pool.length
                ? resumeSnapshot.pool.map((t) => ({ ...t }))
                : withPoolSlots(shuffleArray(tiles))
        );
        setGuess(Array.isArray(resumeSnapshot.guess) ? resumeSnapshot.guess.map((t) => ({ ...t })) : []);
        setPoints(Number(resumeSnapshot.points) || 0);
        setSolvedWords(Array.isArray(resumeSnapshot.solvedWords) ? [...resumeSnapshot.solvedWords] : []);
        setChadSolvedWords(Array.isArray(resumeSnapshot.chadSolvedWords) ? [...resumeSnapshot.chadSolvedWords] : []);
        setChadPoints(Number(resumeSnapshot.chadPoints) || 0);
        setTauntLevel(Number(resumeSnapshot.tauntLevel) || 0);
        setTimeLeft(Math.max(0, Math.min(SESSION_SECONDS, Number(resumeSnapshot.timeLeft) || 0)));
        setFeedback("");
        setFeedbackTone("neutral");
        completeSentRef.current = false;
        sessionEndHandled.current = false;
        setPhase("play");
    }, [resumeSnapshot, dictReady]);

    useEffect(() => {
        if (phase !== "play" || !dictReady || !englishDictRef.current) return;
        if (skipNextPlayInitRef.current) {
            skipNextPlayInitRef.current = false;
            return;
        }
        const dict = englishDictRef.current;
        const bank = masterBankRef.current;
        const master = pickMasterWord(dict, bank.length ? bank : ["plates"]);
        const tiles = tilesForWord(master, sessionKey);
        bankTilesRef.current = tiles;
        validWordsRef.current = buildValidWordSet(letterCountsFromWord(master), dict);
        setMasterWord(master.toLowerCase());
        setBankLetterCount(tiles.length);
        setPool(withPoolSlots(shuffleArray(tiles)));
        setGuess([]);
        setFeedback("");
        setFeedbackTone("neutral");
        setTimeLeft(SESSION_SECONDS);
    }, [phase, sessionKey, dictReady]);

    useEffect(() => {
        sessionEndHandled.current = false;
    }, [sessionKey]);

    /** Chad plays the same valid-word set; slower + shorter words until you taunt. */
    useEffect(() => {
        if (phase !== "play" || !dictReady || bankLetterCount < 1) return undefined;
        if (!validWordsRef.current || validWordsRef.current.size === 0) return undefined;
        const aggro = tauntLevel > 0;

        function chadTick() {
            const used = new Set([
                ...solvedWordsRef.current.map((s) => s.toLowerCase()),
                ...chadSolvedRef.current.map((s) => s.toLowerCase()),
            ]);
            const all = [...validWordsRef.current].filter((w) => !used.has(w));
            if (!all.length) return;

            let pool = all;
            if (!aggro) {
                const easy = all.filter((w) => w.length <= 4);
                if (easy.length) pool = easy;
            } else {
                const hard = all.filter((w) => w.length >= 4);
                if (hard.length) pool = hard;
            }

            const word = pool[Math.floor(Math.random() * pool.length)];
            const pts = pointsForWordLength(word.length);
            setChadPoints((p) => p + pts);
            setChadSolvedWords((s) => [...s, word.toUpperCase()]);
        }

        const minMs = aggro ? 1200 : 3200;
        const maxMs = aggro ? 2400 : 5200;
        let timeoutId;
        function scheduleNext() {
            const wait = minMs + Math.random() * (maxMs - minMs);
            timeoutId = window.setTimeout(() => {
                chadTick();
                scheduleNext();
            }, wait);
        }
        timeoutId = window.setTimeout(() => {
            chadTick();
            scheduleNext();
        }, aggro ? 800 : 2200);
        return () => window.clearTimeout(timeoutId);
    }, [phase, sessionKey, dictReady, tauntLevel, bankLetterCount]);

    useEffect(() => {
        if (phase !== "play") return undefined;
        const id = window.setInterval(() => {
            setTimeLeft((t) => (t <= 1 ? 0 : t - 1));
        }, 1000);
        return () => window.clearInterval(id);
    }, [phase, sessionKey]);

    useEffect(() => {
        if (phase !== "play" || timeLeft > 0) return;
        if (sessionEndHandled.current) return;
        sessionEndHandled.current = true;
        setPhase("over");
        setFeedback("Time's up.");
        setFeedbackTone("neutral");
    }, [phase, timeLeft]);

    useEffect(() => {
        endSnapRef.current = {
            points,
            chadPoints,
            wordCount,
            chadWordCount,
            tauntLevel,
            solvedWords,
            chadSolvedWords,
        };
    });

    useEffect(() => {
        if (phase !== "over" || !onGameCompleteRef.current) return undefined;
        if (completeSentRef.current) return undefined;
        completeSentRef.current = true;
        const s = endSnapRef.current;
        const won = computeWinner(s.points, s.chadPoints, s.wordCount, s.chadWordCount);
        const chadLine = getChadEndgameLine({
            won,
            tauntCount: s.tauntLevel,
            youPts: s.points,
            chadPts: s.chadPoints,
            youWords: s.wordCount,
            chadWords: s.chadWordCount,
        });
        const payload = {
            won,
            youPoints: s.points,
            chadPoints: s.chadPoints,
            yourWords: [...(s.solvedWords || [])],
            chadWords: [...(s.chadSolvedWords || [])],
            tauntCount: s.tauntLevel,
            chadLine,
        };
        const t = window.setTimeout(() => {
            onGameCompleteRef.current?.(payload);
        }, 1600);
        return () => window.clearTimeout(t);
    }, [phase]);

    const startGame = () => {
        playUiSound("primary");
        completeSentRef.current = false;
        setSolvedWords([]);
        setPoints(0);
        setChadSolvedWords([]);
        setChadPoints(0);
        setTauntLevel(0);
        setSessionKey((k) => k + 1);
        setPhase("play");
    };

    const movePoolToGuess = (tile) => {
        if (phase !== "play") return;
        playUiSound("tile");
        if (bankLetterCount > 0 && guess.length >= bankLetterCount) return;
        setPool((p) => p.filter((t) => t.id !== tile.id));
        setGuess((g) => [...g, tile]);
        setFeedback("");
    };

    const moveGuessToPool = (tile) => {
        if (phase !== "play") return;
        playUiSound("tile");
        setGuess((g) => g.filter((t) => t.id !== tile.id));
        setPool((p) => [...p, tile]);
        setFeedback("");
    };

    const shufflePool = () => {
        if (phase !== "play") return;
        playUiSound("tap");
        setPool((p) => withPoolSlots(shuffleArray(p)));
    };

    const returnGuessToPool = () => {
        setPool((p) => withPoolSlots(shuffleArray([...p, ...guess])));
        setGuess([]);
    };

    const submitEnter = () => {
        if (phase !== "play") return;
        playUiSound("primary");
        const w = guessString;
        if (w.length < MIN_WORD_LEN) {
            setFeedback(`Use at least ${MIN_WORD_LEN} letters.`);
            setFeedbackTone("warn");
            return;
        }
        if (!validWordsRef.current.has(w)) {
            setInvalidX(true);
            setFeedback("✕ Not valid — letters back on the slate.");
            setFeedbackTone("bad");
            returnGuessToPool();
            window.setTimeout(() => setInvalidX(false), 550);
            window.setTimeout(() => {
                setFeedback("");
                setFeedbackTone("neutral");
            }, 1400);
            return;
        }
        if (solvedWords.some((s) => s.toLowerCase() === w)) {
            setInvalidX(true);
            setFeedback("✕ Already scored — try another word.");
            setFeedbackTone("warn");
            returnGuessToPool();
            window.setTimeout(() => setInvalidX(false), 550);
            window.setTimeout(() => {
                setFeedback("");
                setFeedbackTone("neutral");
            }, 1400);
            return;
        }
        const pts = pointsForWordLength(w.length);
        const floatId = Date.now();
        setPoints((x) => x + pts);
        setSolvedWords((s) => [...s, w.toUpperCase()]);
        setFloatPoints({ id: floatId, amount: pts });
        setScorePulse(true);
        window.setTimeout(() => setScorePulse(false), 700);
        window.setTimeout(() => setFloatPoints((fp) => (fp?.id === floatId ? null : fp)), 950);
        setFeedback(CHAD_QUIPS[Math.floor(Math.random() * CHAD_QUIPS.length)]);
        setFeedbackTone("ok");
        setPool(withPoolSlots(shuffleArray([...bankTilesRef.current])));
        setGuess([]);
        window.setTimeout(() => {
            setFeedback("");
            setFeedbackTone("neutral");
        }, 900);
    };

    const tauntChad = () => {
        if (phase !== "play") return;
        playUiSound("taunt");
        setTauntLevel((n) => n + 1);
        setFeedback(
            [
                "Chad: Cute. I'm done babysitting.",
                "Chad: Lil bro really wants smoke?",
                "Chad: Alright — I guess we're doing this.",
                "Chad: Volume up. Let's see those letters.",
            ][Math.floor(Math.random() * 4)]
        );
        setFeedbackTone("warn");
        window.setTimeout(() => {
            setFeedback("");
            setFeedbackTone("neutral");
        }, 2000);
    };

    const playAgain = () => {
        playUiSound("tap");
        completeSentRef.current = false;
        setPhase("intro");
    };

    const timerUrgent = phase === "play" && timeLeft <= 10;

    return (
        <div style={shell}>
            <div
                style={{
                    ...bgImageLayer,
                    backgroundImage: `url(${anagramBg})`,
                }}
                aria-hidden
            />
            <div style={bgReadabilityScrim} aria-hidden />

            <div style={{ ...contentPad, paddingBottom: `calc(${NAV_LIFT_PX}px + env(safe-area-inset-bottom, 0px))` }}>
                <button
                    type="button"
                    style={closeFab}
                    onClick={() => {
                        playUiSound("soft");
                        if (phase === "play" && typeof onPause === "function" && masterWord) {
                            onPause({
                                v: ANAGRAM_SNAPSHOT_V,
                                masterWord,
                                sessionKey,
                                timeLeft,
                                points,
                                solvedWords,
                                chadSolvedWords,
                                chadPoints,
                                tauntLevel,
                                pool,
                                guess,
                            });
                        }
                        onClose();
                    }}
                    aria-label="Close game"
                >
                    ✕
                </button>

                {phase === "intro" ? (
                    <div style={centerStack}>
                        <div style={sheetHandle} aria-hidden />
                        <div style={howToCard}>
                            <h2 style={howToTitle}>How to play:</h2>
                            <p style={howToBody}>
                                <strong>Six letters</strong> every round (random word from a large bank). Chad uses the same
                                rack — higher score wins in <strong>60 seconds</strong>. He starts chill; hit{" "}
                                <strong>Taunt Chad</strong> to make him hunt faster (risky). Spell{" "}
                                <strong>different real English words</strong> (3–6 letters). After each hit, tiles reset.
                                Tap letters, then <strong>Enter</strong>.
                            </p>
                            <div style={introTilesRow} aria-hidden>
                                {["R", "A", "N", "D", "O", "M"].map((ch, i) => (
                                    <div key={i} style={woodTileStatic}>
                                        {ch}
                                    </div>
                                ))}
                            </div>
                            <button type="button" style={{ ...startBtn, opacity: dictReady ? 1 : 0.6 }} onClick={startGame} disabled={!dictReady}>
                                {dictReady ? "Start" : "Loading word list…"}
                            </button>
                        </div>
                    </div>
                ) : null}

                {phase === "play" || phase === "over" ? (
                    <div style={gameStack}>
                        <div style={topHud}>
                            <button type="button" style={iconCircle} onClick={shufflePool} aria-label="Shuffle letters">
                                <span style={shuffleGlyph}>⇄</span>
                            </button>
                            <div style={{ flex: 1 }} />
                            {phase === "play" ? (
                                <button type="button" style={tauntBtn} onClick={tauntChad}>
                                    Taunt Chad
                                </button>
                            ) : (
                                <div style={{ width: 100 }} aria-hidden />
                            )}
                            <div style={{ flex: 1 }} />
                            <div style={{ ...timerPill, ...(timerUrgent ? timerPillUrgent : {}) }}>{formatTimeMmSs(phase === "over" ? 0 : timeLeft)}</div>
                        </div>

                        <div style={scorePaper}>
                            {floatPoints ? (
                                <div key={floatPoints.id} style={pointsFloater} className="anagram-points-float">
                                    +{floatPoints.amount.toLocaleString()}
                                </div>
                            ) : null}
                            <div style={scoreRows}>
                                <div style={scoreRowVs}>
                                    <img src={Sub5Image} alt="You" style={scoreAvatar} />
                                    <div style={scoreTextCol}>
                                        <div style={vsLabel}>You</div>
                                        <div style={scoreLine}>
                                            WORDS: <span style={scoreNum}>{wordCount}</span>
                                        </div>
                                        <div style={scoreLine}>
                                            SCORE:{" "}
                                            <span
                                                style={{ ...scoreNum, ...(scorePulse ? scoreNumPulse : {}) }}
                                                className={scorePulse ? "anagram-score-pulse" : ""}
                                            >
                                                {padScore(points)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div style={vsDivider} aria-hidden />
                                <div style={scoreRowVs}>
                                    <img src={ChadPhoto} alt="Chad" style={scoreAvatarChad} />
                                    <div style={scoreTextCol}>
                                        <div style={vsLabel}>Chad</div>
                                        <div style={scoreLine}>
                                            WORDS: <span style={scoreNum}>{chadWordCount}</span>
                                        </div>
                                        <div style={scoreLine}>
                                            SCORE: <span style={scoreNum}>{padScore(chadPoints)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div style={{ ...aggroHintSlot, minHeight: phase === "play" ? 26 : 0 }}>
                                {tauntLevel > 0 && phase === "play" ? (
                                    <div style={aggroHint}>
                                        {tauntLevel > 1 ? "Chad is tilted — good luck." : "Chad stopped going easy."}
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        <div style={feedbackSlot} aria-live="polite">
                            {feedback ? (
                                <div
                                    style={{
                                        ...feedbackBarText,
                                        ...(feedbackTone === "bad" ? feedbackBarBad : {}),
                                        ...(feedbackTone === "ok" ? feedbackBarOk : {}),
                                        ...(feedbackTone === "warn" ? feedbackBarWarn : {}),
                                    }}
                                >
                                    {feedback}
                                </div>
                            ) : null}
                        </div>

                        {phase === "play" ? (
                            <>
                                <button type="button" style={enterBtn} onClick={submitEnter}>
                                    ENTER
                                </button>

                                <p style={guessHint}>
                                    Your word {bankLetterCount ? `— up to ${bankLetterCount} letters (max 6)` : ""}
                                </p>
                                <div style={{ ...slotsWrap }}>
                                    {invalidX ? (
                                        <div style={rejectXBadge} className="anagram-reject-x" aria-hidden>
                                            ✕
                                        </div>
                                    ) : null}
                                    <div style={{ ...slotsRow, ...(feedbackTone === "bad" ? slotsShake : {}), ...(invalidX ? slotsRowReject : {}) }}>
                                        {guess.length === 0 ? (
                                            <span style={guessEmpty}>Tap letters below to spell a word</span>
                                        ) : (
                                            guess.map((t) => (
                                                <button key={t.id} type="button" style={slotFilled} onClick={() => moveGuessToPool(t)}>
                                                    {t.char}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>

                                <div
                                    style={{
                                        ...poolRow,
                                        gridTemplateColumns: `repeat(${bankLetterCount || 6}, minmax(0, 1fr))`,
                                    }}
                                >
                                    {Array.from({ length: bankLetterCount }, (_, slot) => {
                                        const t = poolTileBySlot.get(slot);
                                        return (
                                            <div key={`slot-${slot}`} style={poolSlotCell}>
                                                {t ? (
                                                    <button type="button" style={woodTile} onClick={() => movePoolToGuess(t)}>
                                                        {t.char}
                                                    </button>
                                                ) : (
                                                    <div style={poolSlotEmpty} aria-hidden />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        ) : null}

                        {phase === "over" ? (
                            <div style={overCard}>
                                <p style={overTitle}>Time&apos;s up</p>
                                <p style={overStats}>
                                    You {padScore(points)} ({wordCount} words) · Chad {padScore(chadPoints)} ({chadWordCount} words)
                                </p>
                                <p style={overWinner}>
                                    {computeWinner(points, chadPoints, wordCount, chadWordCount) ? "You took the dub." : "Chad clips it."}
                                </p>
                                <p style={overHint}>Result heads to chat…</p>
                                <div style={overActions}>
                                    <button type="button" style={secondaryBtn} onClick={playAgain}>
                                        Play again
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

const shell = {
    position: "fixed",
    inset: 0,
    zIndex: 500,
    overflow: "hidden",
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
    background: "#2a1f45",
};

const bgImageLayer = {
    position: "absolute",
    inset: 0,
    zIndex: 0,
    backgroundSize: "cover",
    backgroundPosition: "68% center",
    backgroundRepeat: "no-repeat",
};

const bgReadabilityScrim = {
    position: "absolute",
    inset: 0,
    zIndex: 1,
    pointerEvents: "none",
    background: "linear-gradient(180deg, rgba(20, 14, 35, 0.28) 0%, rgba(20, 14, 35, 0.42) 55%, rgba(20, 14, 35, 0.52) 100%)",
};

const contentPad = {
    position: "relative",
    zIndex: 2,
    minHeight: "100%",
    padding: "16px 18px 20px",
    boxSizing: "border-box",
};

const closeFab = {
    position: "absolute",
    top: 12,
    right: 14,
    zIndex: 5,
    width: 36,
    height: 36,
    borderRadius: "50%",
    border: "none",
    background: "rgba(255,255,255,0.22)",
    color: "#fff",
    fontSize: "1rem",
    cursor: "pointer",
    backdropFilter: "blur(8px)",
};

const centerStack = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    paddingTop: 32,
};

const sheetHandle = {
    width: 40,
    height: 5,
    borderRadius: 3,
    background: "rgba(255,255,255,0.35)",
    marginBottom: 20,
};

const howToCard = {
    width: "100%",
    maxWidth: 360,
    background: "#fff",
    borderRadius: 18,
    padding: "22px 20px 20px",
    boxShadow: "0 16px 48px rgba(0,0,0,0.35)",
};

const howToTitle = { margin: "0 0 12px", fontSize: "1.35rem", fontWeight: "900", color: "#1c1c1e" };

const howToBody = {
    margin: "0 0 18px",
    fontSize: "0.95rem",
    lineHeight: 1.45,
    color: "#3a3a3c",
};

const introTilesRow = {
    display: "flex",
    justifyContent: "center",
    gap: 8,
    marginBottom: 20,
    flexWrap: "wrap",
};

const woodTileStatic = {
    width: 44,
    height: 48,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "900",
    fontSize: "1.15rem",
    color: "#1a0f08",
    background: "linear-gradient(155deg, #efd9b8 0%, #c99d6b 42%, #8b623f 100%)",
    border: "2px solid #4a3020",
    boxShadow: "inset 0 1px 2px rgba(255,255,255,0.45), 0 4px 10px rgba(0,0,0,0.25)",
};

const startBtn = {
    width: "100%",
    border: "none",
    borderRadius: 14,
    padding: "14px",
    fontSize: "1rem",
    fontWeight: "800",
    cursor: "pointer",
    background: "linear-gradient(180deg, #c4b5fd 0%, #8b7ae8 100%)",
    color: "#1c1035",
    boxShadow: "0 6px 20px rgba(0,0,0,0.2)",
};

const secondaryBtn = {
    ...startBtn,
    background: "rgba(255,255,255,0.22)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.35)",
};

const gameStack = {
    display: "flex",
    flexDirection: "column",
    paddingTop: 44,
    maxWidth: 420,
    margin: "0 auto",
    width: "100%",
};

const topHud = {
    display: "flex",
    alignItems: "center",
    marginBottom: 16,
};

const iconCircle = {
    width: 44,
    height: 44,
    borderRadius: "50%",
    border: "none",
    background: "rgba(255,255,255,0.2)",
    color: "#fff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backdropFilter: "blur(8px)",
};

const shuffleGlyph = {
    fontSize: "1.25rem",
    fontWeight: "800",
};

const timerPill = {
    padding: "8px 16px",
    borderRadius: 999,
    background: "rgba(35, 22, 58, 0.92)",
    color: "#e8e4ff",
    fontWeight: "800",
    fontVariantNumeric: "tabular-nums",
    fontSize: "0.95rem",
    boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
};

const timerPillUrgent = {
    background: "linear-gradient(180deg, #4a1919 0%, #2a0d0d 100%)",
    color: "#ffb4b4",
};

const scorePaper = {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "14px 16px 18px",
    marginBottom: 14,
    background: "rgba(255,255,255,0.5)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: "1px solid rgba(255,255,255,0.45)",
    borderRadius: "14px 14px 4px 4px",
    boxShadow: "0 10px 28px rgba(0,0,0,22%)",
    clipPath:
        "polygon(0 0, 100% 0, 100% calc(100% - 10px), 97% 100%, 93% calc(100% - 6px), 88% 100%, 83% calc(100% - 5px), 78% 100%, 73% calc(100% - 7px), 68% 100%, 63% calc(100% - 5px), 58% 100%, 53% calc(100% - 8px), 48% 100%, 43% calc(100% - 5px), 38% 100%, 33% calc(100% - 7px), 28% 100%, 23% calc(100% - 5px), 18% 100%, 13% calc(100% - 8px), 8% 100%, 4% calc(100% - 5px), 0 100%)",
};

const scoreAvatar = {
    width: 52,
    height: 52,
    borderRadius: "50%",
    objectFit: "cover",
    border: "3px solid #6b5cb5",
    flexShrink: 0,
};

const scoreTextCol = { flex: 1, minWidth: 0 };

const scoreLine = {
    fontSize: "0.95rem",
    fontWeight: "800",
    color: "#1c1c1e",
    letterSpacing: "0.02em",
};

const scoreNum = { fontVariantNumeric: "tabular-nums" };

const scoreNumPulse = {
    color: "#0d6e3a",
    textShadow: "0 0 12px rgba(180, 255, 200, 0.9)",
};

const pointsFloater = {
    position: "absolute",
    right: 12,
    top: 4,
    fontSize: "1.35rem",
    fontWeight: "900",
    color: "#ffd60a",
    textShadow: "0 2px 8px rgba(0,0,0,0.45), 0 0 20px rgba(255, 214, 10, 0.65)",
    pointerEvents: "none",
    zIndex: 5,
};

const tauntBtn = {
    border: "none",
    borderRadius: 999,
    padding: "8px 14px",
    fontSize: "0.7rem",
    fontWeight: "800",
    background: "linear-gradient(180deg, #ff6b3d 0%, #c93818 100%)",
    color: "#fff",
    cursor: "pointer",
    flexShrink: 0,
    boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
};

const scoreRows = {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    width: "100%",
};

const scoreRowVs = {
    display: "flex",
    alignItems: "center",
    gap: 12,
};

const vsDivider = {
    height: 1,
    background: "rgba(0,0,0,0.1)",
    width: "100%",
};

const vsLabel = {
    fontSize: "0.68rem",
    fontWeight: "800",
    color: "#636366",
    letterSpacing: "0.06em",
    marginBottom: 2,
};

const scoreAvatarChad = {
    width: 52,
    height: 52,
    borderRadius: "50%",
    objectFit: "cover",
    border: "3px solid #2d8f5a",
    flexShrink: 0,
};

const aggroHintSlot = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    boxSizing: "border-box",
};

const aggroHint = {
    fontSize: "0.72rem",
    fontWeight: "700",
    color: "#8b2c2c",
    textAlign: "center",
    margin: 0,
};

/** Fixed-height band so Chad lines don’t push the letter rack up/down when they flash. */
const feedbackSlot = {
    minHeight: 50,
    marginBottom: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 12,
    paddingRight: 12,
    boxSizing: "border-box",
};

const feedbackBarText = {
    textAlign: "center",
    fontSize: "0.88rem",
    fontWeight: "650",
    color: "#f0ebff",
    lineHeight: 1.35,
    margin: 0,
};

const feedbackBarBad = { color: "#ffc9c9" };

const feedbackBarOk = { color: "#b9f5c9" };

const feedbackBarWarn = { color: "#ffe5a8" };

const guessHint = {
    margin: "0 0 6px",
    fontSize: "0.78rem",
    fontWeight: "700",
    color: "rgba(240,235,255,0.85)",
    textAlign: "center",
};

const guessEmpty = {
    fontSize: "0.88rem",
    color: "rgba(255,255,255,0.55)",
    fontWeight: "600",
};

const enterBtn = {
    width: "100%",
    border: "none",
    borderRadius: 14,
    padding: "16px",
    marginBottom: 14,
    fontSize: "1.05rem",
    fontWeight: "900",
    letterSpacing: "0.12em",
    color: "#2d1f4d",
    cursor: "pointer",
    background: "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(210, 200, 245, 0.95) 100%)",
    boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
};

const slotsWrap = {
    position: "relative",
    marginBottom: 22,
};

const slotsRow = {
    display: "flex",
    justifyContent: "center",
    gap: 8,
    flexWrap: "wrap",
    minHeight: 52,
};

const slotsRowReject = {
    opacity: 0.85,
};

const rejectXBadge = {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    width: 64,
    height: 64,
    borderRadius: "50%",
    background: "rgba(180, 30, 40, 0.92)",
    color: "#fff",
    fontSize: "2.25rem",
    fontWeight: "200",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
    boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
    zIndex: 4,
    pointerEvents: "none",
};

const slotFilled = {
    width: 46,
    height: 52,
    borderRadius: 10,
    border: "2px solid #c4b5fd",
    background: "linear-gradient(180deg, #ede9fe 0%, #c4b5fd 100%)",
    fontSize: "1.2rem",
    fontWeight: "900",
    color: "#1c1035",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
};

const poolRow = {
    display: "grid",
    justifyContent: "center",
    gap: 10,
    paddingBottom: 8,
    maxWidth: 400,
    margin: "0 auto",
    width: "100%",
    boxSizing: "border-box",
};

const poolSlotCell = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
};

const poolSlotEmpty = {
    width: 48,
    height: 54,
    borderRadius: 10,
    border: "2px solid transparent",
    boxSizing: "border-box",
    flexShrink: 0,
};

const woodTile = {
    width: 48,
    height: 54,
    borderRadius: 10,
    border: "2px solid #4a3020",
    fontSize: "1.2rem",
    fontWeight: "900",
    color: "#1a0f08",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(155deg, #efd9b8 0%, #c99d6b 42%, #8b623f 100%)",
    boxShadow: "inset 0 1px 2px rgba(255,255,255,0.45), 0 5px 12px rgba(0,0,0,0.3)",
};

const overCard = {
    marginTop: 12,
    padding: "20px",
    borderRadius: 16,
    background: "rgba(255,255,255,0.95)",
    textAlign: "center",
    boxShadow: "0 12px 36px rgba(0,0,0,0.3)",
};

const overTitle = { margin: "0 0 8px", fontSize: "1.25rem", fontWeight: "900" };

const overStats = { margin: "0 0 8px", fontSize: "0.95rem", fontWeight: "700", color: "#444" };

const overWinner = { margin: "0 0 6px", fontSize: "1rem", fontWeight: "800", color: "#1c1c1e" };

const overHint = { margin: "0 0 14px", fontSize: "0.8rem", fontWeight: "600", color: "#666" };

const overActions = { display: "flex", flexDirection: "column", gap: 10 };

const slotsShake = {
    animation: "anagramShake 0.35s ease",
};

const injectShake = `
@keyframes anagramShake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-6px); }
  75% { transform: translateX(6px); }
}
@keyframes anagramPointsFloat {
  0% { opacity: 0; transform: translateY(8px) scale(0.75); }
  12% { opacity: 1; transform: translateY(0) scale(1.12); }
  35% { opacity: 1; transform: translateY(-6px) scale(1); }
  100% { opacity: 0; transform: translateY(-40px) scale(0.96); }
}
.anagram-points-float {
  animation: anagramPointsFloat 0.95s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
@keyframes anagramScorePulse {
  0% { transform: scale(1); }
  35% { transform: scale(1.18); }
  100% { transform: scale(1); }
}
.anagram-score-pulse {
  animation: anagramScorePulse 0.65s ease-out;
  display: inline-block;
}
@keyframes anagramRejectX {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
  45% { opacity: 1; transform: translate(-50%, -50%) scale(1.06); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
}
.anagram-reject-x {
  animation: anagramRejectX 0.52s ease-out forwards;
}
`;

if (typeof document !== "undefined" && !document.getElementById("anagram-game-styles")) {
    const s = document.createElement("style");
    s.id = "anagram-game-styles";
    s.textContent = injectShake;
    document.head.appendChild(s);
}
