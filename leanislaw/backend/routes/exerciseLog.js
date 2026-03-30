import express from 'express';
import { db } from '../db.js';
// Make sure these match exactly what is in your schema.js
import { exerciseLog, exercises } from '../schema.js'; 
import { eq } from 'drizzle-orm';

const router = express.Router();

// 1. GET Logs: Use camelCase key
router.get('/', async (req, res) => {
  try {
    const { workout_sessions_id } = req.query; // This is the URL param

    const logs = await db.select({
      id: exerciseLog.id,
      exercise_id: exerciseLog.exercise_id,
      sets: exerciseLog.sets,
      name: exercises.name,
    })
    .from(exerciseLog)
    .leftJoin(exercises, eq(exerciseLog.exercise_id, exercises.id))
    // FIX: Match the schema key 'workoutSessionsId'
    .where(eq(exerciseLog.workoutSessionsId, Number(workout_sessions_id))); 

    res.json(logs.map(log => ({
      ...log,
      sets: Array.isArray(log.sets) ? log.sets : []
    })));
  } catch (err) {
    console.error("SQL Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Get a single log by its own ID
router.get('/:id', async (req, res) => {
    try {
        const exerciseLogId = Number(req.params.id);
        const selectedExerciseLog = await db.select()
            .from(exerciseLog)
            .where(eq(exerciseLog.id, exerciseLogId));

        if (selectedExerciseLog.length === 0) {
            return res.status(404).send({ error: "Not found" });
        }
        res.json(selectedExerciseLog[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. POST Log: Use camelCase key
router.post('/', async (req, res) => {
    try {
        const { workout_sessions_id, exercise_id } = req.body;

        const [newLog] = await db.insert(exerciseLog).values({
            // FIX: Match the schema key 'workoutSessionsId'
            workoutSessionsId: Number(workout_sessions_id),
            exercise_id: Number(exercise_id),
            sets: [] 
        }).returning();

        res.status(201).json(newLog);
    } catch (err) {
        console.error("Insert Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// 4. Update specific log (The "Save Set" route)
router.put('/:id', async (req, res) => {
    try {
        const logId = Number(req.params.id);
        const { sets } = req.body; // We only care about the sets array now

        const updatedLog = await db.update(exerciseLog)
            .set({ 
                // CRITICAL: sets is now a JSONB array, do NOT use Number()
                sets: sets || [] 
            })
            .where(eq(exerciseLog.id, logId))
            .returning();

        res.json(updatedLog[0]);
    } catch (err) {
        console.error("PUT Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// 5. Delete an exercise log
router.delete('/:id', async (req, res) => {
    try {
        const logId = Number(req.params.id);
        const deletedLog = await db.delete(exerciseLog)
            .where(eq(exerciseLog.id, logId))
            .returning();

        res.json({ message: "Deleted", log: deletedLog[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;