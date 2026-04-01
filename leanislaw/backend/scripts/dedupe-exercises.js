import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { and, eq } from "drizzle-orm";
import pool, { db } from "../db.js";
import { exerciseLog, exercises } from "../schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

function norm(s) {
    return String(s || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}

function asSetArray(raw) {
    return Array.isArray(raw) ? raw : [];
}

async function dedupeExercisesTable() {
    const rows = await db.select().from(exercises);
    const groups = new Map();
    for (const row of rows) {
        const key = norm(row.name);
        if (!key) continue;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
    }

    let mergedExerciseRows = 0;
    let deletedExerciseRows = 0;

    for (const list of groups.values()) {
        if (list.length < 2) continue;
        const sorted = [...list].sort((a, b) => Number(a.id) - Number(b.id));
        const keep = sorted[0];
        const dups = sorted.slice(1);
        mergedExerciseRows += dups.length;

        for (const dup of dups) {
            await db
                .update(exerciseLog)
                .set({ exercise_id: keep.id })
                .where(eq(exerciseLog.exercise_id, dup.id));
            await db.delete(exercises).where(eq(exercises.id, dup.id));
            deletedExerciseRows += 1;
        }
    }

    return { mergedExerciseRows, deletedExerciseRows };
}

async function dedupeExerciseLogsBySession() {
    const logs = await db.select().from(exerciseLog);
    const bySessionExercise = new Map();

    for (const row of logs) {
        const sid = Number(row.workoutSessionsId);
        const eid = Number(row.exercise_id);
        if (!Number.isFinite(sid) || !Number.isFinite(eid)) continue;
        const key = `${sid}:${eid}`;
        if (!bySessionExercise.has(key)) bySessionExercise.set(key, []);
        bySessionExercise.get(key).push(row);
    }

    let mergedLogRows = 0;
    let deletedLogRows = 0;

    for (const list of bySessionExercise.values()) {
        if (list.length < 2) continue;
        const sorted = [...list].sort((a, b) => Number(a.id) - Number(b.id));
        const keep = sorted[0];
        const dups = sorted.slice(1);

        const mergedSets = [
            ...asSetArray(keep.sets),
            ...dups.flatMap((d) => asSetArray(d.sets)),
        ];

        await db
            .update(exerciseLog)
            .set({ sets: mergedSets })
            .where(eq(exerciseLog.id, keep.id));

        for (const dup of dups) {
            await db.delete(exerciseLog).where(eq(exerciseLog.id, dup.id));
            deletedLogRows += 1;
        }
        mergedLogRows += dups.length;
    }

    return { mergedLogRows, deletedLogRows };
}

async function main() {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL missing");
    }

    const ex = await dedupeExercisesTable();
    const logs = await dedupeExerciseLogsBySession();

    console.log(
        `Deduped exercises: merged ${ex.mergedExerciseRows}, deleted ${ex.deletedExerciseRows}`
    );
    console.log(
        `Deduped logs: merged ${logs.mergedLogRows}, deleted ${logs.deletedLogRows}`
    );
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await pool.end();
    });
