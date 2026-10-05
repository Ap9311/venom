/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFingerprint, getDeviceImei, getDeviceDetails, getPureDeviceOS, getClientIp } from './ip';
import { murmurX64Hash128 } from '@fingerprintjs/fingerprintjs';

export interface AdminDevice {
  adminDeviceId: string;
  userImei: string;
  os: string;
  deviceDetails: string;
  ip: string;
  registeredAt: string;
  label: string;
  status: 'active' | 'revoked';
}

export interface AdminConfig {
  maxAdmins: number;
  updatedAt?: string;
  updatedBy?: string;
}

const ADMIN_SALT = 'VENOM_ADMIN_HARDWARE_KEY_2026_SECURE_HASH';
let cachedAdminDeviceId: string | null = null;

/**
 * Ensures that the active Firebase Auth session is authenticated as admin via Custom Token.
 */
export async function ensureFirestoreAdminClaim(customToken?: string): Promise<boolean> {
  try {
    if (!auth) return false;

    if (customToken) {
      try {
        await signInWithCustomToken(auth, customToken);
        return true;
      } catch (e) {
        console.warn('Custom token sign-in warning:', e);
      }
    }

    if (auth.currentUser) {
      try {
        const tokenResult = await auth.currentUser.getIdTokenResult(true);
        if (tokenResult.claims && tokenResult.claims.admin === true) {
          return true;
        }
      } catch {}
    }

    return false;
  } catch (err) {
    console.warn("Could not set Firestore admin claim:", err);
    return false;
  }
}

/**
 * Computes a permanent hardware-derived Admin Device Fingerprint ID.
 */
export async function getAdminDeviceId(): Promise<string> {
  if (cachedAdminDeviceId) {
    return cachedAdminDeviceId;
  }

  const rawHardwareFp = await getFingerprint();
  const adminHash = murmurX64Hash128(`${rawHardwareFp}|${ADMIN_SALT}`);
  const idSuffix = adminHash.substring(0, 12).toUpperCase();
  const adminId = `ADM-${idSuffix}`;

  cachedAdminDeviceId = adminId;
  try {
    localStorage.setItem('venom_admin_device_id', adminId);
  } catch {}

  return adminId;
}

/**
 * Checks if the current physical device has an active registered admin identity.
 * Zero-Trust verification: Strictly verified via backend server API.
 */
export async function checkIsAdminDevice(): Promise<boolean> {
  try {
    const adminDeviceId = await getAdminDeviceId();
    if (!adminDeviceId) return false;

    const sessionToken = sessionStorage.getItem('venom_admin_token');
    if (!sessionToken) return false;

    const res = await fetch('/api/admin-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken, adminDeviceId })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.isAdmin === true) {
        sessionStorage.setItem('venom_admin_auth', 'true');
        localStorage.setItem('venom_is_admin_device', 'true');
        return true;
      }
    }

    // Revoked or invalid session token
    sessionStorage.removeItem('venom_admin_auth');
    sessionStorage.removeItem('venom_admin_token');
    localStorage.removeItem('venom_is_admin_device');
    return false;
  } catch (error) {
    console.warn('Failed to check admin device status:', error);
    return false;
  }
}

/**
 * Retrieves current admin limits and list of registered admin devices.
 */
export async function getAdminConfig(): Promise<{
  maxAdmins: number;
  registeredCount: number;
  isFull: boolean;
  registeredDevices: AdminDevice[];
}> {
  try {
    let maxAdmins = 3;

    if (!db) {
      return { maxAdmins: 3, registeredCount: 0, isFull: false, registeredDevices: [] };
    }

    try {
      const configRef = doc(db, 'interactions', 'admin_global_config');
      const configSnap = await getDoc(configRef);
      if (configSnap.exists()) {
        const confData = configSnap.data();
        if (typeof confData.maxAdmins === 'number' && confData.maxAdmins > 0) {
          maxAdmins = confData.maxAdmins;
        }
      }
    } catch (e) {
      console.warn('Could not read admin_global_config, defaulting to 3:', e);
    }

    const registeredDevices: AdminDevice[] = [];
    try {
      const q = query(collection(db, 'interactions'), where('type', '==', 'admin_device'));
      const snap = await getDocs(q);

      snap.forEach((d) => {
        const data = d.data() as any;
        if (data && data.status === 'active' && data.adminDeviceId) {
          registeredDevices.push({
            adminDeviceId: data.adminDeviceId,
            userImei: data.userImei || '',
            os: data.os || 'Unknown OS',
            deviceDetails: data.deviceDetails || '',
            ip: data.ip || '',
            registeredAt: data.registeredAt || new Date().toISOString(),
            label: data.label || 'Admin Device',
            status: data.status || 'active'
          });
        }
      });
    } catch (e) {
      console.warn('Failed to query admin devices via where query:', e);
    }

    registeredDevices.sort((a, b) => new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime());

    const registeredCount = registeredDevices.length;
    const isFull = registeredCount >= maxAdmins;

    return {
      maxAdmins,
      registeredCount,
      isFull,
      registeredDevices
    };
  } catch (err) {
    console.error('Failed to retrieve admin config:', err);
    return { maxAdmins: 3, registeredCount: 0, isFull: false, registeredDevices: [] };
  }
}

