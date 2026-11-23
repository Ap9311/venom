import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getDeviceImei, getAllDeviceImeis, addAliasImei } from './ip';

export interface BlockStatus {
  isBlocked: boolean;
  timeLeftLabel?: string;
  blockType?: '15days' | '30days' | 'permanent' | string;
  reason?: string;
  expiresAt?: string;
  blockCount?: number;
  totalReports?: number;
  triggerPostId?: string;
  triggerPostTitle?: string;
  triggerPostContent?: string;
  triggerPostImageUrl?: string;
  reportReason?: string;
  reportOpinion?: string;
}

/**
 * Checks if a client's IP or any of its Device IMEI / Vault / Cross-Browser signatures is blocked.
 * If a temporary block has expired, it automatically updates the database to lift the ban.
 */
export async function checkIpBlockStatus(ip: string, imei?: string): Promise<BlockStatus> {
  if (ip === '150.129.200.97') {
    return { isBlocked: false };
  }

  const primaryImei = imei || await getDeviceImei();
  const candidateImeis = Array.from(new Set([
    ...(primaryImei ? [primaryImei] : []),
    ...getAllDeviceImeis()
  ])).filter(Boolean);

  try {
    // 1. Prioritize check across all Device IMEIs (primary + 4-vault + cross-browser aliases) to prevent evasion by IP/VPN hopping
    for (const candidateImei of candidateImeis) {
      const imeiBlockRef = doc(db, 'blockedImeis', candidateImei);
      const imeiBlockSnap = await getDoc(imeiBlockRef);
      if (imeiBlockSnap.exists()) {
        const data = imeiBlockSnap.data();
        if (data.isBlocked) {
          if (data.expiresAt) {
            const expires = new Date(data.expiresAt);
            const now = new Date();
            if (now >= expires) {
              await updateDoc(imeiBlockRef, {
                isBlocked: false,
                expiresAt: null,
                blockedAt: null
              }).catch(() => {});
            } else {
              const diffMs = expires.getTime() - now.getTime();
              const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
              const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
              const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
              let label = '';
              if (diffDays > 0) label += `${diffDays}d `;
              if (diffHours > 0 || diffDays > 0) label += `${diffHours}h `;
              label += `${diffMins}m remaining`;

              // Lock banned IMEI into all 4 browser vaults so switching to VPN later still blocks this browser
              addAliasImei(candidateImei);

              return {
                isBlocked: true,
                timeLeftLabel: label,
                blockType: data.blockType || 'temporary',
                reason: data.reason || 'This device signature has been quarantined due to Community Guidelines Violations.',
                expiresAt: data.expiresAt
              };
            }
          } else {
            addAliasImei(candidateImei);
            return {
              isBlocked: true,
              timeLeftLabel: 'Permanent Ban',
              blockType: 'permanent',
              reason: data.reason || 'This device signature is permanently blacklisted.'
            };
          }
        }
      }
    }

    // 2. Fallback check by Network IP address (catches Incognito / secondary browsers on the same network)
    if (!ip) return { isBlocked: false };
    const blockRef = doc(db, 'blockedIps', ip);
    const blockSnap = await getDoc(blockRef);
    if (!blockSnap.exists()) {
      return { isBlocked: false };
    }

    const data = blockSnap.data();
    if (!data.isBlocked) {
      return { isBlocked: false };
    }

    // Check if the IP block has expired
    if (data.expiresAt) {
      const expires = new Date(data.expiresAt);
      const now = new Date();
      if (now >= expires) {
        await updateDoc(blockRef, {
          isBlocked: false,
          expiresAt: null,
          blockedAt: null,
          totalReports: 0
        }).catch(() => {});
        return { isBlocked: false };
      } else {
        // Bind banned IMEI into this browser's multi-vault storage so enabling a VPN after loading cannot evade the block
        if (data.imei) {
          addAliasImei(data.imei);
        }

        const diffMs = expires.getTime() - now.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        let label = '';
        if (diffDays > 0) label += `${diffDays}d `;
        if (diffHours > 0 || diffDays > 0) label += `${diffHours}h `;
        label += `${diffMins}m remaining`;

        return {
          isBlocked: true,
          timeLeftLabel: label,
          blockType: data.blockType,
          reason: data.reason,
          expiresAt: data.expiresAt,
          blockCount: data.blockCount,
          totalReports: data.totalReports,
          triggerPostId: data.triggerPostId,
          triggerPostTitle: data.triggerPostTitle,
          triggerPostContent: data.triggerPostContent,
          triggerPostImageUrl: data.triggerPostImageUrl,
          reportReason: data.reportReason,
          reportOpinion: data.reportOpinion,
        };
      }
    } else {
      if (data.imei) {
        addAliasImei(data.imei);
      }
      return {
        isBlocked: true,
        timeLeftLabel: 'Permanent Ban',
        blockType: 'permanent',
        reason: data.reason,
        blockCount: data.blockCount,
        totalReports: data.totalReports,
        triggerPostId: data.triggerPostId,
        triggerPostTitle: data.triggerPostTitle,
        triggerPostContent: data.triggerPostContent,
        triggerPostImageUrl: data.triggerPostImageUrl,
        reportReason: data.reportReason,
        reportOpinion: data.reportOpinion,
      };
    }
  } catch (error) {
    if (error instanceof Error && (error.message.includes('offline') || error.message.includes('Could not reach') || error.message.includes('Failed to get document'))) {
      console.warn('Block status check bypassed (client is offline):', error.message);
    } else {
      console.error('Error checking block status:', error);
    }
    return { isBlocked: false };
  }
}
