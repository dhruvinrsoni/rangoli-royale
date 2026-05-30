#!/usr/bin/env node
import { pbkdf2Sync } from 'node:crypto';
import readline from 'node:readline';

const PBKDF2_ITER = 120000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = 'sha256';
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function prompt(q) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, (a) => { rl.close(); resolve(a); });
  });
}

function istDate(off = 0) {
  return new Date(Date.now() + IST_OFFSET_MS + off);
}
function dd(d) { return String(d.getUTCDate()).padStart(2, '0'); }
function hh(d) { return String(d.getUTCHours()).padStart(2, '0'); }

console.log('\n=== Sūtradhāra PIN self-test ===\n');
console.log('Server clock (UTC):  ', new Date().toISOString());
const now = istDate();
const prev = istDate(-60 * 60 * 1000);
console.log('Server clock (IST):  ', now.toISOString().replace('Z', '+0530'));
console.log('Today IST date:      ', dd(now), '(suffix for day mode)');
console.log('IST hour now:        ', hh(now));
console.log('Valid hour suffixes: ', dd(now) + hh(now), 'OR', dd(prev) + hh(prev), '(prev-hour slop)');
console.log('Valid day suffix:    ', dd(now));
console.log('');

const mode = ((await prompt('Mode you set in Vercel (static / day / hour): ')).trim().toLowerCase()) || 'static';
const prefix = (await prompt('BEEJA prefix (Enter for none): ')).trim();
const fullPin = (await prompt('Full PIN as you would type at login: ')).trim();
const storedHash = (await prompt('Paste your ADMIN_PIN_HASH from Vercel: ')).trim();

console.log('\n--- Step 1: suffix check ---');
let expectedSuffixes = [''];
if (mode === 'day') expectedSuffixes = [dd(now)];
else if (mode === 'hour' || mode === 'hourly') expectedSuffixes = [dd(now) + hh(now), dd(prev) + hh(prev)];

const suffixLen = expectedSuffixes[0].length;
const submittedSuffix = suffixLen > 0 ? fullPin.slice(-suffixLen) : '';
const corePin = suffixLen > 0 ? fullPin.slice(0, -suffixLen) : fullPin;

console.log('  Expected suffixes:', JSON.stringify(expectedSuffixes));
console.log('  You typed suffix: ', JSON.stringify(submittedSuffix));
const suffixOk = expectedSuffixes.includes(submittedSuffix);
console.log('  Suffix matches:   ', suffixOk ? 'YES' : 'NO — your suffix does not match the IST clock');

console.log('\n--- Step 2: core PIN ---');
console.log('  Core PIN (after stripping suffix):', JSON.stringify(corePin));
console.log('  Length:', corePin.length);

console.log('\n--- Step 3: hash check ---');
if (!storedHash || !storedHash.includes(':')) {
  console.log('  Hash missing or malformed. Should look like "<hex>:<hex>".');
  process.exit(1);
}
const [saltHex, hashHex] = storedHash.split(':');
let hashOk = false;
try {
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = pbkdf2Sync(prefix + corePin, salt, PBKDF2_ITER, PBKDF2_KEYLEN, PBKDF2_DIGEST);
  hashOk = expected.length === actual.length && expected.equals(actual);
} catch (e) {
  console.log('  Hash decode error:', e.message);
}
console.log('  Hash matches:', hashOk ? 'YES' : 'NO');

console.log('\n=== Verdict ===');
if (suffixOk && hashOk) {
  console.log('PASS — this PIN should let you in right now.');
} else {
  console.log('FAIL.');
  if (!suffixOk) console.log('  - Suffix wrong. Re-check the IST clock vs what you typed.');
  if (!hashOk) console.log('  - Core PIN does not hash to the stored value. Either you mistyped the PIN, the BEEJA prefix differs, or the hash was generated for a different PIN/prefix combo.');
}
console.log('');
