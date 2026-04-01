/**
 * Hard constraints for RFL/PSMF-style answers so Chad matches the handbook structure
 * (protein from LBM, no cardio) instead of generic % deficit + HIIT fluff.
 */
export function rflBookFaithfulContext() {
    return (
        `RFL / rapid fat loss — **book-faithful constraints** (these override generic cutting advice and generic “% below maintenance” framing):\n` +
        `1) **No cardio:** Do **not** tell them to add HIIT, steady-state, “cardio 2–3×/week”, or extra conditioning for RFL unless a retrieved excerpt explicitly says otherwise. Standard framing is **no cardio** on this diet.\n` +
        `2) **Protein from lean body mass (lb), not “pick a % deficit from TDEE”:** Daily protein is driven by **grams per pound of LBM**, using body-fat brackets (then match wording to retrieved [rapid_fat_loss] snippets):\n` +
        `   - Body fat **~15% or lower:** about **1.5 g protein per lb LBM**.\n` +
        `   - Body fat **above 15% and below 25%:** about **1.25 g protein per lb LBM**.\n` +
        `   - Body fat **25% or higher:** about **1.0 g protein per lb LBM**.\n` +
        `   Compute: (LBM lb) × (multiplier) ≈ protein g/day. If user stats include a precomputed “RFL protein hint”, treat it as the app’s math — still reconcile with excerpts.\n` +
        `3) **Food pattern:** lean protein, **fibrous vegetables**, near-zero-cal drinks/sweeteners as the book allows — not random meal templates that ignore that structure.\n` +
        `4) **TDEE / maintenance:** Useful as context; **do not** redefine RFL mainly as “eat 20%, 30%, or 40% below maintenance.” The spine of the setup is **LBM → protein**, then fat/calories per the source, not a made-up percentage band.\n` +
        `5) If **LBM or body fat %** is missing, say you need weight + BF% (or known LBM) before locking protein grams — don’t guess.\n` +
        `6) **Opening a plan:** Don’t pitch RFL as “**Calories:** X–Y kcal” as the **first** hook or sell a random **% below maintenance** band. **But** if they **explicitly** ask where macros land, total kcal, calorie breakdown, “what are my macros,” etc., **answer in one go** — **without inventing a daily fat target.** There is **no separate “eat X g fat” requirement** on PSMF/RFL: fat is **trace** (unavoidable from lean protein, tiny amounts, fish oil supps are separate). **Carbs** are **barely any** — incidental from fibrous veg, **not** a starch macro to hit. Sensible tally: **protein g → kcal (4 cal/g)** as the anchor; then **ballpark total** as roughly protein kcal **plus a small incidental remainder** (word it as trace fat + veg carbs combined, **no** “aim for 30 g fat” lines). Ground in **RFL protein hint** + excerpts, not a balanced macro grid.\n` +
        `7) **Do not** default to **~150 g protein** (or other round numbers) unless it drops out of **LBM × g/lb** or the precomputed **RFL protein hint** in stats — otherwise you’re guessing.\n` +
        `8) **Meals:** don’t push **bread, toast, grains, rice, pasta, oats** as base meals — standard PSMF-style structure is **lean protein + fibrous veg** (refeeds are their own topic per excerpts).\n` +
        `9) **“Total macros” / macro breakdown:** **Protein** = LBM-based g/day (hint or formula). **Do not** assign a **fat gram goal** (no “30 g / 50 g fat” targets — that implies a designed fat macro; RFL doesn’t work that way). Fat = **trace / unavoidable only** from food + **EPA/DHA from fish oil** as supplement (not “hit 30 g dietary fat”). **Carbs** = **near-zero intentional carbs**; fibrous veg yields **small incidental carb + fiber**, not “50 g carbs from vegetables” as a macro to plan around. If they want a calorie total, center **protein kcal** and describe the rest as **tiny incidentals**, not a 3-macro MyFitnessPal split.\n` +
        `10) **Supplements — core RFL, not optional fluff:** Treat the stack as **part of the real protocol**, same importance as protein setup. Always cover these three when discussing **RFL setup, plans, or what to take** (match doses to retrieved [rapid_fat_loss] text when it disagrees, but **don’t skip the category**):\n` +
        `   - **Fish oil:** target **~2.5 g/day combined EPA + DHA** from the product label (sum EPA + DHA mg → g; not “fish oil capsules” without checking **actual EPA+DHA**).\n` +
        `   - **Multivitamin:** per book / excerpt (daily coverage on this low food variety).\n` +
        `   - **Electrolytes:** sodium / potassium / magnesium guidance as the book gives — **especially** important here; don’t hand-wave.\n` +
        `11) **Full RFL plan answers** (first-time or “give me a plan”): include **all five pillars** in one shot where space allows — protein/LBM, food pattern, **supplements (EPA+DHA, multi, electrolytes)**, training (no cardio), tracking — not a meal list that forgets supps.\n` +
        `12) **Voice:** Don’t repeat the **same numbered meal-plan + “no cardio”** checklist on every follow-up. If they already have the plan and are asking **macros / kcal / where it falls**, talk like a real coach: **short paragraph**, numbers first, one caveat if needed — not a robotic re-broadcast of rules.`
    );
}

