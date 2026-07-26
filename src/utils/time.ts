/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Formats a Firestore Timestamp or Date object into a relative "X ago" string.
 */
export function formatTimeAgo(timestamp: any): string {
  if (!timestamp) return 'just now';
  
  let date: Date;
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === 'number') {
    date = new Date(timestamp);
  } else if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else if (timestamp.seconds) {
    date = new Date(timestamp.seconds * 1000);
  } else {
    return 'just now';
  }

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 0) return 'just now';
  if (diffInSeconds < 60) return 'just now';

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks}w ago`;
  }

  // Otherwise return standard readable date
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Formats large count numbers in a clean, professional, non-design-spoiling manner.
 * Format examples:
 * - 0-9: "9"
 * - 10-99: "10+", "90+"
 * - 100-999: "100+", "900+"
 * - 1,000-99,999: "1K+", "95.5K+"
 * - 100,000-999,999: "1L+", "9.5L+" (Lakhs format as requested)
 * - 1,000,000+: "1M+", "10.5M+"
 */
export function formatShortCount(val: number): string {
  if (!val || val <= 0) return '0';
  if (val < 10) return `${val}`;
  if (val < 100) return `${Math.floor(val / 10) * 10}+`;
  if (val < 1000) return `${Math.floor(val / 100) * 100}+`;
  if (val < 100000) {
    const k = val / 1000;
    return `${k % 1 === 0 ? k : k.toFixed(1).replace(/\.0$/, '')}K+`;
  }
  if (val < 1000000) {
    const l = val / 100000;
    return `${l % 1 === 0 ? l : l.toFixed(1).replace(/\.0$/, '')}L+`;
  }
  const m = val / 1000000;
  return `${m % 1 === 0 ? m : m.toFixed(1).replace(/\.0$/, '')}M+`;
}

