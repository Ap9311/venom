/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { signInAnonymously } from 'firebase/auth';
import { auth } from '../firebase';
import { getInMemoryAdminToken } from './adminAuth';

const ANON_SESSION_STORAGE_KEY = 'nonum_anon_uid_v2';

/**
 * Returns the visitor's anonymous Firebase Auth UID (or a random local UUID if offline).
 * Never collects, transmits, or stores IP addresses, IMEIs, or hardware serials.
 */
export async function getAnonymousUserId(): Promise<string> {
  if (auth) {
    try {
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }
      if (auth.currentUser?.uid) {
        return auth.currentUser.uid;
      }
    } catch {
      // fall back to local random ID
    }
  }

  try {
    let localId = localStorage.getItem(ANON_SESSION_STORAGE_KEY);
    if (!localId) {
      localId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? `anon_${crypto.randomUUID().replace(/-/g, '')}`
          : `anon_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      localStorage.setItem(ANON_SESSION_STORAGE_KEY, localId);
    }
    return localId;
  } catch {
    return `anon_${Date.now().toString(36)}`;
  }
}

/**
 * Admin-only IP lookup (requires verified administrator session).
 * Normal visitors never invoke /api/get-ip.
 */
export async function getAdminDiagnosticIp(): Promise<string> {
  try {
    const token = getInMemoryAdminToken();
    const res = await fetch('/api/get-ip', {
      method: 'GET',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!res.ok) return '';
    const data = await res.json();
    return typeof data?.ip === 'string' ? data.ip : '';
  } catch {
    return '';
  }
}
