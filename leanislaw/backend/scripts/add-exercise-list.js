import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import pool, { db } from "../db.js";
import { exercises } from "../schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

function norm(s) {
    return String(s || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}

const TARGET = [
    // Biceps
    { name: "Bicep Curls", body_part: "biceps" },
    { name: "Hammer Curls", body_part: "biceps" },
    { name: "Concentration Curls", body_part: "biceps" },
    { name: "Preacher Curls", body_part: "biceps" },
    { name: "Cable Curls", body_part: "biceps" },
    { name: "Chin-Ups", body_part: "biceps" },
    { name: "Resistance Band Curls", body_part: "biceps" },

    // Triceps
    { name: "Tricep Dips", body_part: "triceps" },
    { name: "Tricep Pushdowns", body_part: "triceps" },
    { name: "Skull Crushers", body_part: "triceps" },
    { name: "Overhead Tricep Extensions", body_part: "triceps" },
    { name: "Close-Grip Bench Press", body_part: "triceps" },
    { name: "Diamond Push-Ups", body_part: "triceps" },

    // Chest
    { name: "Push-Ups", body_part: "chest" },
    { name: "Bench Press", body_part: "chest" },
    { name: "Incline Bench Press", body_part: "chest" },
    { name: "Decline Bench Press", body_part: "chest" },
    { name: "Chest Fly", body_part: "chest" },
    { name: "Cable Crossover", body_part: "chest" },

    // Back
    { name: "Pull-Ups", body_part: "back" },
    { name: "Lat Pulldown", body_part: "back" },
    { name: "Deadlift", body_part: "back" },
    { name: "Bent-Over Row", body_part: "back" },
    { name: "Seated Row", body_part: "back" },
    { name: "T-Bar Row", body_part: "back" },
    { name: "Face Pulls", body_part: "back" },

    // Legs
    { name: "Squats", body_part: "legs" },
    { name: "Lunges", body_part: "legs" },
    { name: "Leg Press", body_part: "legs" },
    { name: "Step-Ups", body_part: "legs" },
    { name: "Bulgarian Split Squats", body_part: "legs" },
    { name: "Deadlifts", body_part: "legs" },
    { name: "Calf Raises", body_part: "legs" },

    // Abs
    { name: "Plank", body_part: "abs" },
    { name: "Crunches", body_part: "abs" },
    { name: "Sit-Ups", body_part: "abs" },
    { name: "Leg Raises", body_part: "abs" },
    { name: "Hanging Leg Raises", body_part: "abs" },
    { name: "Russian Twists", body_part: "abs" },
    { name: "Bicycle Crunches", body_part: "abs" },
    { name: "Mountain Climbers", body_part: "abs" },

    // Shoulders
    { name: "Shoulder Press", body_part: "shoulders" },
    { name: "Arnold Press", body_part: "shoulders" },
    { name: "Lateral Raises", body_part: "shoulders" },
    { name: "Front Raises", body_part: "shoulders" },
    { name: "Rear Delt Fly", body_part: "shoulders" },
    { name: "Shrugs", body_part: "shoulders" },
];

async function main() {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL missing");
    }

    const existing = await db.select().from(exercises);
    const existingNorm = new Set(existing.map((e) => norm(e.name)));

    let inserted = 0;
    let skipped = 0;

    for (const ex of TARGET) {
        const key = norm(ex.name);
        if (!key || existingNorm.has(key)) {
            skipped += 1;
            continue;
        }
        await db.insert(exercises).values(ex);
        existingNorm.add(key);
        inserted += 1;
    }

    console.log(`Exercise import complete. Inserted: ${inserted}, skipped(existing): ${skipped}`);
}

main()
    .catch((err) => {
        console.error(err);
        process.exit(1);
    })
    .finally(async () => {
        await pool.end();
    });
