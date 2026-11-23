/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  setCorsHeaders,
  verifyCsrfOrigin,
  requireFullAdmin,
  revokeRegisteredAdminDevice,
  clearAdminCookies,
  revokeClientFirestoreClaim,
  isValidAdminDeviceIdFormat,
  sanitizePayload
} from './_helpers';

/**
 * POST /api/admin-revoke
 * Requires a verified full administrator JWT (never accessible to anonymous or assistant callers).
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

  const authCheck = await requireFullAdmin(req);
  if (!authCheck.ok) {
    return res.status(authCheck.status).json({ success: false, error: authCheck.error });
  }

  const body = sanitizePayload(req.body || {});
  const { adminDeviceId, firebaseUid } = body;

  if (!isValidAdminDeviceIdFormat(adminDeviceId)) {
    return res.status(400).json({ success: false, error: 'Valid adminDeviceId is required.' });
  }

  await revokeRegisteredAdminDevice(adminDeviceId);

  // If revoking own device, clear cookies and Firestore claim
  if (adminDeviceId === authCheck.session.sub) {
    clearAdminCookies(res);
    if (typeof firebaseUid === 'string' && firebaseUid) {
      await revokeClientFirestoreClaim(firebaseUid);
    }
  }

  return res.status(200).json({ success: true });
}
