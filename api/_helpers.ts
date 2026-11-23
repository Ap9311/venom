/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { db, auth } from '../src/firebase.js';

export type SessionRole = 'admin' | 'assistant';

export interface VerifiedSessionPayload {
  sub: string;
  role: SessionRole;
  iat: number;
  exp: number;
  jti: string;
}

const ALLOWED_PRODUCTION_ORIGINS = new Set<string>([
  'https://nonum.online',
  'https://admin.nonum.online'
]);

const ALLOWED_DEV_ORIGINS = new Set<string>([
  'http://localhost:3000',
  'http://127.0.0.1:3000'
]);

const ADMIN_TOKEN_TTL_SECONDS = 4 * 60 * 60; // 4 hours
const ASSISTANT_TOKEN_TTL_SECONDS = 2 * 60 * 60; // 2 hours
const RATE_LIMIT_MAX_FAILURES = 5;
const RATE_LIMIT_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

// In-memory fallback stores (augmented by Firestore when bridge key is active)
const memoryRateLimits = new Map<string, { count: number; lockedUntil: number; updatedAt: number }>();
const memoryRegisteredDevices = new Set<string>();
const memoryRevokedDevices = new Set<string>();
const memoryCommunityPins = new Map<string, string>();
let memoryMaxAdmins = Math.max(1, parseInt(process.env.MAX_ADMIN_DEVICES || '3', 10) || 3);
let memoryAssistantCreds: {
  usernameDisplay: string;
  usernameHash: string;
  passwordHash: string;
  updatedAt: string;
} | null = null;

/**
 * Fail-closed secret getter. Never falls back to any hardcoded string.
 * Returns null if ADMIN_SECRET_KEY is not configured in the environment.
 */
export function getAdminSecretKey(): string | null {
  const raw = process.env.ADMIN_SECRET_KEY;
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length < 16) return null;
  return trimmed;
}

export function getIpHashSalt(): string | null {
  const explicit = process.env.IP_HASH_SALT?.trim();
  if (explicit && explicit.length >= 16) return explicit;
  const master = getAdminSecretKey();
  if (!master) return null;
  return crypto.createHmac('sha256', master).update('nonum_ip_hash_salt_v2').digest('hex');
}

export function getFirestoreBridgeKey(): string | null {
  const k = process.env.FIRESTORE_BRIDGE_KEY?.trim();
  return k && k.length >= 16 ? k : null;
}

export function getConfiguredAssistantPortalPath(): string | null {
  const raw = process.env.ASSISTANT_PORTAL_PATH?.trim();
  if (!raw) return null;
  const normalized = raw.startsWith('/') ? raw : `/${raw}`;
  return normalized.replace(/\/+$/, '');
}

export function hashIpForServer(ip: string): string {
  const cleanIp = String(ip || 'unknown').trim().toLowerCase();
  const salt = getIpHashSalt() || 'ephemeral_unconfigured_salt';
  return crypto.createHmac('sha256', salt).update(cleanIp).digest('hex');
}

export function isOwnerIp(ip: string): boolean {
  const rawList = process.env.OWNER_IP?.trim();
  if (!rawList || !ip) return false;
  const clean = ip.trim();
  return rawList
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .some((allowed) => safeStringEqual(allowed, clean));
}

export function sanitizeHeaderValue(val: string): string {
  return String(val || '').replace(/[\r\n\0]/g, '');
}

export function safeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(String(a), 'utf8');
  const bufB = Buffer.from(String(b), 'utf8');
  if (bufA.length !== bufB.length) {
    // Perform a dummy comparison to keep timing uniform
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Strip prototype pollution keys recursively from JSON bodies.
 */
export function sanitizePayload<T = any>(input: any, depth = 0): T {
  if (depth > 8 || input === null || typeof input !== 'object') return input;
  if (Array.isArray(input)) {
    return input.map((item) => sanitizePayload(item, depth + 1)) as unknown as T;
  }
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(input)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    clean[k] = sanitizePayload(v, depth + 1);
  }
  return clean as T;
}

