/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  setCorsHeaders,
  verifyCsrfOrigin,
  getAdminSecretKey,
  parseCookies,
  extractTokenFromRequest,
  verifySessionToken,
  isValidAdminDeviceIdFormat,
  isRegisteredActiveAdminDevice,
  signSessionToken,
  setAdminSessionCookies,
  syncClientFirestoreClaim,
  checkRateLimit,
  recordRateLimitFailure,
  sanitizePayload
} from '../_helpers.js';

/**
 * POST /api/admin-token
 * ONLY refreshes/issues a short-lived admin JWT if:
 *  1) ADMIN_SECRET_KEY is configured (otherwise fail closed with 500),
 *  2) The caller provides an active registered adminDeviceId in admin_devices, AND
 *  3) The caller ALREADY holds a valid, non-expired full admin session token tied to that exact device.
 * Unknown or made-up device IDs ALWAYS receive HTTP 401/403 and NEVER a token.
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

  const rl = await checkRateLimit(req, 'admin_token');
  if (rl.limited) {
    res.setHeader('Retry-After', String(rl.retryAfterSec));
    return res.status(429).json({ success: false, error: 'Too many attempts. Try again later.' });
  }

  const body = sanitizePayload(req.body || {});
  const cookies = parseCookies(req);
  const requestedDeviceId =
    (typeof body.adminDeviceId === 'string' && body.adminDeviceId.trim()) ||
    cookies['nonum_admin_device_id'] ||
    '';

  const existingToken = extractTokenFromRequest(req);
  const verified = verifySessionToken(existingToken);

  // Must already hold a verified full admin session tied to this exact active device
  if (!verified || verified.role !== 'admin') {
    await recordRateLimitFailure(req, 'admin_token');
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }

  const targetDeviceId = requestedDeviceId || verified.sub;
  if (!isValidAdminDeviceIdFormat(targetDeviceId) || targetDeviceId !== verified.sub) {
    await recordRateLimitFailure(req, 'admin_token');
    return res.status(403).json({ success: false, error: 'Device mismatch or unauthorized.' });
  }

  const isActive = await isRegisteredActiveAdminDevice(targetDeviceId);
  if (!isActive) {
    await recordRateLimitFailure(req, 'admin_token');
    return res.status(403).json({ success: false, error: 'Device not authorized.' });
  }

  const signed = signSessionToken(targetDeviceId, 'admin');
  if (!signed) {
    return res.status(500).json({ success: false, error: 'Token signing unavailable.' });
  }

  if (typeof body.firebaseUid === 'string' && body.firebaseUid) {
    await syncClientFirestoreClaim(body.firebaseUid, 'admin', signed.expiresAt);
  }

  setAdminSessionCookies(res, targetDeviceId, signed.token);
  return res.status(200).json({
    success: true,
    token: signed.token,
    role: 'admin',
    expiresAt: signed.expiresAt
  });
}
