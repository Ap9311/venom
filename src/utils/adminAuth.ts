/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, onSnapshot } from 'firebase/firestore';
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
 * Checks if the current physical device has an active registered admin identity in Firestore.
 */
export async function checkIsAdminDevice(): Promise<boolean> {
  try {
    const adminDeviceId = await getAdminDeviceId();
    if (!adminDeviceId || !db) return false;

    // Check directly in admin_devices collection
    const deviceDocRef = doc(db, 'admin_devices', adminDeviceId);
    const snap = await getDoc(deviceDocRef);

    if (snap.exists()) {
      const data = snap.data();
      return data.status === 'active';
    }

    return false;
  } catch (error) {
    console.error('Failed to check admin device status:', error);
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
    if (!db) {
      return { maxAdmins: 3, registeredCount: 0, isFull: false, registeredDevices: [] };
    }

    // 1. Fetch admin config settings (defaults maxAdmins = 3 if missing)
    let maxAdmins = 3;
    try {
      const configRef = doc(db, 'admin_config', 'settings');
      const configSnap = await getDoc(configRef);
      if (configSnap.exists()) {
        const confData = configSnap.data();
        if (typeof confData.maxAdmins === 'number' && confData.maxAdmins > 0) {
          maxAdmins = confData.maxAdmins;
        }
      } else {
        // Initialize default configuration
        await setDoc(configRef, {
          maxAdmins: 3,
          createdAt: new Date().toISOString()
        }, { merge: true });
      }
    } catch (e) {
      console.warn('Could not read admin_config, defaulting to 3:', e);
    }

    // 2. Fetch all active registered admin devices
    const devicesRef = collection(db, 'admin_devices');
    const snap = await getDocs(devicesRef);
    const registeredDevices: AdminDevice[] = [];

    snap.forEach((d) => {
      const data = d.data() as AdminDevice;
      if (data && data.status === 'active') {
        registeredDevices.push(data);
      }
    });

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
  // Validate exact user-requested credentials
  const cleanUser = usernameInput.trim();
  const cleanPass = passwordInput.trim();

  if (cleanUser !== 'theakshatpopat' || cleanPass !== 'Aprt9311') {
    return { success: false, error: 'Access Denied: Invalid Administrative Credentials.' };
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
    const deviceDocRef = doc(db, 'admin_devices', adminDeviceId);
    const existingSnap = await getDoc(deviceDocRef);

    if (existingSnap.exists() && existingSnap.data().status === 'active') {
      // Already an active admin device!
      sessionStorage.setItem('venom_admin_auth', 'true');
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

    // Register this device permanently in Firestore
    const newAdminDevice: AdminDevice = {
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

    // Save session flag
    sessionStorage.setItem('venom_admin_auth', 'true');
    try {
      localStorage.setItem('venom_is_admin_device', 'true');
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
    const configRef = doc(db, 'admin_config', 'settings');
    await setDoc(configRef, {
      maxAdmins: newMax,
      updatedAt: new Date().toISOString()
    }, { merge: true });
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
    const deviceDocRef = doc(db, 'admin_devices', deviceId);
    await deleteDoc(deviceDocRef);

    // If revoking current device, clear local session
    const currentId = await getAdminDeviceId();
    if (currentId === deviceId) {
      sessionStorage.removeItem('venom_admin_auth');
      try {
        localStorage.removeItem('venom_is_admin_device');
      } catch {}
    }
    return true;
  } catch (err) {
    console.error('Failed to revoke admin device:', err);
    return false;
  }
}