export function getNormalizedOrigin(req: any): string {
  const origin = req?.headers?.origin;
  if (typeof origin !== 'string') return '';
  return sanitizeHeaderValue(origin.trim()).replace(/\/+$/, '');
}

export function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (ALLOWED_PRODUCTION_ORIGINS.has(origin)) return true;
  if (process.env.NODE_ENV !== 'production' && ALLOWED_DEV_ORIGINS.has(origin)) {
    return true;
  }
  return false;
}

/**
 * Strict CORS & security headers. Never uses wildcard '*' or broad domain matches.
 */
export function setCorsHeaders(res: any, req?: any) {
  const origin = getNormalizedOrigin(req);

  res.setHeader('Vary', 'Origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');

  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    // Default strict origin so non-allowed cross-origin callers are blocked by the browser
    res.setHeader('Access-Control-Allow-Origin', 'https://nonum.online');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Admin-Token, X-Admin-Device-Id'
  );
}

/**
 * Basic CSRF origin guard for state-changing requests.
 * Same-origin requests (no Origin header or allowed Origin / matching Host) pass;
 * cross-origin requests from untrusted origins are rejected.
 */
export function verifyCsrfOrigin(req: any): boolean {
  const origin = getNormalizedOrigin(req);
  if (!origin) return true; // Non-browser / same-origin navigation without Origin header
  if (isAllowedOrigin(origin)) return true;

  // Allow exact same-host origin (e.g. preview domain)
  const host = sanitizeHeaderValue(String(req?.headers?.host || '').trim());
  if (host) {
    if (origin === `https://${host}` || (process.env.NODE_ENV !== 'production' && origin === `http://${host}`)) {
      return true;
    }
  }
  return false;
}

export function getClientIp(req: any): string {
  const xff = req?.headers?.['x-forwarded-for'];
  let ip = '';
  if (typeof xff === 'string') {
    ip = xff.split(',')[0].trim();
  } else if (Array.isArray(xff) && xff.length > 0) {
    ip = String(xff[0]).trim();
  } else {
    ip = String(req?.socket?.remoteAddress || req?.connection?.remoteAddress || '127.0.0.1').trim();
  }
  if (ip === '::1' || ip === '::ffff:127.0.0.1') return '127.0.0.1';
  return ip.replace(/^::ffff:/, '');
}

export function parseCookies(req: any): Record<string, string> {
  const list: Record<string, string> = {};
  const rc = req?.headers?.cookie;
  if (typeof rc === 'string' && rc.length > 0 && rc.length < 8192) {
    rc.split(';').forEach((cookie: string) => {
      const idx = cookie.indexOf('=');
      if (idx === -1) return;
      const key = cookie.slice(0, idx).trim();
      const rawVal = cookie.slice(idx + 1).trim();
      if (key) {
        try {
          list[key] = decodeURIComponent(rawVal);
        } catch {
          list[key] = rawVal;
        }
      }
    });
  }
  return list;
}

export function setAdminSessionCookies(res: any, adminDeviceId: string, token: string) {
  const isProd = process.env.NODE_ENV === 'production';
  const secureFlag = isProd ? '; Secure' : '';
  const cookies = [
    `nonum_admin_session=${encodeURIComponent(sanitizeHeaderValue(token))}; Path=/; Max-Age=${ADMIN_TOKEN_TTL_SECONDS}; HttpOnly; SameSite=Strict${secureFlag}`,
    `nonum_admin_device_id=${encodeURIComponent(sanitizeHeaderValue(adminDeviceId))}; Path=/; Max-Age=${365 * 24 * 60 * 60}; HttpOnly; SameSite=Strict${secureFlag}`
  ];
  res.setHeader('Set-Cookie', cookies);
}