/** Heuristic: model slipped into generic deficit / meal-template advice vs LBM-first RFL. */
export function rflReplyLooksGenericDeficit(text) {
    const t = String(text || '');
    const calorieSectionFirst =
        /^\s*(?:\d+\.\s*)?calories?\s*:/im.test(t) ||
        /\b1\.\s*calories?\b/i.test(t) ||
        /\bstick\s+to\s+~?1[,.]?\d{3}/i.test(t);
    const fakeCalBand =
        /\b1[,.]?\d{3}\s*[-–—]\s*1[,.]?\d{3}\b/.test(t) &&
        /\b(daily|per day|kcal|cal|calorie|deficit)\b/i.test(t);
    const generic150Prot = /\b150\s*g(?:rams)?\b/i.test(t) && /\bprotein\b/i.test(t);
    const carbyMealSlip = /\b(whole grain|toast|bread|pasta|brown rice|\brice\b|oatmeal|wraps?)\b/i.test(t);
    const pctDeficitPitch =
        /\b(20|25|30|35|40|50)\s*%/i.test(t) && /\b(deficit|below maintenance|off maintenance)\b/i.test(t);
    const fillRestCarbs = /\bfill\s+(?:the\s+)?rest\b/i.test(t) && /\bcarb/i.test(t);
    const genericMacroGridCarbs =
        /\bcarbs?\b/i.test(t) &&
        /\b(protein|fat)\b/i.test(t) &&
        /\b(70|75|80|100|120|150)\s*g\b/i.test(t);
    const rflishCalWithStarchCarbs =
        /\b1[,.]?\s*8\d{2}\s*[-–—]\s*2[,.]?\s*0{3}\b/i.test(t) ||
        /\b(1800|1900|2000)\s*[-–—]\s*(1800|1900|2000)\b/i.test(t);
    const prescribedFatMacroTarget =
        /\bfat\b/i.test(t) &&
        /\b(15|20|25|30|35|40|45|50)\s*g\b/i.test(t) &&
        (/\b(aim|target|about|around|roughly|approx\.?|~)\b/i.test(t) ||
            /\d+\s*g\s*=\s*\d+/i.test(t));
    const inflatedVegCarbLine =
        /\bcarb/i.test(t) &&
        /\b(30|40|50|60|70)\s*g\b/i.test(t) &&
        /\b(veg|vegetable|fibrous|broccoli|greens|salad)\b/i.test(t);
    return (
        calorieSectionFirst ||
        fakeCalBand ||
        generic150Prot ||
        carbyMealSlip ||
        pctDeficitPitch ||
        fillRestCarbs ||
        genericMacroGridCarbs ||
        rflishCalWithStarchCarbs ||
        prescribedFatMacroTarget ||
        inflatedVegCarbLine
    );
}

/** g protein per lb LBM from BF% per app owner’s RFL framing. */
export function rflProteinGPerLbLbm(bfPct) {
    const bf = Number(bfPct);
    if (!Number.isFinite(bf) || bf < 0 || bf > 60) return null;
    if (bf <= 15) return 1.5;
    if (bf < 25) return 1.25;
    return 1.0;
}
