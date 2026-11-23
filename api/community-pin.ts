/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../src/firebase';
import {
  setCorsHeaders,
  verifyCsrfOrigin,
  checkRateLimit,
  recordRateLimitFailure,
  clearRateLimit,
  setCommunityPinServer,
  verifyCommunityPinServer,
  requireFullAdmin,
  sanitizePayload
} from './_helpers';

/**
 * POST /api/community-pin
 * Server-side community PIN storage & verification using salted scrypt hashes.
 * PIN hashes are NEVER stored on public community documents or sent to clients.
 * - action: 'set' | 'remove' | 'verify'
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

  const body = sanitizePayload(req.body || {});
  const action = typeof body.action === 'string' ? body.action.trim() : '';
  const communityId = typeof body.communityId === 'string' ? body.communityId.trim() : '';
  const pin = typeof body.pin === 'string' ? body.pin.trim() : '';
  const ownerUid = typeof body.ownerUid === 'string' ? body.ownerUid.trim() : '';

  if (!communityId || !/^[A-Za-z0-9_-]{3,128}$/.test(communityId)) {
    return res.status(400).json({ success: false, error: 'Valid communityId is required.' });
  }

  if (action === 'verify') {
    const rl = await checkRateLimit(req, `comm_pin_${communityId}`);
    if (rl.limited) {
      res.setHeader('Retry-After', String(rl.retryAfterSec));
      return res.status(429).json({
        success: false,
        error: 'Too many incorrect PIN attempts. Try again in 15 minutes.'
      });
    }

    if (!pin || pin.length > 64) {
      await recordRateLimitFailure(req, `comm_pin_${communityId}`);
      return res.status(401).json({ success: false, error: 'Incorrect PIN.' });
    }

    const result = await verifyCommunityPinServer(communityId, pin);
    if (!result.hasPin) {
      return res.status(200).json({ success: true, unlocked: true });
    }

    if (result.valid) {
      await clearRateLimit(req, `comm_pin_${communityId}`);
      return res.status(200).json({ success: true, unlocked: true });
    }

    await recordRateLimitFailure(req, `comm_pin_${communityId}`);
    return res.status(401).json({ success: false, error: 'Incorrect PIN.' });
  }

  if (action === 'set' || action === 'remove') {
    // Allow either verified full admin OR the community's ownerUid (matching Firestore doc if it exists)
    const adminCheck = await requireFullAdmin(req);
    let authorized = adminCheck.ok;

    if (!authorized && ownerUid && /^[A-Za-z0-9_-]{8,128}$/.test(ownerUid) && db) {
      try {
        const commSnap = await getDoc(doc(db, 'communities', communityId));
        if (!commSnap.exists()) {
          // Brand-new community being created right now
          authorized = true;
        } else {
          const data = commSnap.data() as any;
          if (data?.ownerUid && data.ownerUid === ownerUid) {
            authorized = true;
          }
        }
      } catch {
        authorized = false;
      }
    }

    if (!authorized) {
      return res.status(403).json({ success: false, error: 'Not authorized to change community PIN.' });
    }

    if (action === 'remove') {
      await setCommunityPinServer(communityId, null, ownerUid);
      return res.status(200).json({ success: true, hasPin: false });
    }

    if (pin.length < 3 || pin.length > 64) {
      return res.status(400).json({ success: false, error: 'PIN must be between 3 and 64 characters.' });
    }

    await setCommunityPinServer(communityId, pin, ownerUid);
    return res.status(200).json({ success: true, hasPin: true });
  }

  return res.status(400).json({ success: false, error: 'Unsupported action.' });
}
