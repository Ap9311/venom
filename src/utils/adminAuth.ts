/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { signInAnonymously } from 'firebase/auth';
import { auth } from '../firebase';

export interface AdminDevice {
  adminDeviceId: string;
  registeredAt: string;
  label: string;
  os: string;
  status: 'active' | 'revoked';
}

export interface AdminConfig {
  maxAdmins: number;
  registeredDevices: AdminDevice[];
  currentDeviceId: string;
  isFull?: boolean;
}

export interface AssistantCredentialsMeta {
  usernameDisplay: string;
  isCustom: boolean;
  updatedAt?: string;
}

// Strictly in-memory session tokens (never hardcoded, never written to localStorage)
let inMemoryAdminToken: string | null = null;
let inMemoryAdminDeviceId: string | null = null;
let inMemoryAssistantToken: string | null = null;

export function setInMemoryAssistantToken(token: string | null): void {
  inMemoryAssistantToken = token;
}

export function getInMemoryAssistantToken(): string | null {
  return inMemoryAssistantToken;
}

export function getInMemoryAdminToken(): string | null {
  return inMemoryAdminToken;
}

export function clearInMemoryAdminSession(): void {
  inMemoryAdminToken = null;
  inMemoryAdminDeviceId = null;
  try {
    sessionStorage.removeItem('nonum_admin_auth');
    sessionStorage.removeItem('nonum_admin_token');
    localStorage.removeItem('nonum_is_admin_device');
  } catch {
    // ignore storage errors
  }
}

async function getCurrentFirebaseUid(): Promise<string> {
  if (!auth) return '';
  try {
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }
    return auth.currentUser?.uid || '';
  } catch {
    return '';
  }
}

function buildAuthHeaders(preferRole: 'admin' | 'assistant' = 'admin'): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  const token = preferRole === 'assistant' ? inMemoryAssistantToken : inMemoryAdminToken;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function detectClientOs(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/android/i.test(ua)) return 'Android';
  if (/iPad|iPhone|iPod/.test(ua)) return 'iOS';
  if (/Win/.test(ua)) return 'Windows';
  if (/Mac/.test(ua)) return 'macOS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown OS';
}

/**
 * Returns the server-issued adminDeviceId for this session if verified.
 * Never derives device IDs with client-side secrets or salts.
 */
export async function getAdminDeviceId(): Promise<string> {
  if (inMemoryAdminDeviceId) return inMemoryAdminDeviceId;
  const check = await verifyCurrentAdminSession();
  return check.adminDeviceId || '';
}

/**
 * Verifies the active admin session (HttpOnly cookie or in-memory Bearer token)
 * strictly against /api/admin-verify on the server.
 */
export async function verifyCurrentAdminSession(): Promise<{
  isAdmin: boolean;
  isAssistant: boolean;
  adminDeviceId?: string;
}> {
  try {
    const firebaseUid = await getCurrentFirebaseUid();
    const res = await fetch('/api/admin-verify', {
      method: 'POST',
      headers: buildAuthHeaders('admin'),
      credentials: 'include',
      body: JSON.stringify({
        token: inMemoryAdminToken || undefined,
        firebaseUid
      })
    });
    if (!res.ok) {
      return { isAdmin: false, isAssistant: false };
    }
    const data = await res.json();
    if (data?.isAdmin) {
      if (data.adminDeviceId) inMemoryAdminDeviceId = data.adminDeviceId;
      return {
        isAdmin: true,
        isAssistant: false,
        adminDeviceId: data.adminDeviceId
      };
    }
    return {
      isAdmin: false,
      isAssistant: Boolean(data?.isAssistant)
    };
  } catch {
    return { isAdmin: false, isAssistant: false };
  }
}

export async function checkIsAdminDevice(): Promise<boolean> {
  const res = await verifyCurrentAdminSession();
  return res.isAdmin;
}

export async function isLoginGateOpen(): Promise<boolean> {
  try {
    const res = await fetch('/api/admin-gate', {
      method: 'GET',
      credentials: 'include'
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data?.isOpen || data?.isAdmin);
  } catch {
    return false;
  }
}

/**
 * Fetches full admin gate configuration & device registry (requires verified admin session).
 */
export async function getAdminConfig(): Promise<AdminConfig> {
  try {
    const res = await fetch('/api/admin-gate', {
      method: 'GET',
      headers: buildAuthHeaders('admin'),
      credentials: 'include'
    });
    if (!res.ok) {
      return { maxAdmins: 3, registeredDevices: [], currentDeviceId: '' };
    }
    const data = await res.json();
    if (data?.currentDeviceId) {
      inMemoryAdminDeviceId = data.currentDeviceId;
    }
    return {
      maxAdmins: typeof data?.maxAdmins === 'number' ? data.maxAdmins : 3,
      registeredDevices: Array.isArray(data?.registeredDevices) ? data.registeredDevices : [],
      currentDeviceId: data?.currentDeviceId || inMemoryAdminDeviceId || '',
      isFull: data?.isOpen === false
    };
  } catch {
    return { maxAdmins: 3, registeredDevices: [], currentDeviceId: '', isFull: false };
  }
}

/**
 * Authenticates admin credentials on the server, registers this device if needed,
 * and receives a short-lived signed admin JWT + HttpOnly cookies.
 */
export async function verifyAdminCredentials(
  username: string,
  password: string
): Promise<{ success: boolean; token?: string; adminDeviceId?: string; error?: string }> {
  try {
    const firebaseUid = await getCurrentFirebaseUid();
    const res = await fetch('/api/admin-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        username,
        password,
        firebaseUid,
        os: detectClientOs(),
        label: `Admin ${detectClientOs()} Browser`
      })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success && data?.token) {
      inMemoryAdminToken = data.token;
      if (data.adminDeviceId) inMemoryAdminDeviceId = data.adminDeviceId;
      return {
        success: true,
        token: data.token,
        adminDeviceId: data.adminDeviceId
      };
    }
    return {
      success: false,
      error: data?.error || 'Invalid Administrator credentials.'
    };
  } catch {
    return { success: false, error: 'Authentication server unreachable.' };
  }
}

