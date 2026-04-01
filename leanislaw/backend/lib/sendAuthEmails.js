/**
 * Auth emails via Resend. Env: RESEND_API_KEY, EMAIL_FROM
 * (FRONTEND_URL not required for code-only flows.)
 */
async function sendResend({ to, subject, html }) {
    const key = process.env.RESEND_API_KEY?.trim();
    const from = process.env.EMAIL_FROM?.trim() || 'Lean Is Law <onboarding@resend.dev>';

    const isProd = process.env.NODE_ENV === 'production';
    if (!key) {
        if (isProd) {
            return { ok: false, error: 'RESEND_API_KEY is not configured' };
        }
        console.warn('[email] RESEND_API_KEY missing — dev only, not sending to', to);
        return { ok: true, skipped: true };
    }

    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to: [to], subject, html }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        console.error('[email] Resend error:', data);
        return { ok: false, error: data.message || data.error || `Resend HTTP ${res.status}` };
    }
    return { ok: true };
}

export async function sendRegistrationCodeEmail({ to, code }) {
    if (!to || !code) return { ok: false, error: 'Missing recipient or code' };
    const isProd = process.env.NODE_ENV === 'production';
    const key = process.env.RESEND_API_KEY?.trim();
    if (!key && !isProd) {
        console.warn('[email] Registration code (dev):', code, '→', to);
    }
    return sendResend({
        to,
        subject: 'Your Lean Is Law verification code',
        html: `<p>Your verification code is:</p><p style="font-size:1.5rem;font-weight:700;letter-spacing:0.2em">${code}</p><p>It expires in 48 hours. If you didn’t sign up, ignore this email.</p>`,
    });
}

export async function sendPasswordResetCodeEmail({ to, code }) {
    if (!to || !code) return { ok: false, error: 'Missing recipient or code' };
    const isProd = process.env.NODE_ENV === 'production';
    const key = process.env.RESEND_API_KEY?.trim();
    if (!key && !isProd) {
        console.warn('[email] Password reset code (dev):', code, '→', to);
    }
    return sendResend({
        to,
        subject: 'Your Lean Is Law password reset code',
        html: `<p>Your password reset code is:</p><p style="font-size:1.5rem;font-weight:700;letter-spacing:0.2em">${code}</p><p>It expires in 30 minutes. If you didn’t request this, ignore this email.</p>`,
    });
}
