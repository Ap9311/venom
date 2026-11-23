/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  setCorsHeaders,
  verifyCsrfOrigin,
  getAdminSecretKey,
  extractTokenFromRequest,
  verifySessionToken,
  isRegisteredActiveAdminDevice,
  syncClientFirestoreClaim,
  sanitizePayload
} from '../_helpers.js';

/**
 * POST /api/admin-verify
 * Verifies a short-lived signed JWT.
 * - Rejects malformed, expired, tampered, or revoked tokens.
 * - Confirms the tied adminDeviceId is still active in admin_devices for role='admin'.
 * - Never elevates an assistant token to isAdmin: true.
 */
export default async function handler(req: any, res: any) {
  setCorsHeaders(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ isAdmin: false, isAssistant: false, error: 'Method Not Allowed' });
  }
  if (!verifyCsrfOrigin(req)) {
    return res.status(403).json({ isAdmin: false, isAssistant: false, error: 'Origin not allowed.' });
  }
  if (!getAdminSecretKey()) {
    return res.status(500).json({ isAdmin: false, isAssistant: false, error: 'Server authentication is not configured.' });
  }

  const body = sanitizePayload(req.body || {});
  const token =
    (typeof body.token === 'string' && body.token.trim()) ||
    extractTokenFromRequest(req);

  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({
      isAdmin: false,
      isAssistant: false,
      role: null
    });
  }

  if (payload.role === 'assistant') {
    if (typeof body.firebaseUid === 'string' && body.firebaseUid) {
      await syncClientFirestoreClaim(body.firebaseUid, 'assistant', payload.exp * 1000);
    }
    return res.status(200).json({
      isAdmin: false,
      isAssistant: true,
      role: 'assistant',
      expiresAt: payload.exp * 1000
    });
  }

  // Full admin token must still be tied to an active registered admin device
  const active = await isRegisteredActiveAdminDevice(payload.sub);
  if (!active) {
    return res.status(403).json({
      isAdmin: false,
      isAssistant: false,
      role: null
    });
  }

  if (typeof body.firebaseUid === 'string' && body.firebaseUid) {
    await syncClientFirestoreClaim(body.firebaseUid, 'admin', payload.exp * 1000);
  }

  return res.status(200).json({
    isAdmin: true,
    isAssistant: false,
    role: 'admin',
    adminDeviceId: payload.sub,
    expiresAt: payload.exp * 1000
  });
}
