/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BlockStatus {
  isBlocked: boolean;
  blockType?: 'permanent' | 'temporary' | string;
  blockCount?: number;
  expiresAt?: string | null;
  timeLeftLabel?: string;
  reason?: string;
  triggerPostId?: string;
  triggerPostTitle?: string;
  triggerPostContent?: string;
  triggerPostImageUrl?: string;
  reportReason?: string;
  reportOpinion?: string;
}

/**
 * Checks whether the current visitor is quarantined strictly via server-side
 * salted IP-hash verification (/api/check-block).
 * - Never embeds owner IPs in client code.
 * - Never reads blockedIps / blockedImeis from Firestore on the client.
 * - Uses a 2.5s timeout so network latency never stalls UI actions.
 */
export async function checkIpBlockStatus(): Promise<BlockStatus> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch('/api/check-block', {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!res.ok) return { isBlocked: false };
    const data = await res.json();
    if (data && data.isBlocked) {
      return {
        isBlocked: true,
        blockType: data.blockType || 'permanent',
        expiresAt: data.expiresAt || null,
        timeLeftLabel: data.timeLeftLabel || 'Permanent',
        reason: data.reason || 'Community guidelines violation'
      };
    }
    return { isBlocked: false };
  } catch {
    return { isBlocked: false };
  }
}
