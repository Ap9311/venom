/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../src/firebase';
import {
  setCorsHeaders,
  getClientIp,
  hashIpForServer,
  isOwnerIp,
  ensureServerFirestoreAuth
} from './_helpers';

/**
 * GET /api/check-block
 * Server-side quarantine / IP block check using salted HMAC-SHA256 IP hashes
 * and server-only OWNER_IP allowlist. Never echoes raw IPs or exposes blockedIps to visitors.
 */
export default async function handler(req: any, res: any) {
  setCorsHeaders(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ isBlocked: false });
  }

  const ip = getClientIp(req);
  if (!ip || ip === '127.0.0.1' || isOwnerIp(ip)) {
    return res.status(200).json({ isBlocked: false });
  }

  if (!db) {
    return res.status(200).json({ isBlocked: false });
  }

  try {
    const authed = await ensureServerFirestoreAuth();
    if (!authed) {
      return res.status(200).json({ isBlocked: false });
    }

    const ipHash = hashIpForServer(ip);
    const hashSnap = await getDoc(doc(db, 'blocked_ip_hashes', ipHash));
    const legacySnap = hashSnap.exists() ? hashSnap : await getDoc(doc(db, 'blockedIps', ip));

    if (!legacySnap.exists()) {
      return res.status(200).json({ isBlocked: false });
    }

    const data = legacySnap.data() as any;
    if (!data?.isBlocked) {
      return res.status(200).json({ isBlocked: false });
    }

    let timeLeftLabel = 'Permanent';
    if (data.expiresAt) {
      const expires = new Date(data.expiresAt);
      const now = new Date();
      if (now >= expires) {
        return res.status(200).json({ isBlocked: false });
      }
      const diffMs = expires.getTime() - now.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      timeLeftLabel = diffDays > 0 ? `${diffDays}d ${diffHours}h` : `${diffHours}h ${diffMins}m`;
    }

    return res.status(200).json({
      isBlocked: true,
      blockType: data.blockType || 'permanent',
      expiresAt: data.expiresAt || null,
      timeLeftLabel,
      reason: data.reason || 'Community guidelines violation'
    });
  } catch {
    return res.status(200).json({ isBlocked: false });
  }
}
