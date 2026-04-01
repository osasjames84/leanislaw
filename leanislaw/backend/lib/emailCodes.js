import crypto from 'node:crypto';

function pepper() {
    return String(process.env.EMAIL_CODE_PEPPER || process.env.JWT_SECRET || 'dev-email-code-pepper');
}

export function generateSixDigitCode() {
    return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

/** Deterministic hash for storing verification / reset codes (not the plaintext code). */
export function hashEmailCode(code) {
    const norm = String(code || '').replace(/\D/g, '');
    return crypto.createHmac('sha256', pepper()).update(norm).update('|v1').digest('hex');
}

/** Returns six digits only, or null if not exactly 6 digits after stripping non-numeric input. */
export function normalizeSixDigitCode(input) {
    const d = String(input || '').replace(/\D/g, '');
    return d.length === 6 ? d : null;
}
