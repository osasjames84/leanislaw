#!/usr/bin/env node
/**
 * Sends one real registration-style verification email via Resend.
 * Requires RESEND_API_KEY in backend/.env (or pass in the shell for one run only).
 *
 *   cd leanislaw
 *   npm run email:verification-smoke -- osasjames84@gmail.com
 *
 * One-off without editing .env:
 *   RESEND_API_KEY=re_xxxx node backend/scripts/send-verification-test-email.mjs osasjames84@gmail.com
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(path.join(__dirname, '..', '.env'));

dotenv.config({ path: envPath });

function resendApiKey() {
    return String(process.env.RESEND_API_KEY || process.env.RESEND_KEY || '').trim();
}

const { generateSixDigitCode } = await import('../lib/emailCodes.js');
const { sendRegistrationCodeEmail } = await import('../lib/sendAuthEmails.js');

const to = process.argv[2] || process.env.TEST_EMAIL || 'osasjames84@gmail.com';

if (!resendApiKey()) {
    const hint = `
Resend API key not found.

Fix one of these:

  1) Add to: ${envPath}
     RESEND_API_KEY=re_paste_your_key_here
     EMAIL_FROM=Lean Is Law <onboarding@resend.dev>

     Create a key: https://resend.com/api-keys
     (Variable name must be RESEND_API_KEY — see backend/.env.example)

  2) Or pass only for this command (zsh/bash):
     RESEND_API_KEY=re_xxxx node backend/scripts/send-verification-test-email.mjs ${to}
`;
    console.error(hint.trim());
    process.exit(1);
}

const code = generateSixDigitCode();
console.log('Using .env file:', envPath);
console.log('Sending verification email to:', to);
console.log('Plaintext code (also in email body):', code);

const result = await sendRegistrationCodeEmail({ to, code });
if (!result.ok) {
    console.error('Send failed:', result.error);
    process.exit(1);
}

if (result.skipped) {
    console.error('Unexpected skip — key should trigger a real send. Is NODE_ENV=production without a key in sendAuthEmails?');
    process.exit(1);
}

console.log('Resend accepted the message. Check inbox and spam for the code.');
