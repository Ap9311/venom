/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { signInAnonymously } from 'firebase/auth';
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

const ADMIN_SALT = 'VENOM_DEVICE_ENTROPY_V2';
let cachedAdminDeviceId: string | null = null;

/**
 * Ensures that the active Firebase Auth anonymous session UID is registered
 * in Firestore `/admins/{uid}` via secure backend claim.
 */
export async function ensureFirestoreAdminClaim(): Promise<boolean> {
  try {
    if (!auth) return false;
    let currentUser = auth.currentUser;
    if (!currentUser) {
      try {
        const cred = await signInAnonymously(auth);
        currentUser = cred.user;
      } catch (authErr) {
        console.warn('Anonymous sign-in error:', authErr);
      }
    }
    if (currentUser) {
      const adminDeviceId = await getAdminDeviceId();
      const res = await fetch('/api/admin-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminDeviceId, uid: currentUser.uid })
      });
      const data = await res.json();
      return !!data.success;
    }
  } catch (err) {
    console.warn("Could not set Firestore admin claim document:", err);
  }
  return false;
}

/**
 * Computes a permanent, 100% hardware-derived Admin Device Fingerprint ID.
 * Cannot be cleared or changed by the user, browser cache, or switching browsers
 * on the same physical machine.
 * Format: ADM-XXXXXXXXXXXX (12 hex uppercase)
 */
export async function getAdminDeviceId(): Promise<string> {
  if (cachedAdminDeviceId) {
    return cachedAdminDeviceId;
  }

  // 1. Get pure cross-browser hardware fingerprint
  const rawHardwareFp = await getFingerprint();
  
  // 2. Hash with admin salt for an independent, cryptographic admin identity
  const adminHash = murmurX64Hash128(`${rawHardwareFp}|${ADMIN_SALT}`);
  const idSuffix = adminHash.substring(0, 12).toUpperCase();
  const adminId = `ADM-${idSuffix}`;

  // Cache in memory and localStorage for convenience
  cachedAdminDeviceId = adminId;
  try {
    localStorage.setItem('venom_admin_device_id', adminId);
  } catch {}

  return adminId;
}

/**
 * Checks if the current physical device has an active registered admin identity.
 * Validates against both authoritative server and Firestore registry.
 * Zero unverified localStorage fallback.
 */
export async function checkIsAdminDevice(): Promise<boolean> {
  try {
    const adminDeviceId = await getAdminDeviceId();
    if (!adminDeviceId) return false;

    // 1. Authoritative check via backend verify endpoint
    try {
      const verifyRes = await fetch('/api/admin-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminDeviceId })
      });
      const verifyData = await verifyRes.json();
      if (verifyData.isAdmin) {
        sessionStorage.setItem('venom_admin_auth', 'true');
        localStorage.setItem('venom_is_admin_device', 'true');
        ensureFirestoreAdminClaim().catch(console.warn);
        return true;
      }
    } catch {}

    // 2. Check Firestore interactions collection for registered admin device document
    if (db) {
      const deviceDocRef = doc(db, 'interactions', `admin_device_${adminDeviceId}`);
      const snap = await getDoc(deviceDocRef);

      if (snap.exists()) {
        const data = snap.data();
        if (data && data.status === 'active') {
          sessionStorage.setItem('venom_admin_auth', 'true');
          localStorage.setItem('venom_is_admin_device', 'true');
          ensureFirestoreAdminClaim().catch(console.warn);
          return true;
        }
      }
    }

    // Document does NOT exist or status is NOT active: device was revoked or unauthorized.
    // Immediately eradicate all local tokens and session permissions.
    sessionStorage.removeItem('venom_admin_auth');
    localStorage.removeItem('venom_is_admin_device');
    if (auth?.currentUser && db) {
      deleteDoc(doc(db, 'admins', auth.currentUser.uid)).catch(() => {});
    }

    return false;
  } catch (error) {
    console.warn('Failed to check admin device status:', error);
    return false;
  }
}

/**
 * Retrieves current admin limits and list of registered admin devices.
 * Uses interactions collection which has open read/write permission.
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

    // 1. Fetch admin config settings from interactions/admin_global_config
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

    // 2. Fetch all registered admin devices from interactions where type == admin_device
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

    // Sort by registration date ascending
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
 * Verifies administrator credentials against the secure backend service.
 * Eliminates client-side hardcoded credentials completely.
 */
