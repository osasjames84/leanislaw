/**
 * Seeds ~35 days of coherent intake, steps, weight, and food_log rows for dashboard charts + EMA TDEE.
 *
 * Run from repo: `node backend/scripts/seed-dashboard-demo.js`
 * Requires `backend/.env` with DATABASE_URL.
 *
 * Env:
 *   SEED_USER_ID — default 1
 *   SEED_DAYS — default 35
 *
 * Clears overlapping rows for that user from start date → today (daily_logs, body_metrics, food_log_entries only).
 */

import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import pool, { db } from "../db.js";
import { bodyMetrics, daily_logs, foodCatalog, foodLogEntries } from "../schema.js";
import { and, eq, gte } from "drizzle-orm";
import { macrosForGrams } from "../lib/macroEngine.js";
import { recomputeUserEmaTdee } from "../routes/tdee.js";

const userId = Math.max(1, Number(process.env.SEED_USER_ID) || 1);
const numDays = Math.min(60, Math.max(14, Number(process.env.SEED_DAYS) || 35));

function isoDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function gramsTripletForTargetKcal(T, chicken, rice, egg) {
    let gCh = Math.round((0.38 * T) / (Number(chicken.kcal_per_100g) / 100));
    let gR = Math.round((0.42 * T) / (Number(rice.kcal_per_100g) / 100));
    let gE = Math.round((0.2 * T) / (Number(egg.kcal_per_100g) / 100));
    gCh = Math.max(40, gCh);
    gR = Math.max(40, gR);
    gE = Math.max(30, gE);
    for (let k = 0; k < 12; k++) {
        const k1 = macrosForGrams(chicken, gCh).kcal;
        const k2 = macrosForGrams(rice, gR).kcal;
        const k3 = macrosForGrams(egg, gE).kcal;
        const sum = k1 + k2 + k3;
        if (Math.abs(sum - T) <= 15) break;
        const d = T - sum;
        gR += Math.sign(d) * 15;
        gR = Math.max(40, gR);
    }
    return [
        { food: chicken, grams: gCh },
        { food: rice, grams: gR },
        { food: egg, grams: gE },
    ];
}

async function main() {
    if (!process.env.DATABASE_URL) {
        console.error("DATABASE_URL missing");
        process.exit(1);
    }

    const end = new Date();
    end.setHours(12, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - (numDays - 1));
    const startStr = isoDate(start);

    const [chickenRow] = await db
        .select()
        .from(foodCatalog)
        .where(eq(foodCatalog.name, "Chicken breast (cooked)"))
        .limit(1);
    const [riceRow] = await db
        .select()
        .from(foodCatalog)
        .where(eq(foodCatalog.name, "White rice (cooked)"))
        .limit(1);
    const [eggRow] = await db
        .select()
        .from(foodCatalog)
        .where(eq(foodCatalog.name, "Egg (whole, raw)"))
        .limit(1);

    if (!chickenRow || !riceRow || !eggRow) {
        console.error("Need chicken, rice, and egg rows in food_catalog (see migration 004_macros).");
        process.exit(1);
    }

    console.log(`Clearing demo data for user ${userId} from ${startStr} onward…`);

    await db
        .delete(foodLogEntries)
        .where(and(eq(foodLogEntries.user_id, userId), gte(foodLogEntries.date, startStr)));

    await db
        .delete(daily_logs)
        .where(and(eq(daily_logs.userId, userId), gte(daily_logs.date, startStr)));

    await db
        .delete(bodyMetrics)
        .where(and(eq(bodyMetrics.user_id, userId), gte(bodyMetrics.date, startStr)));

    const bfPct = 15;
    // ~1.35 kg loss over window with smooth intake — implied TDEE tracks ~2600–2750 kcal range after EMA + slope.
    const wStart = 82.85;
    const wEnd = 81.5;

    for (let i = 0; i < numDays; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const dateStr = isoDate(d);
        const t = i / Math.max(1, numDays - 1);
        const weightKg = Math.round((wStart + (wEnd - wStart) * t) * 100) / 100;
        const calories = Math.round(
            2365 + 72 * Math.sin(i / 4.1) + (i % 6) * 14 + Math.round(25 * Math.sin(i * 1.3))
        );
        const steps = Math.round(16800 + 10200 * (0.5 + 0.5 * Math.sin(i * 0.38 + 0.7)));
        const clampSteps = Math.min(27000, Math.max(16000, steps));

        await db.insert(bodyMetrics).values({
            user_id: userId,
            date: dateStr,
            weight_kg: String(weightKg),
            body_fat_pct: String(bfPct),
        });

        await db.insert(daily_logs).values({
            userId: userId,
            date: dateStr,
            calories,
            steps: clampSteps,
        });

        const parts = gramsTripletForTargetKcal(calories, chickenRow, riceRow, eggRow);
        for (const { food, grams } of parts) {
            await db.insert(foodLogEntries).values({
                user_id: userId,
                date: dateStr,
                food_catalog_id: food.id,
                grams: String(grams),
                meal_slot: "uncategorized",
            });
        }
    }

    console.log("Recomputing EMA TDEE…");
    await recomputeUserEmaTdee(userId);

    console.log(`Seeded ${numDays} days for user ${userId}.`);
    console.log(
        "Charts use JWT user id: run with SEED_USER_ID matching GET /api/v1/auth/me (same account you log into)."
    );
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => pool.end());
