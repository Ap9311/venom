/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  increment
} from 'firebase/firestore';
import { db } from '../firebase';
import { getAnonymousUserId } from './ip';

export const REPORT_REASONS = [
  'Harassment or Bullying',
  'Hate Speech or Discrimination',
  'Spam or Misleading Content',
  'Violence or Dangerous Content',
  'NSFW / Explicit Material',
  'Privacy Violation / Doxxing',
  'Scam or Fraud',
  'Other Policy Violation'
];

export interface ReportResult {
  success: boolean;
  alreadyReported?: boolean;
  postDeleted?: boolean;
  reportsCount: number;
  message: string;
}

/**
 * Submits a privacy-safe report against a post (zero IP/IMEI/serial stored).
 * Duplicate reports are prevented per anonymous Firebase Auth UID.
 * At 10 reports, automatically soft-deletes the post from the public feed.
 */
export async function submitPostReport(
  postId: string,
  reason: string,
  opinion: string = '',
  isAdminReport: boolean = false
): Promise<ReportResult> {
  if (!db) throw new Error('Database not initialized');
  const cleanPostId = String(postId || '').trim();
  if (!cleanPostId) throw new Error('Valid Post ID is required.');

  const uid = await getAnonymousUserId();

  // 1. Verify post exists
  const postRef = doc(db, 'posts', cleanPostId);
  const postSnap = await getDoc(postRef);
  if (!postSnap.exists()) {
    throw new Error('Post not found. It may have already been removed.');
  }

  const postData = postSnap.data() as any;
  if (postData.isDeleted) {
    throw new Error('This post has already been removed.');
  }

  // 2. Prevent duplicate reports per anonymous UID (skip for admin console reports)
  const interactionId = `${cleanPostId}_${uid}_report`;
  if (!isAdminReport) {
    const interactionRef = doc(db, 'interactions', interactionId);
    const existing = await getDoc(interactionRef);
    if (existing.exists()) {
      return {
        success: false,
        alreadyReported: true,
        reportsCount: postData.reportsCount || 0,
        message: 'You have already reported this post.'
      };
    }

    await setDoc(interactionRef, {
      uid,
      postId: cleanPostId,
      type: 'report_post',
      createdAt: new Date().toISOString()
    });
  }

  // 3. Create report document (readable only by admins/assistants; zero PII)
  await addDoc(collection(db, 'reports'), {
    postId: cleanPostId,
    postTitle: String(postData.title || '').slice(0, 200),
    postContent: String(postData.content || '').slice(0, 500),
    postImageUrl: typeof postData.imageUrl === 'string' ? postData.imageUrl : '',
    reason: String(reason || 'Other Policy Violation').slice(0, 120),
    opinion: String(opinion || '').trim().slice(0, 1000),
    reporterUid: isAdminReport ? 'ADMIN_CONSOLE' : uid,
    createdAt: new Date().toISOString(),
    isDismissed: false,
    isResolved: false
  });

  // 4. Increment reportsCount & auto-remove at 10 reports
  const nextCount = (Number(postData.reportsCount) || 0) + 1;
  const shouldAutoDelete = nextCount >= 10;

  if (shouldAutoDelete) {
    await updateDoc(postRef, {
      reportsCount: increment(1),
      isDeleted: true
    });
  } else {
    await updateDoc(postRef, {
      reportsCount: increment(1)
    });
  }

  return {
    success: true,
    postDeleted: shouldAutoDelete,
    reportsCount: nextCount,
    message: shouldAutoDelete
      ? 'Report submitted. This post reached the safety threshold and has been automatically removed.'
      : 'Thank you. Your report has been submitted for moderation.'
  };
}
