/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  setCorsHeaders,
  verifyCsrfOrigin,
  getAdminSecretKey,
  verifyAssistantCredentialsServer,
  checkRateLimit,
  recordRateLimitFailure,
  clearRateLimit,
  signSessionToken,
  syncClientFirestoreClaim,
  sanitizePayload
} from '../_helpers.js';

/**
 * POST /api/assistant-auth
 * Ephemeral one-time assistant portal authentication.
 * - Enforces per-IP rate limiting (5 failures -> 15 min lockout).
 * - Issues a SEPARATE limited 'assistant' JWT (2h expiry, never full admin).
 * - Sets NO cookies and creates NO Admin Device IDs.
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

  const rl = await checkRateLimit(req, 'assistant_auth');
  if (rl.limited) {
    res.setHeader('Retry-After', String(rl.retryAfterSec));
    return res.status(429).json({
      success: false,
      error: 'Too many failed login attempts. Please try again in 15 minutes.'
    });
  }

  const body = sanitizePayload(req.body || {});
  const { username, password, firebaseUid } = body;

  const check = await verifyAssistantCredentialsServer(username, password);
  if (!check.configured) {
    return res.status(503).json({
      success: false,
      error: 'Assistant credentials are not configured on the server.'
    });
  }

  if (!check.valid) {
    await recordRateLimitFailure(req, 'assistant_auth');
    return res.status(401).json({
      success: false,
      error: 'Invalid Assistant credentials.'
    });
  }

  await clearRateLimit(req, 'assistant_auth');

  // Issue limited assistant-scoped token (NEVER full admin)
  const signed = signSessionToken('assistant', 'assistant');
  if (!signed) {
    return res.status(500).json({ success: false, error: 'Token signing unavailable.' });
  }

  if (typeof firebaseUid === 'string' && firebaseUid) {
    await syncClientFirestoreClaim(firebaseUid, 'assistant', signed.expiresAt);
  }

  return res.status(200).json({
    success: true,
    token: signed.token,
    role: 'assistant',
    expiresAt: signed.expiresAt,
    message: 'Assistant session verified.'
  });
}
