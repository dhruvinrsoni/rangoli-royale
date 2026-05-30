#!/usr/bin/env node
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import readline from 'node:readline';

const PBKDF2_ITER = 120000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = 'sha256';

function hashPin(pin) {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(pin, salt, PBKDF2_ITER, PBKDF2_KEYLEN, PBKDF2_DIGEST);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

function prompt(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    if (hidden) {
      const stdin = process.stdin;
      stdin.on('data', (ch) => {
        if (ch.toString() === '\r' || ch.toString() === '\n' || ch.toString() === '') return;
        process.stdout.write('*');
      });
    }
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

console.log('\nRangoli Royale — admin secret generator\n');
console.log('This will produce two env-var values for Vercel:');
console.log('  ADMIN_PIN_HASH      → PBKDF2-SHA256 hash of your PIN (safe to store)');
console.log('  ADMIN_COOKIE_SECRET → 32 bytes of randomness for HMAC-signed cookies\n');

const pin = await prompt('Enter your admin PIN (at least 12 chars recommended): ');
if (!pin || pin.length < 8) {
  console.error('\nPIN too short. Use 12+ characters.');
  process.exit(1);
}

const pinHash = hashPin(pin);
const cookieSecret = randomBytes(32).toString('hex');

console.log('\n--- Paste these into Vercel → Project Settings → Environment Variables ---\n');
console.log('ADMIN_PIN_HASH=' + pinHash);
console.log('ADMIN_COOKIE_SECRET=' + cookieSecret);
console.log('\nAfter saving, redeploy the project so the new env vars take effect.');
console.log('Then visit https://<your-app>/#admin and log in with the PIN you just entered.\n');
