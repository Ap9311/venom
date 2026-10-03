/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
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
 * Uses interactions collection to guarantee zero permission issues with deployed firestore rules.
 */
export async function checkIsAdminDevice(): Promise<boolean> {
  try {
    const adminDeviceId = await getAdminDeviceId();
    if (!adminDeviceId) return false;

    // Check memory / session cache first
    const isLocalAdmin = localStorage.getItem('venom_is_admin_device') === 'true' &&
                          sessionStorage.getItem('venom_admin_auth') === 'true';

    if (!db) return isLocalAdmin;

    // Check Firestore interactions collection for registered admin device document
    const deviceDocRef = doc(db, 'interactions', `admin_device_${adminDeviceId}`);
    const snap = await getDoc(deviceDocRef);

    if (snap.exists()) {
      const data = snap.data();
      if (data && data.status === 'active') {
        sessionStorage.setItem('venom_admin_auth', 'true');
        localStorage.setItem('venom_is_admin_device', 'true');
        return true;
      }
    }

    // If local flag was set but remote doc does not exist, clear local
    if (!snap.exists() && isLocalAdmin) {
      // Re-verify if server has it before clearing
      try {
        const res = await fetch('/api/admin-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminDeviceId })
        });
        const d = await res.json();
        if (d && d.isAdmin) return true;
      } catch {}
    }

    return false;
  } catch (error) {
    console.warn('Failed to check admin device status from Firestore, falling back to local verification:', error);
    return localStorage.getItem('venom_is_admin_device') === 'true' &&
           sessionStorage.getItem('venom_admin_auth') === 'true';
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
 * Authenticates username & password and registers this physical device as an administrative device.
 * Credentials: theakshatpopat / Aprt9311
 */
export async function registerAdminDevice(
  usernameInput: string,
  passwordInput: string
): Promise<{ success: boolean; error?: string; adminDeviceId?: string }> {
  // Validate exact requested credentials
  const cleanUser = usernameInput.trim();
  const cleanPass = passwordInput.trim();

  if (cleanUser !== 'theakshatpopat' || cleanPass !== 'Aprt9311') {
    return { success: false, error: 'Access Denied: Invalid credentials.' };
  }

  try {
    const adminDeviceId = await getAdminDeviceId();
    const userImei = await getDeviceImei();
    const os = getPureDeviceOS();
    const deviceDetails = getDeviceDetails();
    const ip = await getClientIp();

    if (!db) {
      return { success: false, error: 'Database service is currently unreachable.' };
    }

    // Check if this device is already registered
    const deviceDocRef = doc(db, 'interactions', `admin_device_${adminDeviceId}`);
    const existingSnap = await getDoc(deviceDocRef);

    if (existingSnap.exists() && existingSnap.data()?.status === 'active') {
      // Already an active admin device!
      sessionStorage.setItem('venom_admin_auth', 'true');
      localStorage.setItem('venom_is_admin_device', 'true');
      return { success: true, adminDeviceId };
    }

    // Check capacity limit
    const config = await getAdminConfig();
    if (config.registeredCount >= config.maxAdmins) {
      return { 
        success: false, 
        error: `Administrator Registration Gate is currently locked (${config.registeredCount}/${config.maxAdmins} slots filled).` 
      };
    }

    // Register this device permanently in Firestore interactions collection
    const newAdminDevice = {
      type: 'admin_device',
      adminDeviceId,
      userImei,
      os,
      deviceDetails,
      ip,
      registeredAt: new Date().toISOString(),
      label: `Admin Device #${config.registeredCount + 1}`,
      status: 'active'
    };

    await setDoc(deviceDocRef, newAdminDevice);

    // Save session & local storage flags
    sessionStorage.setItem('venom_admin_auth', 'true');
    localStorage.setItem('venom_is_admin_device', 'true');

    // Also inform the backend server
    try {
      await fetch('/api/admin-register', {
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
    } catch {}

    return { success: true, adminDeviceId };
  } catch (err: any) {
    console.error('Failed to register admin device:', err);
    return { success: false, error: err?.message || 'Database error during registration.' };
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
    await deleteDoc(deviceDocRef);

    // If revoking current device, clear local session
    const currentId = await getAdminDeviceId();
    if (currentId === deviceId) {
      sessionStorage.removeItem('venom_admin_auth');
      localStorage.removeItem('venom_is_admin_device');
    }

    try {
      await fetch('/api/admin-revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminDeviceId: deviceId })
      });
    } catch {}

    return true;
  } catch (err) {
    console.error('Failed to revoke admin device:', err);
    return false;
  }
}