/**
 * Authenticates username & password securely via backend server and registers
 * this physical device as an administrative device.
 * NO client-side fallback credentials or hardcoded secrets.
 */
export async function registerAdminDevice(
  usernameInput: string,
  passwordInput: string
): Promise<{ success: boolean; error?: string; adminDeviceId?: string }> {
  const cleanUser = usernameInput.trim();
  const cleanPass = passwordInput.trim();

  if (!cleanUser || !cleanPass) {
    return { success: false, error: 'Username and password are required.' };
  }

  try {
    const adminDeviceId = await getAdminDeviceId();
    const userImei = await getDeviceImei();
    const os = getPureDeviceOS();
    const deviceDetails = getDeviceDetails();
    const ip = await getClientIp();

    const serverRes = await fetch('/api/admin-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: cleanUser,
        password: cleanPass,
        adminDeviceId,
        userImei,
        os,
        ip
      })
    });

    let regData: any = {};
    try {
      const rawText = await serverRes.text();
      regData = rawText ? JSON.parse(rawText) : {};
    } catch {
      regData = {};
    }

    if (!serverRes.ok || !regData.success) {
      return { success: false, error: regData.error || 'Access Denied: Invalid credentials.' };
    }

    if (regData.sessionToken) {
      sessionStorage.setItem('venom_admin_token', regData.sessionToken);
      sessionStorage.setItem('venom_admin_auth', 'true');
      localStorage.setItem('venom_is_admin_device', 'true');
    }

    if (regData.customToken) {
      await ensureFirestoreAdminClaim(regData.customToken);
    }

    return { success: true, adminDeviceId };
  } catch (err: any) {
    console.error('Failed to register admin device:', err);
    return { success: false, error: err?.message || 'Security server error during registration.' };
  }
}

/**
 * Validates administrator credentials against the server.
 * NO hardcoded fallback credentials or client secrets.
 */
export async function verifyAdminCredentials(
  usernameInput: string,
  passwordInput: string
): Promise<{ success: boolean; error?: string }> {
  const u = usernameInput.trim();
  const p = passwordInput.trim();

  if (!u || !p) {
    return { success: false, error: 'Username and password are required.' };
  }

  try {
    const adminDeviceId = await getAdminDeviceId();
    const res = await fetch('/api/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: u,
        password: p,
        adminDeviceId
      })
    });

    let data: any = {};
    try {
      const rawText = await res.text();
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      data = {};
    }

    if (res.ok && data.success) {
      if (data.sessionToken) {
        sessionStorage.setItem('venom_admin_token', data.sessionToken);
        sessionStorage.setItem('venom_admin_auth', 'true');
        localStorage.setItem('venom_is_admin_device', 'true');
      }
      if (data.customToken) {
        await ensureFirestoreAdminClaim(data.customToken);
      }
      return { success: true };
    }

    return { success: false, error: data.error || 'Invalid administrator credentials.' };
  } catch {
    return { success: false, error: 'Authentication server unreachable.' };
  }
}

/**
 * Updates maximum allowed admin devices in Firestore.
 */
export async function updateAdminLimit(newMax: number): Promise<boolean> {
  if (typeof newMax !== 'number' || newMax < 1) return false;
  try {
    const sessionToken = sessionStorage.getItem('venom_admin_token');
    const res = await fetch('/api/admin-update-limit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken, maxAdmins: newMax })
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to update admin limit:', err);
    return false;
  }
}

/**
 * Revokes an admin device, freeing up its slot.
 */
export async function revokeAdminDevice(deviceId: string): Promise<boolean> {
  try {
    const sessionToken = sessionStorage.getItem('venom_admin_token');
    const res = await fetch('/api/admin-revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken, adminDeviceId: deviceId })
    });

    const currentId = await getAdminDeviceId();
    if (currentId === deviceId) {
      sessionStorage.removeItem('venom_admin_auth');
      sessionStorage.removeItem('venom_admin_token');
      localStorage.removeItem('venom_is_admin_device');
    }

    window.dispatchEvent(new Event('storage'));
    return res.ok;
  } catch (err) {
    console.error('Failed to revoke admin device:', err);
    return false;
  }
}
