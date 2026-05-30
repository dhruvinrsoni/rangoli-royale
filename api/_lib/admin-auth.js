import { createHmac, timingSafeEqual, pbkdf2Sync, randomBytes } from 'node:crypto';

const COOKIE_NAME = 'rr_admin';
export const COOKIE_MAX_AGE_SEC = 14400;
const PBKDF2_ITER = 120000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = 'sha256';

export function hashPin(pin, prefix = '') {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(prefix + pin, salt, PBKDF2_ITER, PBKDF2_KEYLEN, PBKDF2_DIGEST);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPin(pin, stored, prefix = '') {
  if (!stored || typeof stored !== 'string') return false;
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  let salt, expected;
  try {
    salt = Buffer.from(saltHex, 'hex');
    expected = Buffer.from(hashHex, 'hex');
  } catch { return false; }
  const actual = pbkdf2Sync(prefix + pin, salt, PBKDF2_ITER, PBKDF2_KEYLEN, PBKDF2_DIGEST);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

function sign(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function issueCookieValue(secret) {
  const expiry = Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE_SEC;
  const payload = String(expiry);
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyCookieValue(value, secret) {
  if (!value || typeof value !== 'string') return null;
  const dot = value.indexOf('.');
  if (dot < 0) return null;
  const payload = value.slice(0, dot);
  const signature = value.slice(dot + 1);
  const expected = sign(payload, secret);
  if (signature.length !== expected.length) return null;
  let a, b;
  try {
    a = Buffer.from(signature);
    b = Buffer.from(expected);
  } catch { return null; }
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const expiry = parseInt(payload, 10);
  if (!Number.isFinite(expiry)) return null;
  if (expiry < Math.floor(Date.now() / 1000)) return null;
  return { expiry };
}

export function cookieHeader(value) {
  if (value === null) {
    return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
  }
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${COOKIE_MAX_AGE_SEC}`;
}

export function readCookie(req, name = COOKIE_NAME) {
  const raw = req.headers?.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

export function requireAdmin(req) {
  const secret = process.env.ADMIN_COOKIE_SECRET;
  if (!secret) throw new AdminError('NO_CONFIG', 'Admin not configured');
  const value = readCookie(req);
  const verified = verifyCookieValue(value, secret);
  if (!verified) throw new AdminError('UNAUTHORIZED', 'Not authenticated');
  return verified;
}

export class AdminError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function getClientIp(req) {
  const fwd = req.headers?.['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}
