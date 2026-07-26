import { doc, getDoc, updateDoc, runTransaction, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { getDeviceImei } from './ip';

export interface ReportPayload {
  postId: string;
  reason: string;
  opinion: string;
  reporterIp: string;
}

export interface ReportResult {
  autoDeleted: boolean;
  blockTriggered: boolean;
  blockTypeLabel: string;
}

/**
 * Handles security reporting of any specific post.
 * Increments report counts, handles auto-deletion, tracks total author IP report metrics,
 * and activates escalating IP suspension rules automatically.
 */
export async function submitPostReport(
  postId: string,
  reason: string,
  opinion: string,
  reporterIp: string
): Promise<ReportResult> {
  const postRef = doc(db, 'posts', postId);
  
  // Clean reporter IP for Firestore document key
  const safeIpKey = reporterIp.replace(/[^a-zA-Z0-9]/g, '_');
  
  // Create a separate duplicate check document in the reports collection to prevent double reporting
  const duplicateCheckId = `dup_${postId}_${safeIpKey}`;
  const duplicateCheckRef = doc(db, 'reports', duplicateCheckId);

  // Retrieve IMEI of reporter to ensure single device reporting restriction
  const reporterImei = getDeviceImei();
  const duplicateCheckImeiId = `dup_imei_${postId}_${reporterImei}`;
  const duplicateCheckImeiRef = doc(db, 'reports', duplicateCheckImeiId);

  // Generate a unique identifier for the actual report log entry
  const uniqueReportId = doc(collection(db, 'reports')).id;
  const reportRef = doc(db, 'reports', uniqueReportId);

  const result = await runTransaction(db, async (transaction) => {
    // === READ OPERATIONS FIRST ===

    // 1. Verify if the report has already been filed from this IP for this post
    const dupSnap = await transaction.get(duplicateCheckRef);
    if (dupSnap.exists()) {
      throw new Error("You have already submitted a security report for this post. Duplicate report ignored.");
    }

    const dupImeiSnap = await transaction.get(duplicateCheckImeiRef);
    if (dupImeiSnap.exists()) {
      throw new Error("This device has already submitted a security report for this post. Duplicate report ignored.");
    }

    // 2. Retrieve the target post document
    const postSnap = await transaction.get(postRef);
    if (!postSnap.exists()) {
      throw new Error("Target Post ID does not exist in the active database. Verification failed.");
    }

    const postData = postSnap.data();
    if (postData.isDeleted) {
      throw new Error("This post has already been removed or suspended by automatic security.");
    }

    const authorIp = postData.postedFromIp || "";

    // 3. Read author IP blocks if available - only if author is not the reporter
    let authorBlockSnap = null;
    let authorBlockRef = null;
    if (authorIp && authorIp !== reporterIp) {
      authorBlockRef = doc(db, 'blockedIps', authorIp);
      authorBlockSnap = await transaction.get(authorBlockRef);
    }

    // === ALL READS DONE. NOW EXECUTE BUSINESS LOGIC ===

    const currentReports = (postData.reportsCount || 0) + 1;
    const shouldDelete = currentReports >= 10;

    let blockTriggered = false;
    let blockTypeLabel = '';
    let blockDataToSet = null;

    if (authorIp && authorBlockRef && authorIp !== reporterIp) {
      let blockCount = 0;
      let totalReports = 0;
      let isBlocked = false;
      let expiresAt: string | null = null;
      let blockType: '15days' | '30days' | 'permanent' | null = null;
      let blockedAt: string | null = null;

      if (authorBlockSnap && authorBlockSnap.exists()) {
        const bd = authorBlockSnap.data();
        blockCount = bd.blockCount || 0;
        totalReports = bd.totalReports || 0;
        isBlocked = bd.isBlocked || false;
        expiresAt = bd.expiresAt || null;
      }

      // Add to running report totals for this user's IP
      totalReports += 1;

      // Check if cumulative report threshold is violated (never block admin's personal IP automatically)
      if (totalReports >= 50 && authorIp !== '150.129.200.97') {
        blockCount += 1; // Elevate offense history tier
        isBlocked = true;
        blockedAt = new Date().toISOString();

        if (blockCount === 1) {
          // Offense Level 1: 15-day suspension
          const exp = new Date();
          exp.setDate(exp.getDate() + 15);
          expiresAt = exp.toISOString();
          blockType = '15days';
          blockTypeLabel = '15-Day Suspension';
        } else if (blockCount === 2) {
          // Offense Level 2: 30-day suspension
          const exp = new Date();
          exp.setDate(exp.getDate() + 30);
          expiresAt = exp.toISOString();
          blockType = '30days';
          blockTypeLabel = '30-Day Suspension';
        } else {
          // Offense Level 3+: Permanent ban
          expiresAt = null;
          blockType = 'permanent';
          blockTypeLabel = 'Permanent Ban';
        }

        // Reset reports to start fresh after suspension
        totalReports = 0;
        blockTriggered = true;
      }

      if (authorIp === '150.129.200.97') {
        isBlocked = false;
        blockTriggered = false;
        totalReports = 0;
        blockCount = 0;
        expiresAt = null;
        blockType = null;
      }

      blockDataToSet = {
        ip: authorIp,
        isBlocked,
        blockCount,
        totalReports,
        blockedAt,
        expiresAt,
        blockType,
        reason: blockTriggered 
          ? `System Automated Enforcement: Accumulated 50 total security reports across posts. Level ${blockCount} security protocol activated.` 
          : ((authorBlockSnap && authorBlockSnap.exists()) ? (authorBlockSnap.data().reason || 'Accumulated user complaints.') : 'Accumulated user complaints.'),
        ...(blockTriggered ? {
          triggerPostId: postId,
          triggerPostTitle: postData.title || "",
          triggerPostContent: postData.content || "",
          triggerPostImageUrl: postData.imageUrl || "",
          reportReason: reason || "",
          reportOpinion: opinion || ""
        } : {})
      };
    }

    // === WRITE OPERATIONS AT THE VERY END ===

    // 1. Log the duplicate check entry (IP and IMEI checks)
    transaction.set(duplicateCheckRef, {
      isDuplicateCheck: true,
      postId,
      reporterIp,
      reporterImei,
      createdAt: new Date().toISOString()
    });

    transaction.set(duplicateCheckImeiRef, {
      isDuplicateCheck: true,
      postId,
      reporterIp,
      reporterImei,
      createdAt: new Date().toISOString()
    });

    // 2. Log the unique report entry
    transaction.set(reportRef, {
      id: uniqueReportId,
      postId,
      reason,
      opinion: opinion.trim(),
      reporterIp,
      reporterImei,
      createdAt: new Date().toISOString(),
      postTitle: postData.title || "",
      postContent: postData.content || "",
      postImageUrl: postData.imageUrl || "",
      postedFromIp: authorIp,
      postedFromImei: postData.postedFromImei || "",
    });

    // 3. Update the post's report counters
    transaction.update(postRef, {
      reportsCount: currentReports,
      isDeleted: shouldDelete ? true : (postData.isDeleted || false)
    });

    // 4. Set the blocked IP status if needed
    if (authorBlockRef && blockDataToSet) {
      transaction.set(authorBlockRef, blockDataToSet, { merge: true });
    }

    return {
      autoDeleted: shouldDelete,
      blockTriggered,
      blockTypeLabel
    };
  });

  return result;
}
