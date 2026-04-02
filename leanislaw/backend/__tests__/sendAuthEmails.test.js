import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('sendAuthEmails (stub — no outbound provider)', () => {
    it('sendRegistrationCodeEmail returns devCode and skipped', async () => {
        const { sendRegistrationCodeEmail } = await import('../lib/sendAuthEmails.js');
        const r = await sendRegistrationCodeEmail({ to: 'any@example.com', code: '123456' });
        assert.strictEqual(r.ok, true);
        assert.strictEqual(r.skipped, true);
        assert.strictEqual(r.devCode, '123456');
    });

    it('sendPasswordResetCodeEmail returns devCode and skipped', async () => {
        const { sendPasswordResetCodeEmail } = await import('../lib/sendAuthEmails.js');
        const r = await sendPasswordResetCodeEmail({ to: 'any@example.com', code: '654321' });
        assert.strictEqual(r.ok, true);
        assert.strictEqual(r.skipped, true);
        assert.strictEqual(r.devCode, '654321');
    });
});
