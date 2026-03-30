import express from 'express';
import { db } from '../db.js';
import { workoutSessions, exerciseLog, exercises } from '../schema.js';
import { eq, desc, lt, gte, gt, ne, is } from 'drizzle-orm';

const router = express.Router();

router.get('/test', (req, res) => {
    res.send("If you see this, the route is mounted correctly!");
});

// Get all workout sessions (Handles filtering for Templates vs History)
router.get('/', async (req, res) => {
    try {
        const { is_template } = req.query;
        
        let conditions;
        if (is_template !== undefined) {
            conditions = eq(workoutSessions.is_template, is_template === 'true');
        }

        const sessions = await db.select()
            .from(workoutSessions)
            .where(conditions)
            .orderBy(desc(workoutSessions.date)); // Sorts newest first

        res.json(sessions);
    } catch (err) {
        console.error("Backend Crash:", err);
        res.status(500).json({ error: err.message });
    }
});

//Get workout session by id
router.get('/:id', async (req, res) => {
    try{
        //This is the inputed workout session id
        const workoutSessionsId = Number(req.params.id);
        //Checking the db for workout session that matches with the inputed id
        const selectedWorkoutSession = await db.select()
        .from(workoutSessions)
        .where(eq(workoutSessions.id, workoutSessionsId))

    //If no workoutsessionid return not found, .length because the db returns results from a get query in an array
    if(selectedWorkoutSession.length === 0){
        return res.status(404).send({error: "Not found"})
    }
    //return in json the workout session([0] because if any item is found it is returned in array hence [0] to get the first and only item in that array)
    res.json(selectedWorkoutSession[0]);
    } 
    //if error return this error message
    catch (err) {
        console.error(err);
        res.status(500).json({error: err.message});
    }
})

//Create a new workout session
router.post('/', async (req, res) => {
    try{
         console.log('req.body:', req.body);
         const {name, is_template, user_id, notes, date} = req.body;
        //  const {name} = req.body;

        if(!name || !user_id) {
            return res.status(400).send({message: "Missing fields"});
        }
         //This inserts the name of the workout session into the db,
         const [newWorkoutSession] = await db.insert(workoutSessions)
         .values({
            name,
            is_template: is_template || false,
            user_id,
            notes: notes || "",
            date: date || new Date(),    
            }).returning();

            if(!newWorkoutSession){
            return res.status(404).json({message: 'Failed to add'});
        }

            res.status(201).json(newWorkoutSession);
      

    } catch(err){
        console.error('Session not created: ', err);
        res.status(500).json({error: err.message});
    }
})

//Edit an existing workout session
router.patch('/:id', async (req, res) => {
    const workoutSessionsId = Number(req.params.id);
    const{name, is_template, user_id, notes} = req.body;

    try{
        const[updatedSession] = await db.update(workoutSessions)
        .set({name, is_template, user_id, notes})
        .where(eq(workoutSessions.id, workoutSessionsId))
        .returning()

        if(!updatedSession) {
            return res.status(404).send({message: 'Not found'})
        }

        res.status(201).json({
            message: `Workout session ${updatedSession.name} has been updated`
        })

    } catch(err){
        console.error(err);
        res.status(500).json({error: err.message});
    }
})

//Delete a workout session
router.delete('/:id', async(req, res) => {
    try {
        const {id} = req.params;
        const workoutSessionsId = Number(id);
        const [deletedSession] = await db.delete(workoutSessions)
        .where(eq(workoutSessions.id, workoutSessionsId))
        .returning()

        if(!deletedSession){
            return res.status(404).json({message: 'Session not found'});
        }

        res.status(200).json({
            message: `Session ${deletedSession.name} has been deleted`,
            workoutSessions: deletedSession
        })

    } catch(err){
        console.error(err);
        res.status(500).json({error: err.message})
    }
});

// POST a new exercise log to a specific workout session
router.post('/:id/exerciseLogs', async (req, res) => {
    try {
        const sessionId = Number(req.params.id);
        const { exercise_id, sets, reps, rpe, weight } = req.body;

        // Validation: Ensure the required IDs are present
        if (!sessionId || !exercise_id) {
            return res.status(400).json({ message: "Missing sessionId or exercise_id" });
        }

        // Insert into the exercise_log table
        const [newLog] = await db
            .insert(exerciseLog)
            .values({
                workoutSessionsId: sessionId, // Links to the parent session
                exercise_id,
                sets,
                reps,
                rpe,
                weight,
                // createdAt defaults to now() in the DB schema
            })
            .returning();

        if (!newLog) {
            return res.status(404).json({ message: 'Failed to add log' });
        }

        res.status(201).json(newLog);

    } catch (err) {
        console.error('Log creation error:', err);
        res.status(500).json({ error: err.message });
    }
});

//Get all logs for this specific session (with the Join!)
router.get('/:id/exerciseLogs', async (req, res) => {
    try {
        const sessionId = Number(req.params.id);
        //we join the exerciselog table and the exercises table but only taking the exercise name where the exercise ids match in both tables
        //hence being able to get the names of the exercises
        const logs = await db
            .select({
                id: exerciseLog.id,
                exerciseName: exercises.name,
                sets: exerciseLog.sets,
                reps: exerciseLog.reps,
                rpe: exerciseLog.rpe,
                weight: exerciseLog.weight,
                createdAt: exerciseLog.createdAt,
            })
            .from(exerciseLog)
            .leftJoin(exercises, eq(exerciseLog.exercise_id, exercises.id))
            .where(eq(exerciseLog.workoutSessionsId, sessionId));
const formattedLogs = logs.map(log => ({
            ...log,
            sets: typeof log.sets === 'string' ? JSON.parse(log.sets) : (log.sets || [])
        }));

        res.json(formattedLogs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

//Get a workout session with all of its exercise logs
router.get('/:id/full', async (req, res) => {
    try {
        const sessionId = Number(req.params.id);

        const fullSession = await db.query.workoutSessions.findFirst({
            where: eq(workoutSessions.id , sessionId),
            with: {
                exerciseLogs: true
            },
    
    });
    if(!fullSession){
        return res.status(404).json({message: 'Workout Session Id not found'})
    }

    res.json(fullSession);
    }
     catch(err){
        console.error(err);
        res.status(500).json({error: 'Failed to fetch workout session data'})

    }
});

// Get ONLY templates
router.get('/templates', async (req, res) => {
    try {
        const templates = await db.select()
            .from(workoutSessions)
            .where(eq(workoutSessions.is_template, true)); // Filter by template status
        res.json(templates);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// backend/routes/workoutSessions.js

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { is_template, end_time } = req.body;

    // We are only updating columns we KNOW exist in your schema
    const updatedSession = await db.update(workoutSessions)
      .set({ 
        is_template: is_template, // Matches your pgTable exactly
        // IF YOU HAVEN'T RUN THE MIGRATION FOR endTime YET, COMMENT THE LINE BELOW OUT:
        // endTime: end_time 
      })
      .where(eq(workoutSessions.id, Number(id)))
      .returning();

    if (updatedSession.length === 0) {
        return res.status(404).json({ error: "Session not found" });
    }

    res.json(updatedSession[0]);
  } catch (err) {
    console.error("PUT Error:", err);
    res.status(500).json({ error: err.message }); // This sends the red error to your frontend
  }
});

export default router;