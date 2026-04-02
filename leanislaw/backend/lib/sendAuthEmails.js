/**
 * Outbound email (e.g. Resend) is not wired up yet. Stub keeps auth routes simple;
 * registration auto-verifies; password reset returns the code in the JSON response.
 */
export async function sendRegistrationCodeEmail({ to: _to, code }) {
    if (!code) return { ok: false, error: 'Missing code' };
    return { ok: true, skipped: true, devCode: code };
}

export async function sendPasswordResetCodeEmail({ to: _to, code }) {
    if (!code) return { ok: false, error: 'Missing code' };
    return { ok: true, skipped: true, devCode: code };
}
