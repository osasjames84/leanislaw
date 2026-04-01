import express from 'express';
import 'dotenv/config';
import exercisesRouter from './routes/exercises.js';
import usersRouter from './routes/users.js';
import workoutSessionsRouter from './routes/workoutSessions.js';
import exerciseLogRouter from './routes/exerciseLog.js';
import authRouter from './routes/auth.js';
import tdeeRouter from './routes/tdee.js';
import strengthRouter from './routes/strength.js';
import leaderboardRouter from './routes/leaderboard.js';
import macrosRouter from './routes/macros.js';
import chatRouter from './routes/chat.js';
import coachingRouter, { handleStripeCoachingWebhook } from './routes/coaching.js';

const app = express();
const port = Number(process.env.PORT) || 4000;
const rawOrigins = process.env.CORS_ORIGINS || '';
const allowedOrigins = rawOrigins
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

// Stripe coaching webhook must use raw body for signature verification (not JSON).
app.post(
    '/api/v1/coaching/stripe-webhook',
    express.raw({ type: 'application/json' }),
    handleStripeCoachingWebhook
);

app.use(express.json());

app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (!origin) return next();
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Vary', 'Origin');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    }
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
});

// Middleware logs timestamp, method, and URL.
app.use((req, _res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url}`);
    next();
});

app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true, service: 'leanislaw-backend' });
});

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/tdee', tdeeRouter);
app.use('/api/v1/strength', strengthRouter);
app.use('/api/v1/leaderboard', leaderboardRouter);
app.use('/api/v1/macros', macrosRouter);
app.use('/api/v1/chat', chatRouter);
app.use('/api/v1/coaching', coachingRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/exercises', exercisesRouter);
app.use('/api/v1/workoutSessions', workoutSessionsRouter);
app.use('/api/v1/exerciseLog', exerciseLogRouter);

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});