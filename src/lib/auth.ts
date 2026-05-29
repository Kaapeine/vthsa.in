import crypto from 'node:crypto';
import { config } from './config';

const COOKIE_NAME = 'admin_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

// Token payload is just an expiry timestamp; the HMAC proves authenticity.
function sign(payload: string): string {
  const hmac = crypto
    .createHmac('sha256', config.sessionSecret())
    .update(payload)
    .digest('hex');
  return `${payload}.${hmac}`;
}

function verify(token: string): boolean {
  const dot = token.lastIndexOf('.');
  if (dot === -1) return false;
  const payload = token.slice(0, dot);
  const expected = sign(payload);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  if (!crypto.timingSafeEqual(a, b)) return false;
  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && Date.now() < expiresAt;
}

export function createSessionCookie(): string {
  const expiresAt = Date.now() + MAX_AGE_SECONDS * 1000;
  const token = sign(String(expiresAt));
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${MAX_AGE_SECONDS}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

export function isAuthenticated(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false;
  const match = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return false;
  const token = match.slice(COOKIE_NAME.length + 1);
  return verify(token);
}

export function checkPassword(submitted: string): boolean {
  const expected = config.adminPassword();
  const a = Buffer.from(submitted);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
