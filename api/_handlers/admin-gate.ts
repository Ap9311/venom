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
  getAdminDeviceLimitAndList,
  clearAdminCookies,
  revokeClientFirestoreClaim,
  sanitizePayload
} from '../_helpers.js';

/**
 * GET / POST /api/admin-gate
 * - For unauthenticated visitors: returns ONLY minimal boolean { isOpen, isAdmin: false } (never exposes device IDs or counts).
 * - For verified full admins: returns full device list, maxAdmins, and current adminDeviceId.
 * - POST with { action: 'logout' } clears HttpOnly admin cookies and Firestore claim.
 */
export default async function handler(req: any, res: any) {
  setCorsHeaders(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  if (req.method === 'POST' && !verifyCsrfOrigin(req)) {
    return res.status(403).json({ error: 'Origin not allowed.' });
  }

  const body = req.method === 'POST' ? sanitizePayload(req.body || {}) : {};
  if (req.method === 'POST' && body.action === 'logout') {
    clearAdminCookies(res);
    if (typeof body.firebaseUid === 'string' && body.firebaseUid) {
      await revokeClientFirestoreClaim(body.firebaseUid);
    }
    return res.status(200).json({ success: true });
  }

  if (!getAdminSecretKey()) {
    return res.status(500).json({
      isOpen: false,
      isAdmin: false,
      error: 'Server authentication is not configured.'
    });
  }

  const token = extractTokenFromRequest(req);
  const payload = verifySessionToken(token);
  let isAdmin = false;
  let currentDeviceId = '';

  if (payload && payload.role === 'admin') {
    const active = await isRegisteredActiveAdminDevice(payload.sub);
    if (active) {
      isAdmin = true;
      currentDeviceId = payload.sub;
    }
  }

  const { maxAdmins, devices } = await getAdminDeviceLimitAndList();
  const isOpen = devices.length < maxAdmins;

  if (isAdmin) {
    return res.status(200).json({
      isAdmin: true,
      isOpen,
      maxAdmins,
      registeredCount: devices.length,
      currentDeviceId,
      registeredDevices: devices
    });
  }

  // Non-admin callers only learn whether /login registration gate is open
  return res.status(200).json({
    isAdmin: false,
    isOpen
  });
}
