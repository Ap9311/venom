/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  setCorsHeaders,
  verifyCsrfOrigin,
  requireFullAdmin,
  getAdminDeviceLimitAndList,
  updateServerAdminLimit,
  sanitizePayload
} from './_helpers';

/**
 * POST /api/admin-update-limit
 * Requires a verified full administrator JWT (assistant & anonymous callers rejected with 401/403).
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
  const maxAdmins = Number(body.maxAdmins);
  if (!Number.isInteger(maxAdmins) || maxAdmins < 1 || maxAdmins > 50) {
    return res.status(400).json({ success: false, error: 'Invalid maxAdmins value (1-50).' });
  }

  const current = await getAdminDeviceLimitAndList();
  if (maxAdmins < current.devices.length) {
    return res.status(400).json({
      success: false,
      error: `Limit cannot be lower than active registered devices (${current.devices.length}).`
    });
  }

  const ok = await updateServerAdminLimit(maxAdmins);
  if (!ok) {
    return res.status(500).json({ success: false, error: 'Failed to update admin limit.' });
  }

  return res.status(200).json({ success: true, maxAdmins });
}
