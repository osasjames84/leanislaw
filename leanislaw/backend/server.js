import express from 'express';
import { db } from './db.js';
import 'dotenv/config';
import {users, workoutSessions} from './schema.js'
import {exercises} from './schema.js'
import { eq, lt, gte, ne } from 'drizzle-orm';
import exercisesRouter from './routes/exercises.js';
import usersRouter from './routes/users.js';
import workoutSessionsRouter from './routes/workoutSessions.js';
import exerciseLogRouter from './routes/exerciseLog.js';

const app = express();
const port = 4000;

app.use(express.json());

//Middleware that logs every time the site is visited with
//timestamp
app.use((req, res, next) =>
{
    //this stores the timestamp of page visit
    const timestamp = new Date().toISOString();

    //logs the timestamp, method(GET/POSTetc) and the page url
    console.log(`[${timestamp}] ${req.method} ${req.url}`);

    next();
})



 
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/exercises', exercisesRouter);
app.use('/api/v1/workoutSessions', workoutSessionsRouter);
app.use('/api/v1/exerciseLog', exerciseLogRouter)

app.listen(port, ()=>{
    console.log("Server running on port 4000");
});