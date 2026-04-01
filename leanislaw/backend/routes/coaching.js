import express from 'express';
import Stripe from 'stripe';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../db.js';
import { users } from '../schema.js';
import { eq } from 'drizzle-orm';

const router = express.Router();

const BILLING_PLANS = ['monthly', 'semiannual', 'yearly'];

function getStripeClient() {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key) return null;
    return new Stripe(key);
}

/** Enough to open Checkout (webhook not required for session creation). */
function stripeCheckoutCanStart() {
    const url = String(process.env.FRONTEND_URL || '').trim();
    const monthly = process.env.STRIPE_PRICE_ID_MONTHLY?.trim();
    const semiannual = process.env.STRIPE_PRICE_ID_SEMIANNUAL?.trim();
    const yearly = process.env.STRIPE_PRICE_ID_YEARLY?.trim();
    return Boolean(
        process.env.STRIPE_SECRET_KEY?.trim() && url && monthly && semiannual && yearly
    );
}

function stripeWebhookConfigured() {
    return Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
}

/** Booleans only — safe to expose so the app can show why Pay is disabled. */
function stripeEnvCheck() {
    return {
        secret_key: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
        frontend_url: Boolean(String(process.env.FRONTEND_URL || '').trim()),
        price_monthly: Boolean(process.env.STRIPE_PRICE_ID_MONTHLY?.trim()),
        price_semiannual: Boolean(process.env.STRIPE_PRICE_ID_SEMIANNUAL?.trim()),
        price_yearly: Boolean(process.env.STRIPE_PRICE_ID_YEARLY?.trim()),
    };
}

function priceIdForBilling(billing) {
    const map = {
        monthly: process.env.STRIPE_PRICE_ID_MONTHLY?.trim(),
        semiannual: process.env.STRIPE_PRICE_ID_SEMIANNUAL?.trim(),
        yearly: process.env.STRIPE_PRICE_ID_YEARLY?.trim(),
    };
    return map[billing] || null;
}

async function loadUserRole(userId) {
    const rows = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
    return rows[0]?.role ?? null;
}

