import express from 'express';
import 'dotenv/config';
import { applySqlMigrations } from './lib/applySqlMigrations.js';
import { dbConnectionHint, resolveDatabaseUrl, verifyPgConnection } from './lib/pgConnection.js';
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
import chessRouter from './routes/chess.js';
import coachingRouter, { handleStripeCoachingWebhook } from './routes/coaching.js';
import socialRouter from './routes/social.js';
import reportsRouter from './routes/reports.js';
import safeguardingRouter from './routes/safeguarding.js';
import programsRouter from './routes/programs.js';
import formsRouter from './routes/forms.js';
import tutorialsRouter from './routes/tutorials.js';
import clientProfileRouter from './routes/clientProfile.js';
import tasksRouter from './routes/tasks.js';
import clientContentRouter from './routes/clientContent.js';
import looksmaxRouter from './routes/looksmax.js';
import { startWeeklyScheduler } from './lib/weeklyReport/schedule.js';

const app = express();
const port = Number(process.env.PORT) || 4000;
const rawOrigins = process.env.CORS_ORIGINS || '';
// Configured origins + safe localhost defaults. We never reflect an arbitrary
// origin (the old `allowedOrigins.length === 0` branch did exactly that).
const allowedOrigins = new Set([
    ...rawOrigins.split(',').map((s) => s.trim()).filter(Boolean),
    'http://localhost:5173',
    'http://localhost:4173',
    'http://127.0.0.1:5173',
]);

// Stripe coaching webhook must use raw body for signature verification (not JSON).
app.post(
    '/api/v1/coaching/stripe-webhook',
    express.raw({ type: 'application/json' }),
    handleStripeCoachingWebhook
);

app.use(express.json({ limit: '12mb' })); // base64 progress photos / DM images

// Baseline security headers (helmet-equivalent, no dependency).
app.use((_req, res, next) => {
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.header('X-DNS-Prefetch-Control', 'off');
    res.header('Cross-Origin-Resource-Policy', 'same-site');
    next();
});

app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.has(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Vary', 'Origin');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    }
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
});

// Lightweight in-memory rate limiter (no dependency). Tighter on auth routes to
// blunt credential brute-forcing.
const rateBuckets = new Map();
function rateLimit({ windowMs, max }) {
    return (req, res, next) => {
        const key = `${req.ip}:${req.baseUrl}`;
        const now = Date.now();
        const b = rateBuckets.get(key);
        if (!b || now > b.reset) {
            rateBuckets.set(key, { count: 1, reset: now + windowMs });
            return next();
        }
        b.count += 1;
        if (b.count > max) {
            res.header('Retry-After', String(Math.ceil((b.reset - now) / 1000)));
            return res.status(429).json({ error: 'Too many requests. Please slow down.' });
        }
        next();
    };
}
// Periodically prune expired buckets.
setInterval(() => { const now = Date.now(); for (const [k, b] of rateBuckets) if (now > b.reset) rateBuckets.delete(k); }, 60000).unref?.();

app.use('/api/v1/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 50 }));
app.use('/api/v1', rateLimit({ windowMs: 60 * 1000, max: 300 }));

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
app.use('/api/v1/chess', chessRouter);
app.use('/api/v1/coaching', coachingRouter);
app.use('/api/v1/social', socialRouter);
app.use('/api/v1/reports', reportsRouter);
app.use('/api/v1/safeguarding', safeguardingRouter);
app.use('/api/v1/programs', programsRouter);
app.use('/api/v1/forms', formsRouter);
app.use('/api/v1/tutorials', tutorialsRouter);
app.use('/api/v1/profile', clientProfileRouter);
app.use('/api/v1/tasks', tasksRouter);
app.use('/api/v1/content', clientContentRouter);
app.use('/api/v1/looksmax', looksmaxRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/exercises', exercisesRouter);
app.use('/api/v1/workoutSessions', workoutSessionsRouter);
app.use('/api/v1/exerciseLog', exerciseLogRouter);

function skipAutoMigrate() {
    const v = process.env.SKIP_SQL_MIGRATIONS;
    return v === '1' || /^true$/i.test(String(v || ''));
}

async function start() {
    const databaseUrl = resolveDatabaseUrl();
    if (!databaseUrl) {
        console.error('[db] No database URL. Set DATABASE_URL or USE_LOCAL_DB=1 with DB_* in backend/.env');
        process.exit(1);
    }
    try {
        await verifyPgConnection(databaseUrl);
        console.log('[db] connected');
    } catch (err) {
        console.error('[db] connection failed:', err);
        const hint = dbConnectionHint(err);
        if (hint) console.error(hint);
        process.exit(1);
    }
    if (!skipAutoMigrate()) {
        try {
            await applySqlMigrations({
                databaseUrl,
                verbose: process.env.MIGRATE_VERBOSE === '1',
            });
            console.log('[migrate] SQL migrations applied');
        } catch (err) {
            console.error('[migrate] failed:', err);
            process.exit(1);
        }
    }
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
    startWeeklyScheduler();
}

start();