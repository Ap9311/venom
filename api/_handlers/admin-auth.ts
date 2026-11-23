/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  setCorsHeaders,
  verifyCsrfOrigin,
  getAdminSecretKey,
  verifyAdminCredentials,
  checkRateLimit,
  recordRateLimitFailure,
  clearRateLimit,
  parseCookies,
  isValidAdminDeviceIdFormat,
  isRegisteredActiveAdminDevice,
  generateServerAdminDeviceId,
  registerActiveAdminDevice,
  signSessionToken,
  setAdminSessionCookies,
  syncClientFirestoreClaim,
  sanitizePayload
} from '../_helpers.js';

/**
 * POST /api/admin-auth
 * Authenticates an administrator with server-side env credentials, enforces per-IP
 * rate limiting (5 failures -> 15 min lockout), registers/verifies an admin device ID,
 * and issues a short-lived signed admin JWT + HttpOnly cookies.
 */
export default async function handler(req: any, res: any) {
  setCorsHeaders(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }
  if (!verifyCsrfOrigin(req)) {
    return res.status(403).json({ success: false, error: 'Origin not allowed.' });
  }
  if (!getAdminSecretKey()) {
    return res.status(500).json({ success: false, error: 'Server authentication is not configured.' });
  }

  const rl = await checkRateLimit(req, 'admin_auth');
  if (rl.limited) {
    res.setHeader('Retry-After', String(rl.retryAfterSec));
    return res.status(429).json({
      success: false,
      error: 'Too many failed login attempts. Please try again in 15 minutes.'
    });
  }

  const body = sanitizePayload(req.body || {});
  const { username, password, firebaseUid, label, os } = body;

  const check = verifyAdminCredentials(username, password);
  if (!check.configured) {
    return res.status(503).json({
      success: false,
      error: 'Administrator credentials are not configured on the server.'
    });
  }

  if (!check.valid) {
    await recordRateLimitFailure(req, 'admin_auth');
    return res.status(401).json({
      success: false,
      error: 'Invalid Administrator credentials.'
    });
  }

  await clearRateLimit(req, 'admin_auth');

  // Reuse an already-registered device ID from HttpOnly cookie if active, else issue a server CSPRNG ID
  const cookies = parseCookies(req);
  const existingCookieId = cookies['nonum_admin_device_id'];
  let deviceId = '';

  if (existingCookieId && isValidAdminDeviceIdFormat(existingCookieId)) {
    const isActive = await isRegisteredActiveAdminDevice(existingCookieId);
    if (isActive) {
      deviceId = existingCookieId;
    }
  }

  if (!deviceId) {
    deviceId = generateServerAdminDeviceId();
    const reg = await registerActiveAdminDevice(deviceId, {
      label: typeof label === 'string' ? label.slice(0, 80) : undefined,
      os: typeof os === 'string' ? os.slice(0, 80) : undefined
    });
    if (!reg.success) {
      return res.status(403).json({
        success: false,
        error: reg.error || 'Maximum authorized administrative device limit reached.'
      });
    }
  }

  const signed = signSessionToken(deviceId, 'admin');
  if (!signed) {
    return res.status(500).json({ success: false, error: 'Token signing unavailable.' });
  }

  if (typeof firebaseUid === 'string' && firebaseUid) {
    await syncClientFirestoreClaim(firebaseUid, 'admin', signed.expiresAt);
  }

  setAdminSessionCookies(res, deviceId, signed.token);
  return res.status(200).json({
    success: true,
    token: signed.token,
    role: 'admin',
    adminDeviceId: deviceId,
    expiresAt: signed.expiresAt,
    message: 'Administrator authentication verified.'
  });
}
