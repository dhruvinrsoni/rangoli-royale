#!/usr/bin/env node
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import readline from 'node:readline';

const PBKDF2_ITER = 120000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = 'sha256';

function hashWithPrefix(pin, prefix) {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(prefix + pin, salt, PBKDF2_ITER, PBKDF2_KEYLEN, PBKDF2_DIGEST);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

function prompt(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

console.log('\nRangoli Royale — Sūtradhāra secrets generator\n');

console.log('This produces three env-var values for Vercel:');
console.log('  ADMIN_PIN_HASH      → PBKDF2-SHA256 hash of (BIJA + your PIN)');
console.log('  ADMIN_COOKIE_SECRET → 32 bytes of randomness for HMAC-signed cookies');
console.log('  BIJA                → secret prefix (Sanskrit: बीज, "seed") that is mixed into the hash on the server only');
console.log('\nIf BIJA leaks but ADMIN_PIN_HASH does not (or vice versa), the attacker still cannot derive your PIN.\n');

const prefix = (await prompt('BIJA — secret prefix (any string, kept server-only). Press Enter to skip: ')).trim();
const pin = await prompt('Your admin PIN (12+ chars recommended): ');

if (!pin || pin.length < 6) {
  console.error('\nPIN too short. Use 8+ characters.');
  process.exit(1);
}

const pinHash = hashWithPrefix(pin, prefix);
const cookieSecret = randomBytes(32).toString('hex');

console.log('\n--- Paste these into Vercel → Project Settings → Environment Variables ---\n');
console.log('ADMIN_PIN_HASH=' + pinHash);
console.log('ADMIN_COOKIE_SECRET=' + cookieSecret);
if (prefix) console.log('BIJA=' + prefix);
console.log('\nOptional: rotating PIN mode. Pick one if you want a daily/hourly-rotating suffix:');
console.log('  ADMIN_PIN_MODE=day   → append today\'s day-of-month (DD) when logging in    e.g.  myPin30');
console.log('  ADMIN_PIN_MODE=hour  → append today\'s day + IST hour (DDHH)               e.g.  myPin3014');
console.log('\nAfter saving env vars, redeploy and visit https://<your-app>/#sutradhara');
console.log('(or tap the home-screen title 7 times to navigate there)\n');
