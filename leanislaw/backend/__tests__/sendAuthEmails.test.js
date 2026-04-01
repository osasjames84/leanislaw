import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

describe('sendAuthEmails', () => {
    const origKey = process.env.RESEND_API_KEY;
    const origNodeEnv = process.env.NODE_ENV;
    const origFetch = globalThis.fetch;

    afterEach(() => {
        if (origKey !== undefined) process.env.RESEND_API_KEY = origKey;
        else delete process.env.RESEND_API_KEY;
        if (origNodeEnv !== undefined) process.env.NODE_ENV = origNodeEnv;
        else delete process.env.NODE_ENV;
        globalThis.fetch = origFetch;
    });

    it('sendRegistrationCodeEmail fails in production when RESEND_API_KEY is missing', async () => {
        delete process.env.RESEND_API_KEY;
        process.env.NODE_ENV = 'production';
        const { sendRegistrationCodeEmail } = await import('../lib/sendAuthEmails.js');
        const r = await sendRegistrationCodeEmail({ to: 'test@example.com', code: '123456' });
        assert.strictEqual(r.ok, false);
        assert.ok(r.error);
    });

    it('sendRegistrationCodeEmail skips email in development without key and returns devCode', async () => {
        delete process.env.RESEND_API_KEY;
        process.env.NODE_ENV = 'development';
        const { sendRegistrationCodeEmail } = await import('../lib/sendAuthEmails.js');
        const r = await sendRegistrationCodeEmail({ to: 'osasjames84@gmail.com', code: '987654' });
        assert.strictEqual(r.ok, true);
        assert.strictEqual(r.skipped, true);
        assert.strictEqual(r.devCode, '987654');
    });

    it('sendRegistrationCodeEmail calls Resend when key is set', async () => {
        process.env.RESEND_API_KEY = 're_test_key_for_unit_test';
        process.env.NODE_ENV = 'development';

        let url;
        let body;
        globalThis.fetch = async (u, init) => {
            url = u;
            body = JSON.parse(init.body);
            return { ok: true, status: 200, json: async () => ({ id: 'mock-id' }) };
        };

        const { sendRegistrationCodeEmail } = await import('../lib/sendAuthEmails.js');
        const r = await sendRegistrationCodeEmail({
            to: 'osasjames84@gmail.com',
            code: '424242',
        });

        assert.strictEqual(r.ok, true);
        assert.strictEqual(url, 'https://api.resend.com/emails');
        assert.strictEqual(body.to[0], 'osasjames84@gmail.com');
        assert.match(body.html, /424242/);
        assert.ok(body.subject.toLowerCase().includes('verification'));
    });
});
