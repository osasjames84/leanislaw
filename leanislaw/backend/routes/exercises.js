import express from 'express';
import { db } from '../db.js';
const app = express()
import { exercises } from '../schema.js';
import { eq, lt, gte, gt, ne } from 'drizzle-orm';
import { ilike } from 'drizzle-orm';
import { body_part } from '../schema.js';

app.use(express.json());
const router = express.Router();

// Get all exercises
router.get('/', async (req, res) => {
  try {
    const allExercises = await db.select().from(exercises);
    res.json(allExercises);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//get exercise by the exercise category
router.get('/part/:body_part', async (req, res) => {
  try {
    const { body_part } = req.params;

    const exercisesByCategory = await db
      .select()
      .from(exercises)
      .where(eq(exercises.body_part, body_part.toLowerCase()));

    if (exercisesByCategory.length === 0) {
      return res.status(404).json({ error: 'No exercises found for this body part' });
    }

    res.json(exercisesByCategory);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});


//get exercise by the exercise id
router.get('/:id', async (req, res) => {
    try{
        const exerciseId = Number(req.params.id);

        const selectedExercise = await db.select()
        .from(exercises)
        .where(eq(exercises.id, exerciseId));
        if(selectedExercise.length === 0){
            return res.status(404).json({error: 'not found'});
        }
        res.json(selectedExercise);
    } catch(err){
        res.status(400).json({error: err.message});
    }
})

//get exercise by the exercise name
router.get('/exerciseName/:name', async (req, res) => {
    try {
        const { name } = req.params;
        const exerciseName = await db.select()
        .from(exercises)
        .where(ilike(exercises.name, `%${name}%`));
        
        if(!name){
            res.status(404).json({error: 'Not Found'});
        }
        res.json(exerciseName);
    } catch(err){
        res.status(400).json({error: err.message});
    }
})

router.post('/', async (req , res) =>{
    const {name, body_part} = req.body;
    //If name and body part absent then error missing fields
    if(!name || !body_part){
        return res.status(404).json({error: 'Missing Fields'});
    }
    //New exerise inserts the name and body
    const newExercise = await db.insert(exercises).values({name, body_part}).returning();

    //If it is null then return error
    if(!newExercise || newExercise.length === 0){
        return res.status(500).json({ error: "Failed to insert exercise" });
    }
    res.status(201).json({
      message: `Exercise ${name}`,
      exercises: newExercise
    })
});

router.patch('/:id', async (req, res) => {
    const {id} = req.params;
    const {name, body_part} = req.body;

try{
    const[editedExercise] = await db.update(exercises)
    .set({name, body_part})
    .where(eq(exercises.id ,id))
    .returning()

    res.status(201).json({
        message: `Exercise ${id} edited`
    })
} catch(erorr){
    res.status(500).json({error: 'Failed to update'})
}
});

//delete exercises
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const exerciseId = Number(id);
        if (!id) return res.status(400).json({ message: 'Invalid Id' });

        const deleteExercise = await db.delete(exercises)
            .where(eq(exercises.id, exerciseId))
            .returning(); // Use .returning() to get the actual data back

        res.status(200).json({
            message: `Exercise ${exerciseId} has been deleted`,
            exercises: deleteExercise
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

export default router;