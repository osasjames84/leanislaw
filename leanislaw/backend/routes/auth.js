import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { users } from '../schema.js';
import { eq, sql, and } from 'drizzle-orm';
import { JWT_SECRET, requireAuth } from '../middleware/auth.js';
import { ageFromDateOfBirth, MIN_REGISTER_AGE, MAX_REGISTER_AGE } from '../lib/accountRules.js';
import { generateSixDigitCode, hashEmailCode, normalizeSixDigitCode } from '../lib/emailCodes.js';
import { sendRegistrationCodeEmail, sendPasswordResetCodeEmail } from '../lib/sendAuthEmails.js';

const router = express.Router();
const SALT_ROUNDS = 10;
const VERIFICATION_TTL_MS = 48 * 60 * 60 * 1000;

function stripPassword(userRow) {
    if (!userRow) return null;
    const { password_hash, email_verification_token, password_reset_code_hash, ...rest } = userRow;
    return rest;
}

function signToken(user) {
    return jwt.sign(
        { sub: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

// POST /api/v1/auth/register
router.post('/register', async (req, res) => {
    const { first_name, last_name, email, password, date_of_birth, role } = req.body;

    if (!first_name || !last_name || !email || !password || !date_of_birth) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const emailNorm = String(email).trim().toLowerCase();

    const age = ageFromDateOfBirth(String(date_of_birth));
    if (age == null) {
        return res.status(400).json({ error: 'Use a valid date of birth (YYYY-MM-DD).' });
    }
    if (age < MIN_REGISTER_AGE) {
        return res.status(400).json({ error: `You must be at least ${MIN_REGISTER_AGE} years old to register.` });
    }
    if (age > MAX_REGISTER_AGE) {
        return res.status(400).json({ error: 'Please enter a valid date of birth.' });
    }

    const verifyCode = generateSixDigitCode();
    const verifyCodeHash = hashEmailCode(verifyCode);
    const verifyExpires = new Date(Date.now() + VERIFICATION_TTL_MS);

    try {
        const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
        const [user] = await db
            .insert(users)
            .values({
                first_name,
                last_name,
                email: emailNorm,
                date_of_birth,
                password_hash,
                role: role === 'coach' ? 'coach' : 'client',
                tdee_onboarding_done: false,
                email_verified: false,
                email_verification_token: verifyCodeHash,
                email_verification_expires_at: verifyExpires,
                email_verification_sent_at: new Date(),
            })
            .returning();

        const sent = await sendRegistrationCodeEmail({ to: emailNorm, code: verifyCode });
        if (!sent.ok) {
            await db.delete(users).where(eq(users.id, user.id));
            return res.status(503).json({
                error: sent.error || 'Could not send verification email. Check RESEND_API_KEY and EMAIL_FROM.',
            });
        }

        const body = {
            message: 'Check your email for a 6-digit code to verify your account before signing in.',
            email: user.email,
        };
        if (sent.skipped && sent.devCode && process.env.NODE_ENV !== 'production') {
            body.devVerificationCode = sent.devCode;
        }
        res.status(201).json(body);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Email already registered' });
        }
        console.error('Register error:', err);
        const msg = [err?.message, err?.cause?.message].filter(Boolean).join('\n');
        const isSchema =
            /premium_coaching_active|tdee_onboarding_done|email_verified|email_verification|password_reset|failed_login_count/i.test(
                msg
            ) ||
            /42703|undefined_column|column .* does not exist/i.test(msg) ||
            /Failed query:[\s\S]*insert into "users"/i.test(msg);
        if (isSchema) {
            return res.status(503).json({
                error:
                    'Database needs updating: open Railway → Postgres → run SQL from backend/migrations/007_premium_coaching.sql (adds premium_coaching_active). Or run: npm run migrate with DATABASE_URL.',
            });
        }
        res.status(500).json({ error: 'Could not create account' });
    }
});

// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    try {
        const emailNorm = String(email || '').trim().toLowerCase();
        const rows = await db.select().from(users).where(sql`lower(${users.email}) = ${emailNorm}`).limit(1);
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const user = rows[0];
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) {
            const prev = user.failed_login_count ?? 0;
            const newCount = prev + 1;
            await db
                .update(users)
                .set({ failed_login_count: newCount })
                .where(eq(users.id, user.id));
            return res.status(401).json({
                error: 'Invalid email or password',
                failedLoginCount: newCount,
                suggestPasswordReset: newCount >= 3,
            });
        }
        if (!user.email_verified) {
            return res.status(403).json({
                error: 'Verify your email first. Enter the code from your email or resend from the sign-up screen.',
                code: 'EMAIL_NOT_VERIFIED',
            });
        }
        await db.update(users).set({ failed_login_count: 0 }).where(eq(users.id, user.id));
        const safe = stripPassword(user);
        const token = signToken(user);
        res.json({ token, user: safe });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/auth/tdee-onboarding/complete — mark one-time setup done
router.post('/tdee-onboarding/complete', requireAuth, async (req, res) => {
    try {
        await db
            .update(users)
            .set({ tdee_onboarding_done: true })
            .where(eq(users.id, req.userId));
        const rows = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(stripPassword(rows[0]));
    } catch (err) {
        console.error('tdee-onboarding/complete error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/auth/tdee-onboarding/reset — local/testing only (set ALLOW_TDEE_ONBOARDING_RESET=true)
router.post('/tdee-onboarding/reset', requireAuth, async (req, res) => {
    if (process.env.ALLOW_TDEE_ONBOARDING_RESET !== 'true') {
        return res.status(403).json({ error: 'Not allowed' });
    }
    try {
        await db
            .update(users)
            .set({ tdee_onboarding_done: false })
            .where(eq(users.id, req.userId));
        const rows = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(stripPassword(rows[0]));
    } catch (err) {
        console.error('tdee-onboarding/reset error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/v1/auth/verify-registration-code { email, code }
router.post('/verify-registration-code', async (req, res) => {
    const emailNorm = String(req.body?.email || '')
        .trim()
        .toLowerCase();
    const codeRaw = String(req.body?.code || '');
    const code = normalizeSixDigitCode(codeRaw);
    if (!emailNorm || !code) {
        return res.status(400).json({ error: 'Enter your email and the 6-digit code from your email.' });
    }
    try {
        const h = hashEmailCode(code);
        const rows = await db
            .select()
            .from(users)
            .where(and(sql`lower(${users.email}) = ${emailNorm}`, eq(users.email_verification_token, h)))
            .limit(1);
        if (rows.length === 0) {
            return res.status(400).json({ error: 'Invalid code. Check the email or request a new code.' });
        }
        const u = rows[0];
        if (u.email_verified) {
            return res.status(400).json({ error: 'This account is already verified.' });
        }
        if (u.email_verification_expires_at && new Date(u.email_verification_expires_at) < new Date()) {
            return res.status(400).json({ error: 'This code has expired. Request a new verification email.' });
        }
        await db
            .update(users)
            .set({
                email_verified: true,
                email_verification_token: null,
                email_verification_expires_at: null,
            })
            .where(eq(users.id, u.id));
        res.json({ ok: true, email: u.email });
    } catch (err) {
        console.error('verify-registration-code error:', err);
        res.status(500).json({ error: 'Could not verify email' });
    }
});

// POST /api/v1/auth/forgot-password { email }
router.post('/forgot-password', async (req, res) => {
    const emailNorm = String(req.body?.email || '')
        .trim()
        .toLowerCase();
    if (!emailNorm || !emailNorm.includes('@')) {
        return res.status(400).json({ error: 'Enter a valid email.' });
    }
    const message = 'If an account exists for that email, we sent a reset code.';
    try {
        const rows = await db.select().from(users).where(sql`lower(${users.email}) = ${emailNorm}`).limit(1);
        if (rows.length === 0) {
            return res.json({ ok: true, message });
        }
        const u = rows[0];
        const sentAt = u.password_reset_sent_at;
        if (sentAt && Date.now() - new Date(sentAt).getTime() < 90_000) {
            return res.status(429).json({ error: 'Please wait about a minute before requesting another code.' });
        }
        const resetCode = generateSixDigitCode();
        const resetHash = hashEmailCode(resetCode);
        const resetExpires = new Date(Date.now() + 30 * 60 * 1000);
        await db
            .update(users)
            .set({
                password_reset_code_hash: resetHash,
                password_reset_expires_at: resetExpires,
                password_reset_sent_at: new Date(),
            })
            .where(eq(users.id, u.id));

        const sent = await sendPasswordResetCodeEmail({ to: emailNorm, code: resetCode });
        if (!sent.ok) {
            await db
                .update(users)
                .set({
                    password_reset_code_hash: null,
                    password_reset_expires_at: null,
                    password_reset_sent_at: null,
                })
                .where(eq(users.id, u.id));
            return res.status(503).json({ error: sent.error || 'Could not send email' });
        }
        const fpBody = { ok: true, message };
        if (sent.skipped && sent.devCode && process.env.NODE_ENV !== 'production') {
            fpBody.devResetCode = sent.devCode;
        }
        res.json(fpBody);
    } catch (err) {
        console.error('forgot-password error:', err);
        const msg = [err?.message, err?.cause?.message].filter(Boolean).join('\n');
        if (/password_reset|42703|undefined_column|column .* does not exist/i.test(msg)) {
            return res.status(503).json({
                error: 'Database needs updating: run migration 009_password_reset_codes.sql (npm run migrate).',
            });
        }
        res.status(500).json({ error: 'Could not process request' });
    }
});

// POST /api/v1/auth/reset-password { email, code, new_password }
router.post('/reset-password', async (req, res) => {
    const emailNorm = String(req.body?.email || '')
        .trim()
        .toLowerCase();
    const code = normalizeSixDigitCode(String(req.body?.code || ''));
    const new_password = req.body?.new_password ?? req.body?.newPassword;
    if (!emailNorm || !code || typeof new_password !== 'string' || new_password.length < 6) {
        return res.status(400).json({
            error: 'Enter your email, the 6-digit code, and a new password (at least 6 characters).',
        });
    }
    try {
        const h = hashEmailCode(code);
        const rows = await db
            .select()
            .from(users)
            .where(and(sql`lower(${users.email}) = ${emailNorm}`, eq(users.password_reset_code_hash, h)))
            .limit(1);
        if (rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired code.' });
        }
        const u = rows[0];
        if (!u.password_reset_expires_at || new Date(u.password_reset_expires_at) < new Date()) {
            return res.status(400).json({ error: 'Invalid or expired code.' });
        }
        const password_hash = await bcrypt.hash(new_password, SALT_ROUNDS);
        await db
            .update(users)
            .set({
                password_hash,
                password_reset_code_hash: null,
                password_reset_expires_at: null,
                password_reset_sent_at: null,
                failed_login_count: 0,
                /** Reset via inbox proves email access — same as verification. */
                email_verified: true,
                email_verification_token: null,
                email_verification_expires_at: null,
            })
            .where(eq(users.id, u.id));
        res.json({ ok: true });
    } catch (err) {
        console.error('reset-password error:', err);
        res.status(500).json({ error: 'Could not reset password' });
    }
});

// POST /api/v1/auth/resend-verification { email }
router.post('/resend-verification', async (req, res) => {
    const email = String(req.body?.email || '')
        .trim()
        .toLowerCase();
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }
    try {
        const rows = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'No account with that email.' });
        }
        const u = rows[0];
        if (u.email_verified) {
            return res.status(400).json({ error: 'This account is already verified.' });
        }
        const sentAt = u.email_verification_sent_at;
        if (sentAt && Date.now() - new Date(sentAt).getTime() < 90_000) {
            return res.status(429).json({ error: 'Please wait about a minute before requesting another email.' });
        }

        const verifyCode = generateSixDigitCode();
        const verifyCodeHash = hashEmailCode(verifyCode);
        const verifyExpires = new Date(Date.now() + VERIFICATION_TTL_MS);
        await db
            .update(users)
            .set({
                email_verification_token: verifyCodeHash,
                email_verification_expires_at: verifyExpires,
                email_verification_sent_at: new Date(),
            })
            .where(eq(users.id, u.id));

        const sent = await sendRegistrationCodeEmail({ to: email, code: verifyCode });
        if (!sent.ok) {
            return res.status(503).json({ error: sent.error || 'Could not send email' });
        }
        const resBody = { ok: true };
        if (sent.skipped && sent.devCode && process.env.NODE_ENV !== 'production') {
            resBody.devVerificationCode = sent.devCode;
        }
        res.json(resBody);
    } catch (err) {
        console.error('resend-verification error:', err);
        res.status(500).json({ error: 'Could not resend email' });
    }
});

// GET /api/v1/auth/me — current user from JWT
router.get('/me', requireAuth, async (req, res) => {
    try {
        const rows = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(stripPassword(rows[0]));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