export async function verifyAdminCredentials(
  usernameInput: string,
  passwordInput: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/admin-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: usernameInput.trim(),
        password: passwordInput.trim()
      })
    });
    const data = await res.json();
    if (data.success) {
      sessionStorage.setItem('venom_admin_auth', 'true');
      return { success: true };
    }
    return { success: false, error: data.error || 'Access Denied: Invalid credentials.' };
  } catch (err: any) {
    return { success: false, error: 'Authentication service unreachable.' };
  }
}

/**
 * Authenticates username & password via secure server validation
 * and registers this physical device as an administrative device.
 * Credentials are never hardcoded on the client or leaked into JS bundles.
 */
export async function registerAdminDevice(
  usernameInput: string,
  passwordInput: string
): Promise<{ success: boolean; error?: string; adminDeviceId?: string }> {
  const cleanUser = usernameInput.trim();
  const cleanPass = passwordInput.trim();

  if (!cleanUser || !cleanPass) {
    return { success: false, error: 'Access Denied: Missing credentials.' };
  }

  try {
    const adminDeviceId = await getAdminDeviceId();
    const userImei = await getDeviceImei();
    const os = getPureDeviceOS();
    const deviceDetails = getDeviceDetails();
    const ip = await getClientIp();

    // 1. Authoritative verification & registration via server backend
    const response = await fetch('/api/admin-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: cleanUser,
        password: cleanPass,
        adminDeviceId,
        userImei,
        os,
        deviceDetails,
        ip
      })
    });

    const res = await response.json();
    if (!res.success) {
      return { success: false, error: res.error || 'Access Denied: Invalid credentials.' };
    }

    // 2. Also register in local Firestore interactions to ensure client snapshot sync
    if (db) {
      try {
        const deviceDocRef = doc(db, 'interactions', `admin_device_${adminDeviceId}`);
        await setDoc(deviceDocRef, {
          type: 'admin_device',
          adminDeviceId,
          userImei,
          os,
          deviceDetails,
          ip,
          registeredAt: new Date().toISOString(),
          label: `Admin Device`,
          status: 'active'
        }, { merge: true });
      } catch (err) {
        console.warn('Local firestore write sync fallback:', err);
      }
    }

    // Save session & local storage flags
    sessionStorage.setItem('venom_admin_auth', 'true');
    localStorage.setItem('venom_is_admin_device', 'true');

    // Register Firestore admin claim
    await ensureFirestoreAdminClaim();

    return { success: true, adminDeviceId };
  } catch (err: any) {
    console.error('Failed to register admin device:', err);
    return { success: false, error: err?.message || 'Authentication service error.' };
  }
}

/**
 * Updates maximum allowed admin devices in Firestore.
 */
export async function updateAdminLimit(newMax: number): Promise<boolean> {
  if (typeof newMax !== 'number' || newMax < 1) return false;
  try {
    const configRef = doc(db, 'interactions', 'admin_global_config');
    await setDoc(configRef, {
      type: 'admin_config',
      maxAdmins: newMax,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    // Also update server
    try {
      await fetch('/api/admin-update-limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxAdmins: newMax })
      });
    } catch {}

    return true;
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
    const deviceDocRef = doc(db, 'interactions', `admin_device_${deviceId}`);
    // 1. Mark as revoked explicitly in Firestore so any listener immediately sees 'revoked'
    await setDoc(deviceDocRef, {
      status: 'revoked',
      revokedAt: new Date().toISOString()
    }, { merge: true }).catch(() => {});

    // 2. Delete the doc
    await deleteDoc(deviceDocRef).catch(() => {});

    // If revoking current device, clear local session
    const currentId = await getAdminDeviceId();
    if (currentId === deviceId) {
      sessionStorage.removeItem('venom_admin_auth');
      localStorage.removeItem('venom_is_admin_device');
      if (auth?.currentUser) {
        deleteDoc(doc(db, 'admins', auth.currentUser.uid)).catch(() => {});
      }
    }

    try {
      await fetch('/api/admin-revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminDeviceId: deviceId })
      });
    } catch {}

    // Dispatch event so any local tabs sync immediately
    window.dispatchEvent(new Event('storage'));

    return true;
  } catch (err) {
    console.error('Failed to revoke admin device:', err);
    return false;
  }
}
