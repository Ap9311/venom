/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { setCorsHeaders, requireFullAdmin, getClientIp } from './_helpers';

/**
 * GET /api/get-ip
 * Restricted to verified administrator sessions only.
 * Normal visitors do not call this endpoint and receive 401.
 */
export default async function handler(req: any, res: any) {
  setCorsHeaders(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const authCheck = await requireFullAdmin(req);
  if (!authCheck.ok) {
    return res.status(authCheck.status).json({ error: 'Unauthorized' });
  }

  return res.status(200).json({ ip: getClientIp(req) });
}
