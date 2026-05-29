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

// In-memory throttle for failed logins. Single server instance, so a module-level
// map is sufficient. Resets on deploy/restart, which is acceptable.
const LOCK_THRESHOLD = 5;
const LOCK_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
let failures: { count: number; firstAt: number } = { count: 0, firstAt: 0 };

export function isLockedOut(): boolean {
  if (failures.count < LOCK_THRESHOLD) return false;
  if (Date.now() - failures.firstAt > LOCK_WINDOW_MS) {
    failures = { count: 0, firstAt: 0 };
    return false;
  }
  return true;
}

export function recordFailedLogin(): void {
  const now = Date.now();
  if (now - failures.firstAt > LOCK_WINDOW_MS) {
    failures = { count: 1, firstAt: now };
  } else {
    failures.count += 1;
  }
}

export function recordSuccessfulLogin(): void {
  failures = { count: 0, firstAt: 0 };
}

// Guard for API endpoints: returns a 401 Response if not authenticated, else null.
export function requireAuth(request: Request): Response | null {
  if (isAuthenticated(request.headers.get('cookie'))) return null;
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}
