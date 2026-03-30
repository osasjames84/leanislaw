import express from 'express';
const app = express()
import { db } from '../db.js';
import {users} from '../schema.js'
import { eq, lt, gte, ne } from 'drizzle-orm';
import {ilike} from 'drizzle-orm';
import {or} from 'drizzle-orm';
import { json } from 'drizzle-orm/gel-core';

app.use(express.json());
const router = express.Router();
//app.use(express.json());

//This api route gets all users
router.get('/', async (req, res) => {
    try {
    const allUsers = await db.select().from(users);
    res.json(allUsers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

//This api route adds a user
router.post("/", async (req, res) => {
    console.log('req.body:', req.body);
    //Get the new user data from the request body
    const {first_name, last_name, email, date_of_birth, password_hash, role} = req.body;

    if (!first_name || !last_name || !email|| !date_of_birth || !password_hash || !role){
        //code 400 for bad request typical when user misses some fields
        return res.status(400).send('Missing Fields');
    }

    //Posting users to the database
    const [newUser] = await db.insert(users)
    .values({first_name, last_name, email, date_of_birth, password_hash, role})
    .returning();
  

    // Send JSON RESPONSE TO THE USER
    res.status(201).json({
      message: `User ${first_name} ${last_name} added`,
      user: newUser
    }
);
    
}   
);

//get user by the user's id
router.get('id/:id', async (req, res) => {
    try{
        const {id} = req.params
        const userId = Number(id);

        const selectedUsers = await db.select()
        .from(users)
        .where(eq(users.id, userId));
        if(selectedUsers.length === 0){
            return res.status(404).json({error: 'Not found'});
        }
        res.json(selectedUsers);
    } catch(err){
        res.status(400).json({error: err.message});
    }
})

//get user by the user name
router.get('/name/:name', async (req, res) => {
    try {
        const { name } = req.params;
        const userName = await db.select()
        .from(users)
        .where(or(
            ilike(users.first_name, `%${name}%`),
            ilike(users.last_name, `%${name}%`)
        ));
        
        if(userName.length === 0){
            return res.status(404).json({error: 'Not Found'});
        }
        res.json(userName);
    } catch(err){
        res.status(500).json({error: err.message});
    }
})

//get workouts linked to certain user
router.get('/:id/workouts', async (req, res) => {
    try {
        const {id} = req.params;
        const userId = Number(id);

        // This query performs the JOIN for you automatically
        const userWithWorkouts = await db.query.users.findFirst({
            where: eq(users.id, userId),
            with: {
                workoutSessions: true, // This fetches all associated sessions
            },
        });

        if (!userWithWorkouts) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json(userWithWorkouts);
    } catch (err) {
        console.error("Query Error:", err);
        res.status(500).json({ error: "Failed to fetch user data" });
    }
});

export default router;
