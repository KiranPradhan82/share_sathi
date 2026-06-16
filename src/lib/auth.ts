// Simple, secure auth system using Node.js crypto (scrypt) + HTTP-only cookies
// No external auth library needed — perfect for single-user dashboard

import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { db } from './db';

const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = 16384; // N
const SCRYPT_BLOCK_SIZE = 8; // r
const SCRYPT_PARALLELIZATION = 1; // p

// Hash a password using scrypt
export async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString('hex');
    scrypt(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_COST, r: SCRYPT_BLOCK_SIZE, p: SCRYPT_PARALLELIZATION }, (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

// Verify a password against a stored hash
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) {
      resolve(false);
      return;
    }
    scrypt(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_COST, r: SCRYPT_BLOCK_SIZE, p: SCRYPT_PARALLELIZATION }, (err, derivedKey) => {
      if (err) reject(err);
      const derivedHex = derivedKey.toString('hex');
      try {
        resolve(timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derivedHex, 'hex')));
      } catch {
        resolve(false);
      }
    });
  });
}

// Generate a random session token
export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

// Session expiry: 7 days
const SESSION_MAX_AGE = 7 * 24 * 60 * 60;

// Cookie options for the session token
export const SESSION_COOKIE = {
  name: 'sharesathi_session',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: SESSION_MAX_AGE,
  path: '/',
};

// Validate a session token (checks SystemConfig for stored token)
export async function validateSession(token: string): Promise<boolean> {
  if (!token || token.length < 16) return false;
  try {
    const config = await db.systemConfig.findUnique({ where: { key: 'auth_session_token' } });
    if (!config || !config.value) return false;
    // Simple comparison — token is already a random 64-char hex string
    return config.value === token;
  } catch {
    return false;
  }
}

// Create a new session (stores token in DB, returns token + cookie header string)
export async function createSession(): Promise<{ token: string; setCookieHeader: string }> {
  const token = generateSessionToken();
  await db.systemConfig.upsert({
    where: { key: 'auth_session_token' },
    update: { value: token },
    create: { key: 'auth_session_token', value: token },
  });
  return {
    token,
    setCookieHeader: `${SESSION_COOKIE.name}=${token}; HttpOnly; ${SESSION_COOKIE.secure ? 'Secure; ' : ''}SameSite=Lax; Max-Age=${SESSION_MAX_AGE}; Path=/`,
  };
}

// Destroy a session
export async function destroySession(): Promise<{ clearCookieHeader: string }> {
  try {
    await db.systemConfig.delete({ where: { key: 'auth_session_token' } }).catch(() => {});
  } catch { /* ignore */ }
  return {
    clearCookieHeader: `${SESSION_COOKIE.name}=; HttpOnly; ${SESSION_COOKIE.secure ? 'Secure; ' : ''}SameSite=Lax; Max-Age=0; Path=/`,
  };
}

// Check if any user exists in the database
export async function hasAnyUser(): Promise<boolean> {
  try {
    const count = await db.user.count();
    return count > 0;
  } catch {
    return false;
  }
}