export function clearAdminCookies(res: any) {
  const isProd = process.env.NODE_ENV === 'production';
  const secureFlag = isProd ? '; Secure' : '';
  res.setHeader('Set-Cookie', [
    `nonum_admin_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${secureFlag}`,
    `nonum_admin_device_id=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${secureFlag}`,
    `nonum_admin_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${secureFlag}`
  ]);
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(input: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(input)) return null;
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
  try {
    return Buffer.from(b64, 'base64');
  } catch {
    return null;
  }
}

/**
 * Signs a short-lived HMAC-SHA256 JWT tied to a specific subject and role.
 * Fails closed (returns null) if ADMIN_SECRET_KEY is not configured.
 */
export function signSessionToken(
  sub: string,
  role: SessionRole,
  ttlSeconds?: number
): { token: string; expiresAt: number } | null {
  const secret = getAdminSecretKey();
  if (!secret) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  const ttl =
    ttlSeconds || (role === 'admin' ? ADMIN_TOKEN_TTL_SECONDS : ASSISTANT_TOKEN_TTL_SECONDS);
  const exp = nowSec + ttl;

  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      sub,
      role,
      iat: nowSec,
      exp,
      jti: crypto.randomBytes(12).toString('hex')
    })
  );

  const signingInput = `${header}.${payload}`;
  const sig = base64UrlEncode(crypto.createHmac('sha256', secret).update(signingInput).digest());

  return {
    token: `${signingInput}.${sig}`,
    expiresAt: exp * 1000
  };
}

/**
 * Verifies an HMAC-SHA256 JWT signature, structure, role, and expiration.
 * Rejects expired, malformed, or tampered tokens.
 */
export function verifySessionToken(token: unknown): VerifiedSessionPayload | null {
  const secret = getAdminSecretKey();
  if (!secret) return null;
  if (typeof token !== 'string') return null;

  const trimmed = token.trim();
  if (!trimmed || trimmed.length > 2048) return null;

  const parts = trimmed.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, sigB64] = parts;
  const signingInput = `${headerB64}.${payloadB64}`;
  const expectedSig = base64UrlEncode(
    crypto.createHmac('sha256', secret).update(signingInput).digest()
  );

  if (!safeStringEqual(sigB64, expectedSig)) return null;

  const headerBuf = base64UrlDecode(headerB64);
  const payloadBuf = base64UrlDecode(payloadB64);
  if (!headerBuf || !payloadBuf) return null;

  try {
    const header = JSON.parse(headerBuf.toString('utf8'));
    if (header?.alg !== 'HS256' || header?.typ !== 'JWT') return null;

    const payload = JSON.parse(payloadBuf.toString('utf8'));
    if (
      !payload ||
      typeof payload.sub !== 'string' ||
      !payload.sub ||
      (payload.role !== 'admin' && payload.role !== 'assistant') ||
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number' ||
      typeof payload.jti !== 'string'
    ) {
      return null;
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp <= nowSec) return null;
    if (payload.iat > nowSec + 60) return null; // Reject tokens issued in the future

    return payload as VerifiedSessionPayload;
  } catch {
    return null;
  }
}

export function extractTokenFromRequest(req: any): string {
  const authHeader = req?.headers?.authorization;
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  const xToken = req?.headers?.['x-admin-token'];
  if (typeof xToken === 'string' && xToken.trim()) {
    return xToken.trim();
  }
  const cookies = parseCookies(req);
  if (cookies['nonum_admin_session']) {
    return cookies['nonum_admin_session'];
  }
  return '';
}

/**
 * Generates a cryptographically secure scrypt hash string: scrypt$<saltHex>$<hashHex>
 */
export function hashSecretScrypt(plaintext: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plaintext, salt, 32).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

/**
 * Verifies a candidate secret against either a scrypt$salt$hash string or a raw env value.
 */
