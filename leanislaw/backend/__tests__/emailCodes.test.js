import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { generateSixDigitCode, hashEmailCode, normalizeSixDigitCode } from '../lib/emailCodes.js';

describe('emailCodes', () => {
    const origPepper = process.env.EMAIL_CODE_PEPPER;
    const origJwt = process.env.JWT_SECRET;

    beforeEach(() => {
        delete process.env.EMAIL_CODE_PEPPER;
        process.env.JWT_SECRET = 'test-jwt-secret';
    });

    afterEach(() => {
        if (origPepper !== undefined) process.env.EMAIL_CODE_PEPPER = origPepper;
        else delete process.env.EMAIL_CODE_PEPPER;
        if (origJwt !== undefined) process.env.JWT_SECRET = origJwt;
        else delete process.env.JWT_SECRET;
    });

    it('generateSixDigitCode returns 6 numeric chars', () => {
        const c = generateSixDigitCode();
        assert.match(c, /^\d{6}$/);
    });

    it('normalizeSixDigitCode strips non-digits and requires length 6', () => {
        assert.strictEqual(normalizeSixDigitCode('123456'), '123456');
        assert.strictEqual(normalizeSixDigitCode('12 34 56'), '123456');
        assert.strictEqual(normalizeSixDigitCode('12345'), null);
        assert.strictEqual(normalizeSixDigitCode('1234567'), null);
    });

    it('hashEmailCode is stable for same code and pepper', () => {
        const a = hashEmailCode('000001');
        const b = hashEmailCode('000001');
        assert.strictEqual(a, b);
        assert.strictEqual(a.length, 64);
    });

    it('hashEmailCode differs for different codes', () => {
        assert.notStrictEqual(hashEmailCode('111111'), hashEmailCode('222222'));
    });
});