/** Coach-only routes */
export async function requireCoach(req, res, next) {
    try {
        const role = await loadUserRole(req.userId);
        if (role !== 'coach') {
            return res.status(403).json({ error: 'Coach access only' });
        }
        next();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// GET /api/v1/coaching/status — coaching tier + role for UI
router.get('/status', requireAuth, async (req, res) => {
    try {
        const rows = await db
            .select({
                role: users.role,
                premium_coaching_active: users.premium_coaching_active,
            })
            .from(users)
            .where(eq(users.id, req.userId))
            .limit(1);
        if (!rows.length) return res.status(404).json({ error: 'User not found' });
        res.json({
            ...rows[0],
            stripe_checkout_enabled: stripeCheckoutCanStart(),
            stripe_webhook_configured: stripeWebhookConfigured(),
            stripe_env_check: stripeEnvCheck(),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/v1/coaching/panel — placeholder coach dashboard data
router.get('/panel', requireAuth, requireCoach, async (_req, res) => {
    res.json({
        headline: 'Coach dashboard',
        clients_preview: [],
        message: 'Client roster and messaging will connect here after payments go live.',
    });
});

/**
 * Dev / staging: unlock premium without Stripe. Production: set ALLOW_COACHING_DEV_UNLOCK=true only if you need it.
 * Real payments: implement POST /webhooks/stripe and set premium_coaching_active from checkout.session.completed.
 */
router.post('/dev/unlock-premium', requireAuth, async (req, res) => {
    const allowed =
        process.env.NODE_ENV !== 'production' || process.env.ALLOW_COACHING_DEV_UNLOCK === 'true';
    if (!allowed) {
        return res.status(403).json({ error: 'Dev unlock disabled in production' });
    }
    try {
        await db
            .update(users)
            .set({ premium_coaching_active: true })
            .where(eq(users.id, req.userId));
        const rows = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
        if (!rows.length) return res.status(404).json({ error: 'User not found' });
        const { password_hash, ...safe } = rows[0];
        res.json({ ok: true, user: safe });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/v1/coaching/create-checkout-session
 * Body: { billing: "monthly" | "semiannual" | "yearly" }
 * Returns { url } for Stripe Checkout (subscription).
 */
router.post('/create-checkout-session', requireAuth, async (req, res) => {
    const billing = req.body?.billing;
    if (!BILLING_PLANS.includes(billing)) {
        return res.status(400).json({ error: 'Invalid billing plan' });
    }
    const stripe = getStripeClient();
    if (!stripe || !stripeCheckoutCanStart()) {
        return res.status(503).json({
            error: 'Payments are not configured yet',
            hint: 'Set STRIPE_SECRET_KEY, FRONTEND_URL (no trailing slash), and STRIPE_PRICE_ID_* on the backend.',
        });
    }
    const priceId = priceIdForBilling(billing);
    if (!priceId) {
        return res.status(503).json({ error: 'Price not configured for this plan' });
    }
    const frontendUrl = String(process.env.FRONTEND_URL || '')
        .trim()
        .replace(/\/$/, '');
    if (!frontendUrl) {
        return res.status(503).json({ error: 'FRONTEND_URL is not set' });
    }

    const sessionPayloadBase = {
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${frontendUrl}/premium-coaching?checkout=success`,
        cancel_url: `${frontendUrl}/premium-coaching?checkout=cancelled`,
        client_reference_id: String(req.userId),
        customer_email: req.userEmail || undefined,
        // Keep Checkout light: only collect what Stripe/card rules require.
        billing_address_collection: 'auto',
        phone_number_collection: { enabled: false },
        tax_id_collection: { enabled: false },
        automatic_tax: { enabled: false },
        metadata: {
            user_id: String(req.userId),
            billing,
        },
        subscription_data: {
            metadata: {
                user_id: String(req.userId),
                billing,
            },
        },
    };

    try {
        let session;
        try {
            session = await stripe.checkout.sessions.create({
                ...sessionPayloadBase,
                automatic_payment_methods: { enabled: true },
            });
        } catch (firstErr) {
            console.warn('[coaching] Checkout with automatic_payment_methods failed, retrying with card only:', firstErr?.message);
            session = await stripe.checkout.sessions.create({
                ...sessionPayloadBase,
                payment_method_types: ['card'],
            });
        }
        if (!session.url) {
            return res.status(500).json({ error: 'No checkout URL returned' });
        }
        res.json({ url: session.url });
    } catch (err) {
        console.error('Stripe create-checkout-session:', err);
        const message =
            err?.raw?.message || err?.message || 'Checkout failed — check Stripe price IDs (test vs live) and currency.';
        res.status(500).json({ error: message });
    }
});

/**
 * Stripe webhook — register in server.js with express.raw BEFORE express.json().
 * Unlocks premium_coaching_active on checkout.session.completed.
 */
export async function handleStripeCoachingWebhook(req, res) {
    const stripe = getStripeClient();
    const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripe || !whSecret) {
        console.warn('[coaching] Stripe webhook skipped: missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET');
        return res.status(503).send('Not configured');
    }

    const sig = req.headers['stripe-signature'];
    if (!sig) {
        return res.status(400).send('Missing stripe-signature');
    }

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, whSecret);
    } catch (err) {
        console.error('[coaching] Webhook signature verify failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            const userIdRaw = session.metadata?.user_id || session.client_reference_id;
            const userId = userIdRaw != null ? Number(userIdRaw) : NaN;
            if (Number.isFinite(userId) && userId > 0) {
                await db
                    .update(users)
                    .set({ premium_coaching_active: true })
                    .where(eq(users.id, userId));
                console.log(`[coaching] Premium unlocked for user_id=${userId} (checkout ${session.id})`);
            } else {
                console.warn('[coaching] checkout.session.completed missing user id', session.id);
            }
        }
    } catch (err) {
        console.error('[coaching] Webhook handler error:', err);
        return res.status(500).json({ received: false });
    }

    res.json({ received: true });
}

export default router;