export function verifySecretAgainstHashOrPlain(
  candidate: string,
  storedHash?: string,
  storedPlain?: string
): boolean {
  if (!candidate) return false;

  if (storedHash && typeof storedHash === 'string' && storedHash.startsWith('scrypt$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 3) return false;
    const [, salt, expectedHex] = parts;
    if (!salt || !/^[0-9a-fA-F]{64}$/.test(expectedHex)) return false;
    const derived = crypto.scryptSync(candidate, salt, 32);
    const expectedBuf = Buffer.from(expectedHex, 'hex');
    return derived.length === expectedBuf.length && crypto.timingSafeEqual(derived, expectedBuf);
  }

  if (storedPlain && typeof storedPlain === 'string' && storedPlain.length > 0) {
    // Hash both with an ephemeral salt so timingSafeEqual compares fixed-length buffers
    const ephemSalt = crypto.randomBytes(16);
    const a = crypto.scryptSync(candidate, ephemSalt, 32);
    const b = crypto.scryptSync(storedPlain, ephemSalt, 32);
    return crypto.timingSafeEqual(a, b);
  }

  return false;
}

/**
 * Verifies primary administrator credentials strictly from environment variables.
 * Never uses hardcoded default credentials or leaked repo hashes.
 */
export function verifyAdminCredentials(user: unknown, pass: unknown): {
  configured: boolean;
  valid: boolean;
} {
  const envUser = process.env.ADMIN_USERNAME?.trim();
  const envPassHash = process.env.ADMIN_PASSWORD_HASH?.trim();
  const envPassPlain = process.env.ADMIN_PASSWORD?.trim();

  if (!envUser || (!envPassHash && !envPassPlain)) {
    return { configured: false, valid: false };
  }

  if (typeof user !== 'string' || typeof pass !== 'string') {
    return { configured: true, valid: false };
  }

  const cleanUser = user.trim().toLowerCase();
  const cleanPass = pass.trim();
  if (!cleanUser || !cleanPass) {
    return { configured: true, valid: false };
  }

  const userMatches = safeStringEqual(cleanUser, envUser.toLowerCase());
  const passMatches = verifySecretAgainstHashOrPlain(cleanPass, envPassHash, envPassPlain);

  return { configured: true, valid: userMatches && passMatches };
}

/**
 * Ensures the server's anonymous Firebase Auth session has a bridge-validated admin claim
 * ONLY when FIRESTORE_BRIDGE_KEY is configured in the server environment.
 */
export async function ensureServerFirestoreAuth(): Promise<boolean> {
  if (!db || !auth) return false;
  const bridgeKey = getFirestoreBridgeKey();
  if (!bridgeKey) return false;

  try {
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }
    if (!auth.currentUser) return false;

    const nowMs = Date.now();
    await setDoc(
      doc(db, 'admins', auth.currentUser.uid),
      {
        isAdmin: true,
        role: 'admin',
        serverAuthKey: bridgeKey,
        expiresAt: nowMs + 60 * 60 * 1000,
        updatedAt: new Date(nowMs).toISOString()
      },
      { merge: true }
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Grants a short-lived Firestore role document for a verified client Firebase UID.
 * Runs exclusively on the server using the private FIRESTORE_BRIDGE_KEY.
 */
export async function syncClientFirestoreClaim(
  clientUid: string,
  role: SessionRole,
  expiresAtMs: number
): Promise<boolean> {
  if (!db || !auth || !clientUid || typeof clientUid !== 'string') return false;
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(clientUid)) return false;

  const bridgeKey = getFirestoreBridgeKey();
  if (!bridgeKey) return false;

  try {
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }
    await setDoc(
      doc(db, 'admins', clientUid),
      {
        isAdmin: role === 'admin',
        role,
        serverAuthKey: bridgeKey,
        expiresAt: expiresAtMs,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );
    return true;
  } catch {
    return false;
  }
}

export async function revokeClientFirestoreClaim(clientUid: string): Promise<void> {
  if (!db || !clientUid || !/^[a-zA-Z0-9_-]{8,128}$/.test(clientUid)) return;
  try {
    const authed = await ensureServerFirestoreAuth();
    if (!authed) return;
    await deleteDoc(doc(db, 'admins', clientUid));
  } catch {
    // ignore
  }
}

/**
 * Persistent + in-memory per-IP rate limiting (5 failed attempts -> 15 min lockout).
 * Keyed strictly by salted HMAC-SHA256 IP hash (never stores raw IP).
 */
export async function checkRateLimit(
  req: any,
  scope = 'auth'
): Promise<{ limited: boolean; retryAfterSec: number }> {
  const ip = getClientIp(req);
  const key = `${scope}_${hashIpForServer(ip)}`;
  const now = Date.now();

  const memRec = memoryRateLimits.get(key);
  if (memRec) {
    if (now < memRec.lockedUntil) {
      return {
        limited: true,
        retryAfterSec: Math.max(1, Math.ceil((memRec.lockedUntil - now) / 1000))
      };
    }
    if (memRec.lockedUntil > 0 && now >= memRec.lockedUntil) {
      memoryRateLimits.delete(key);
    }
  }

  // Check Firestore-backed rate limit record for cross-instance persistence on Vercel
  if (db) {
    try {
      const authed = await ensureServerFirestoreAuth();
      if (authed) {
        const snap = await getDoc(doc(db, 'rate_limits', key));
        if (snap.exists()) {
          const data = snap.data() as any;
          const lockedUntil = Number(data?.lockedUntil || 0);
          if (now < lockedUntil) {
            memoryRateLimits.set(key, {
              count: Number(data?.count || RATE_LIMIT_MAX_FAILURES),
              lockedUntil,
              updatedAt: now
            });
            return {
              limited: true,
              retryAfterSec: Math.max(1, Math.ceil((lockedUntil - now) / 1000))
            };
          }
        }
      }
    } catch {
      // Fall back to in-memory limiter silently
    }
  }

  return { limited: false, retryAfterSec: 0 };
}

export async function recordRateLimitFailure(req: any, scope = 'auth'): Promise<void> {
  const ip = getClientIp(req);
  const key = `${scope}_${hashIpForServer(ip)}`;
  const now = Date.now();

  let count = 0;
  let lockedUntil = 0;

  const memRec = memoryRateLimits.get(key);
  if (memRec && now - memRec.updatedAt < RATE_LIMIT_LOCKOUT_MS) {
    count = memRec.count;
    lockedUntil = memRec.lockedUntil;
  }

  if (db) {
    try {
      const authed = await ensureServerFirestoreAuth();
      if (authed) {
        const snap = await getDoc(doc(db, 'rate_limits', key));
        if (snap.exists()) {
          const data = snap.data() as any;
          if (now - Number(data?.updatedAt || 0) < RATE_LIMIT_LOCKOUT_MS) {
            count = Math.max(count, Number(data?.count || 0));
          }
        }
      }
    } catch {
      // ignore
    }
  }

  count += 1;
  if (count >= RATE_LIMIT_MAX_FAILURES) {
    lockedUntil = now + RATE_LIMIT_LOCKOUT_MS;
  }

  const nextRec = { count, lockedUntil, updatedAt: now };
  memoryRateLimits.set(key, nextRec);

  if (db) {
    try {
      const authed = await ensureServerFirestoreAuth();
      if (authed) {
        await setDoc(doc(db, 'rate_limits', key), nextRec, { merge: true });
      }
    } catch {
      // ignore
    }
  }
}

export async function clearRateLimit(req: any, scope = 'auth'): Promise<void> {
  const ip = getClientIp(req);
  const key = `${scope}_${hashIpForServer(ip)}`;
  memoryRateLimits.delete(key);

  if (db) {
    try {
      const authed = await ensureServerFirestoreAuth();
      if (authed) {
        await deleteDoc(doc(db, 'rate_limits', key));
      }
    } catch {
      // ignore
    }
  }
}

/**
 * Generates a cryptographically random server-issued admin device identifier.
 */
export function generateServerAdminDeviceId(): string {
  return `ADM-${crypto.randomBytes(16).toString('hex').toUpperCase()}`;
}

export function isValidAdminDeviceIdFormat(id: unknown): id is string {
  if (typeof id !== 'string') return false;
  return /^[A-Za-z0-9_-]{12,80}$/.test(id.trim());
}

/**
 * Checks whether an adminDeviceId is actively registered in Firestore admin_devices
 * (or server memory if Firestore bridge is not yet configured).
 */
export async function isRegisteredActiveAdminDevice(adminDeviceId: string): Promise<boolean> {
  if (!isValidAdminDeviceIdFormat(adminDeviceId)) return false;
  const cleanId = adminDeviceId.trim();

  if (memoryRevokedDevices.has(cleanId)) return false;

  if (db) {
    try {
      const authed = await ensureServerFirestoreAuth();
      if (authed) {
        const snap = await getDoc(doc(db, 'admin_devices', cleanId));
        if (snap.exists()) {
          const isActive = snap.data()?.status === 'active';
          if (isActive) {
            memoryRegisteredDevices.add(cleanId);
          } else {
            memoryRegisteredDevices.delete(cleanId);
            memoryRevokedDevices.add(cleanId);
          }
          return isActive;
        }
        // Not found in authoritative Firestore registry
        memoryRegisteredDevices.delete(cleanId);
        return false;
      }
    } catch {
      // Fall back to in-memory registry below
    }
  }

  return memoryRegisteredDevices.has(cleanId);
}

export async function getAdminDeviceLimitAndList(): Promise<{
  maxAdmins: number;
  devices: any[];
}> {
  if (db) {
    try {
      const authed = await ensureServerFirestoreAuth();
      if (authed) {
        let maxAdmins = memoryMaxAdmins;
        const cfgSnap = await getDoc(doc(db, 'admin_config', 'global'));
        if (cfgSnap.exists()) {
          const val = Number(cfgSnap.data()?.maxAdmins);
          if (Number.isInteger(val) && val > 0 && val <= 50) {
            maxAdmins = val;
            memoryMaxAdmins = val;
          }
        }
        const q = query(collection(db, 'admin_devices'), where('status', '==', 'active'));
        const snap = await getDocs(q);
        const devices = snap.docs.map((d) => ({
          adminDeviceId: d.id,
          ...d.data()
        }));
        devices.sort(
          (a: any, b: any) =>
            new Date(a.registeredAt || 0).getTime() - new Date(b.registeredAt || 0).getTime()
        );
        return { maxAdmins, devices };
      }
    } catch {
      // fallback
    }
  }

  return {
    maxAdmins: memoryMaxAdmins,
    devices: Array.from(memoryRegisteredDevices).map((id, i) => ({
      adminDeviceId: id,
      label: `Admin Device #${i + 1}`,
      status: 'active',
      registeredAt: new Date().toISOString()
    }))
  };
}

export async function registerActiveAdminDevice(
  adminDeviceId: string,
  meta: { label?: string; os?: string } = {}
): Promise<{ success: boolean; error?: string }> {
  const { maxAdmins, devices } = await getAdminDeviceLimitAndList();
  const alreadyExists = devices.some((d) => d.adminDeviceId === adminDeviceId);
  if (!alreadyExists && devices.length >= maxAdmins) {
    return {
      success: false,
      error: `Maximum authorized admin device limit (${maxAdmins}) reached.`
    };
  }

  memoryRevokedDevices.delete(adminDeviceId);
  memoryRegisteredDevices.add(adminDeviceId);

  if (db) {
    try {
      const authed = await ensureServerFirestoreAuth();
      if (authed) {
        await setDoc(
          doc(db, 'admin_devices', adminDeviceId),
          {
            adminDeviceId,
            label: meta.label || `Admin Device #${devices.length + 1}`,
            os: meta.os || 'Unknown OS',
            status: 'active',
            registeredAt: new Date().toISOString()
          },
          { merge: true }
        );
      }
    } catch {
      // memory fallback remains active
    }
  }

  return { success: true };
}

export async function revokeRegisteredAdminDevice(adminDeviceId: string): Promise<boolean> {
  if (!isValidAdminDeviceIdFormat(adminDeviceId)) return false;
  const cleanId = adminDeviceId.trim();
  memoryRegisteredDevices.delete(cleanId);
  memoryRevokedDevices.add(cleanId);

  if (db) {
    try {
      const authed = await ensureServerFirestoreAuth();
      if (authed) {
        await setDoc(
          doc(db, 'admin_devices', cleanId),
          {
            status: 'revoked',
            revokedAt: new Date().toISOString()
          },
          { merge: true }
        );
      }
    } catch {
      // ignore
    }
  }
  return true;
}

export async function updateServerAdminLimit(maxAdmins: number): Promise<boolean> {
  if (!Number.isInteger(maxAdmins) || maxAdmins < 1 || maxAdmins > 50) return false;
  memoryMaxAdmins = maxAdmins;

  if (db) {
    try {
      const authed = await ensureServerFirestoreAuth();
      if (authed) {
        await setDoc(
          doc(db, 'admin_config', 'global'),
          {
            maxAdmins,
            updatedAt: new Date().toISOString()
          },
          { merge: true }
        );
      }
    } catch {
      // ignore
    }
  }
  return true;
}

/**
 * Verifies an incoming request as a full administrator (role === 'admin')
 * AND checks that the tied adminDeviceId is still active.
 */
export async function requireFullAdmin(
  req: any
): Promise<{ ok: boolean; status: number; error?: string; session?: VerifiedSessionPayload }> {
  if (!getAdminSecretKey()) {
    return { ok: false, status: 500, error: 'Server authentication is not configured.' };
  }
  const token = extractTokenFromRequest(req);
  const payload = verifySessionToken(token);
  if (!payload || payload.role !== 'admin') {
    return { ok: false, status: 401, error: 'Administrator authentication required.' };
  }
  const active = await isRegisteredActiveAdminDevice(payload.sub);
  if (!active) {
    return { ok: false, status: 403, error: 'Admin device clearance is inactive or revoked.' };
  }
  return { ok: true, status: 200, session: payload };
}

/**
 * Assistant credential verification & storage (strictly server-side).
 */
export async function fetchStoredAssistantCredentials(): Promise<{
  usernameDisplay: string;
  usernameHash: string;
  passwordHash: string;
  updatedAt?: string;
} | null> {
  if (db) {
    try {
      const authed = await ensureServerFirestoreAuth();
      if (authed) {
        const snap = await getDoc(doc(db, 'admin_config', 'assistant_credentials'));
        if (snap.exists()) {
          const data = snap.data() as any;
          if (data?.usernameHash && data?.passwordHash) {
            return {
              usernameDisplay: String(data.usernameDisplay || 'assistant'),
              usernameHash: String(data.usernameHash),
              passwordHash: String(data.passwordHash),
              updatedAt: data.updatedAt ? String(data.updatedAt) : undefined
            };
          }
        }
      }
    } catch {
      // fall back to memory
    }
  }
  return memoryAssistantCreds;
}

export async function verifyAssistantCredentialsServer(
  user: unknown,
  pass: unknown
): Promise<{ configured: boolean; valid: boolean }> {
  if (typeof user !== 'string' || typeof pass !== 'string') {
    return { configured: true, valid: false };
  }
  const cleanUser = user.trim().toLowerCase();
  const cleanPass = pass.trim();
  if (!cleanUser || !cleanPass) {
    return { configured: true, valid: false };
  }

  const stored = await fetchStoredAssistantCredentials();
  if (stored) {
    const userOk = verifySecretAgainstHashOrPlain(cleanUser, stored.usernameHash);
    const passOk = verifySecretAgainstHashOrPlain(cleanPass, stored.passwordHash);
    return { configured: true, valid: userOk && passOk };
  }

  const envUser = process.env.ASSISTANT_USERNAME?.trim();
  const envPassHash = process.env.ASSISTANT_PASSWORD_HASH?.trim();
  const envPassPlain = process.env.ASSISTANT_PASSWORD?.trim();

  if (!envUser || (!envPassHash && !envPassPlain)) {
    return { configured: false, valid: false };
  }

  const userOk = safeStringEqual(cleanUser, envUser.toLowerCase());
  const passOk = verifySecretAgainstHashOrPlain(cleanPass, envPassHash, envPassPlain);
  return { configured: true, valid: userOk && passOk };
}

export async function saveAssistantCredentialsServer(
  newUsername: string,
  newPassword: string
): Promise<{ usernameDisplay: string; updatedAt: string }> {
  const cleanUser = newUsername.trim();
  const cleanPass = newPassword.trim();
  const updatedAt = new Date().toISOString();

  const record = {
    usernameDisplay: cleanUser,
    usernameHash: hashSecretScrypt(cleanUser.toLowerCase()),
    passwordHash: hashSecretScrypt(cleanPass),
    updatedAt
  };

  memoryAssistantCreds = record;

  if (db) {
    try {
      const authed = await ensureServerFirestoreAuth();
      if (authed) {
        await setDoc(doc(db, 'admin_config', 'assistant_credentials'), record, { merge: true });
      }
    } catch {
      // memory fallback active
    }
  }

  return { usernameDisplay: cleanUser, updatedAt };
}

export async function resetAssistantCredentialsServer(): Promise<void> {
  memoryAssistantCreds = null;
  if (db) {
    try {
      const authed = await ensureServerFirestoreAuth();
      if (authed) {
        await deleteDoc(doc(db, 'admin_config', 'assistant_credentials'));
      }
    } catch {
      // ignore
    }
  }
}

/**
 * Server-side Community PIN storage & verification (scrypt hashes stored ONLY server-side).
 */
export async function setCommunityPinServer(
  communityId: string,
  pin: string | null,
  ownerUid?: string
): Promise<boolean> {
  if (!communityId || !/^[A-Za-z0-9_-]{3,128}$/.test(communityId)) return false;

  if (!pin) {
    memoryCommunityPins.delete(communityId);
    if (db) {
      try {
        const authed = await ensureServerFirestoreAuth();
        if (authed) {
          await deleteDoc(doc(db, 'community_secrets', communityId));
        }
      } catch {
        // ignore
      }
    }
    return true;
  }

  const pinHash = hashSecretScrypt(pin.trim());
  memoryCommunityPins.set(communityId, pinHash);

  if (db) {
    try {
      const authed = await ensureServerFirestoreAuth();
      if (authed) {
        await setDoc(
          doc(db, 'community_secrets', communityId),
          {
            pinHash,
            ownerUid: ownerUid || null,
            updatedAt: new Date().toISOString()
          },
          { merge: true }
        );
      }
    } catch {
      // memory fallback active
    }
  }

  return true;
}

export async function verifyCommunityPinServer(
  communityId: string,
  candidatePin: string
): Promise<{ valid: boolean; hasPin: boolean }> {
  if (!communityId || !/^[A-Za-z0-9_-]{3,128}$/.test(communityId)) {
    return { valid: false, hasPin: false };
  }

  let storedHash = memoryCommunityPins.get(communityId) || '';

  if (db) {
    try {
      const authed = await ensureServerFirestoreAuth();
      if (authed) {
        const snap = await getDoc(doc(db, 'community_secrets', communityId));
        if (snap.exists()) {
          const data = snap.data() as any;
          if (typeof data?.pinHash === 'string' && data.pinHash) {
            storedHash = data.pinHash;
            memoryCommunityPins.set(communityId, storedHash);
          }
        }
      }
    } catch {
      // fallback to memory
    }
  }

  if (!storedHash) {
    return { valid: false, hasPin: false };
  }

  const valid = verifySecretAgainstHashOrPlain(candidatePin.trim(), storedHash);
  return { valid, hasPin: true };
}