export async function registerAdminDevice(
  username: string,
  password: string,
  customLabel?: string
): Promise<{ success: boolean; error?: string; adminDeviceId?: string }> {
  try {
    const firebaseUid = await getCurrentFirebaseUid();
    const res = await fetch('/api/admin-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        username,
        password,
        firebaseUid,
        os: detectClientOs(),
        label: customLabel || `Admin ${detectClientOs()} Browser`
      })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success && data?.token) {
      inMemoryAdminToken = data.token;
      if (data.adminDeviceId) inMemoryAdminDeviceId = data.adminDeviceId;
      return { success: true, adminDeviceId: data.adminDeviceId };
    }
    return { success: false, error: data?.error || 'Device registration failed.' };
  } catch {
    return { success: false, error: 'Registration server unreachable.' };
  }
}

/**
 * Ephemeral one-time assistant login.
 * Returns a separate limited assistant JWT stored strictly in memory (zero cookies, zero Admin IDs).
 */
export async function verifyAssistantCredentials(
  username: string,
  password: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const firebaseUid = await getCurrentFirebaseUid();
    const res = await fetch('/api/assistant-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, firebaseUid })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success && data?.token) {
      inMemoryAssistantToken = data.token;
      return { success: true, token: data.token };
    }
    return { success: false, error: data?.error || 'Invalid Assistant credentials.' };
  } catch {
    return { success: false, error: 'Authentication server unreachable.' };
  }
}

/**
 * Triggers server-side Firestore role synchronization for an ALREADY verified
 * admin or assistant session. Never writes directly to admins/{uid} from the client.
 */
export async function ensureFirestoreAdminClaim(explicitToken?: string): Promise<boolean> {
  const tokenToVerify = explicitToken || inMemoryAssistantToken || inMemoryAdminToken;
  try {
    const firebaseUid = await getCurrentFirebaseUid();
    const res = await fetch('/api/admin-verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(tokenToVerify ? { Authorization: `Bearer ${tokenToVerify}` } : {})
      },
      credentials: 'include',
      body: JSON.stringify({
        token: tokenToVerify || undefined,
        firebaseUid
      })
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data?.isAdmin || data?.isAssistant);
  } catch {
    return false;
  }
}

export async function logoutAdminSession(): Promise<void> {
  const firebaseUid = await getCurrentFirebaseUid();
  clearInMemoryAdminSession();
  try {
    await fetch('/api/admin-gate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'logout', firebaseUid })
    });
  } catch {
    // ignore
  }
}

export async function clearAssistantFirestoreClaim(): Promise<void> {
  inMemoryAssistantToken = null;
  try {
    const firebaseUid = await getCurrentFirebaseUid();
    await fetch('/api/admin-gate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout', firebaseUid })
    });
  } catch {
    // ignore
  }
}

export async function updateAdminLimit(newLimit: number): Promise<boolean> {
  try {
    const res = await fetch('/api/admin-update-limit', {
      method: 'POST',
      headers: buildAuthHeaders('admin'),
      credentials: 'include',
      body: JSON.stringify({ maxAdmins: newLimit })
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data?.success);
  } catch {
    return false;
  }
}

export async function revokeAdminDevice(adminDeviceId: string): Promise<boolean> {
  try {
    const firebaseUid = await getCurrentFirebaseUid();
    const res = await fetch('/api/admin-revoke', {
      method: 'POST',
      headers: buildAuthHeaders('admin'),
      credentials: 'include',
      body: JSON.stringify({ adminDeviceId, firebaseUid })
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data?.success && adminDeviceId === inMemoryAdminDeviceId) {
      clearInMemoryAdminSession();
    }
    return Boolean(data?.success);
  } catch {
    return false;
  }
}

export async function getAssistantCredentialsMeta(): Promise<AssistantCredentialsMeta> {
  try {
    const res = await fetch('/api/admin-assistant-creds', {
      method: 'GET',
      headers: buildAuthHeaders('admin'),
      credentials: 'include'
    });
    if (!res.ok) {
      return { usernameDisplay: 'Not configured', isCustom: false };
    }
    const data = await res.json();
    return {
      usernameDisplay: data?.usernameDisplay || 'Not configured',
      isCustom: Boolean(data?.isCustom),
      updatedAt: data?.updatedAt
    };
  } catch {
    return { usernameDisplay: 'Not configured', isCustom: false };
  }
}

export async function updateAssistantCredentials(
  newUsername: string,
  newPassword: string
): Promise<{ success: boolean; error?: string; usernameDisplay?: string; updatedAt?: string }> {
  try {
    const res = await fetch('/api/admin-assistant-creds', {
      method: 'POST',
      headers: buildAuthHeaders('admin'),
      credentials: 'include',
      body: JSON.stringify({ username: newUsername, password: newPassword })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success) {
      return {
        success: true,
        usernameDisplay: data.usernameDisplay,
        updatedAt: data.updatedAt
      };
    }
    return { success: false, error: data?.error || 'Failed to update assistant credentials.' };
  } catch {
    return { success: false, error: 'Server unreachable.' };
  }
}

export async function resetAssistantCredentials(): Promise<boolean> {
  try {
    const res = await fetch('/api/admin-assistant-creds', {
      method: 'POST',
      headers: buildAuthHeaders('admin'),
      credentials: 'include',
      body: JSON.stringify({ action: 'reset' })
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data?.success);
  } catch {
    return false;
  }
}
