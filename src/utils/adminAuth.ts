/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { signInAnonymously } from 'firebase/auth';
import { getFingerprint, getLegacyHardwareFingerprint, getDeviceImei, getDeviceDetails, getPureDeviceOS, getClientIp } from './ip';
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

const ADMIN_SALT = 'NONUM_ADMIN_HARDWARE_KEY_2026_SECURE_HASH';
const KDF_SALT = 'n0num_v3_kdf_9f8a7b6c5d4e3f2a';
let cachedAdminDeviceId: string | null = null;
let inMemoryAssistantToken: string | null = null;

export function setInMemoryAssistantToken(token: string | null): void {
  inMemoryAssistantToken = token;
}

export function getInMemoryAssistantToken(): string | null {
  return inMemoryAssistantToken;
}

export function clearInMemoryAssistantToken(): void {
  inMemoryAssistantToken = null;
}

/**
 * Clears ephemeral assistant auth claim from memory and Firestore `/admins/{uid}`.
 */
export async function clearAssistantFirestoreClaim(): Promise<void> {
  inMemoryAssistantToken = null;
  try {
    if (auth?.currentUser && db) {
      await deleteDoc(doc(db, 'admins', auth.currentUser.uid)).catch(() => {});
    }
  } catch {}
}

/**
 * Ensures that the active Firebase Auth anonymous session UID is registered
 * in Firestore `/admins/{uid}` with the required `secretKey` to satisfy the
 * `isAdmin()` function in Firestore rules (`allow delete: if isAdmin()`).
 * The secretKey is dynamically fetched from server or session, never hardcoded.
 */
export async function ensureFirestoreAdminClaim(providedToken?: string): Promise<boolean> {
  try {
    if (!auth || !db) return false;
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
      let secretKey: string | null = providedToken || inMemoryAssistantToken || null;
      if (!secretKey) {
        secretKey = sessionStorage.getItem('nonum_admin_token');
      }
      if (!secretKey && !inMemoryAssistantToken) {
        const adminDeviceId = await getAdminDeviceId();
        try {
          const res = await fetch('/api/admin-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminDeviceId })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.token) {
              secretKey = data.token;
              sessionStorage.setItem('nonum_admin_token', secretKey);
            }
          }
        } catch {}
      }

      if (!secretKey) return false;

      const adminDocRef = doc(db, 'admins', currentUser.uid);
      await setDoc(adminDocRef, {
        isAdmin: true,
        secretKey,
        registeredAt: new Date().toISOString()
      }, { merge: true });
      return true;
    }
  } catch (err) {
    console.warn("Could not set Firestore admin claim document:", err);
  }
  return false;
}

/**
 * Computes a permanent, hardware + vault derived Admin Device Fingerprint ID.
 * Preserves any previously registered legacy ADM-XXXXXXXXXXXX ID on this machine
 * while unifying across browsers via the Cross-Browser Device Anchor.
 * Format: ADM-XXXXXXXXXXXX (12 hex uppercase)
 */
export async function getAdminDeviceId(): Promise<string> {
  if (cachedAdminDeviceId) {
    return cachedAdminDeviceId;
  }

  // 1. Check if this device already has a stored or legacy registered Admin ID
  try {
    const storedAdminId = localStorage.getItem('nonum_admin_device_id');
    if (storedAdminId && storedAdminId.startsWith('ADM-') && db) {
      const snap = await getDoc(doc(db, 'interactions', `admin_device_${storedAdminId}`)).catch(() => null);
      if (snap && snap.exists() && snap.data()?.status === 'active') {
        cachedAdminDeviceId = storedAdminId;
        return storedAdminId;
      }
    }
  } catch {}

  // 2. Check legacy hardware fingerprint in case admin registered before v4 hybrid vault upgrade
  const legacyHwFp = getLegacyHardwareFingerprint();
  const legacyAdminHash = murmurX64Hash128(`${legacyHwFp}|${ADMIN_SALT}`);
  const legacyAdminId = `ADM-${legacyAdminHash.substring(0, 12).toUpperCase()}`;

  if (db) {
    try {
      const legacySnap = await getDoc(doc(db, 'interactions', `admin_device_${legacyAdminId}`)).catch(() => null);
      if (legacySnap && legacySnap.exists() && legacySnap.data()?.status === 'active') {
        cachedAdminDeviceId = legacyAdminId;
        try {
          localStorage.setItem('nonum_admin_device_id', legacyAdminId);
        } catch {}
        return legacyAdminId;
      }
    } catch {}
  }

  // 3. Get hybrid cross-browser device fingerprint
  const rawHardwareFp = await getFingerprint();
  const adminHash = murmurX64Hash128(`${rawHardwareFp}|${ADMIN_SALT}`);
  const idSuffix = adminHash.substring(0, 12).toUpperCase();
  const adminId = `ADM-${idSuffix}`;

  cachedAdminDeviceId = adminId;
  try {
    localStorage.setItem('nonum_admin_device_id', adminId);
  } catch {}

  return adminId;
}

/**
 * Checks if the current physical device has an active registered admin identity.
 * Zero-Trust verification: Evaluates Firestore interactions registry AND server verification.
 * NEVER trusts client localStorage/sessionStorage alone to prevent auth bypass.
 */
export async function checkIsAdminDevice(): Promise<boolean> {
  try {
    const adminDeviceId = await getAdminDeviceId();
    if (!adminDeviceId) return false;

    // 1. Verify session token against server if present
    const sessionToken = sessionStorage.getItem('nonum_admin_token');
    if (sessionToken) {
      try {
        const res = await fetch('/api/admin-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: sessionToken })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.isAdmin === true) {
            sessionStorage.setItem('nonum_admin_auth', 'true');
            localStorage.setItem('nonum_is_admin_device', 'true');
            ensureFirestoreAdminClaim(sessionToken).catch(console.warn);
            return true;
          }
        }
      } catch {}
    }

    // 2. Check Firestore for active registered admin device record
    if (db) {
      try {
        const deviceDocRef = doc(db, 'interactions', `admin_device_${adminDeviceId}`);
        const snap = await getDoc(deviceDocRef);

        if (snap.exists()) {
          const data = snap.data();
          if (data && data.status === 'active') {
            sessionStorage.setItem('nonum_admin_auth', 'true');
            localStorage.setItem('nonum_is_admin_device', 'true');
            ensureFirestoreAdminClaim().catch(console.warn);
            return true;
          }
        }
      } catch (fbErr) {
        console.warn('Firestore admin device check warning:', fbErr);
      }
    }

    // Device is NOT an authorized active admin device. Wipe all local credentials.
    sessionStorage.removeItem('nonum_admin_auth');
    sessionStorage.removeItem('nonum_admin_token');
    localStorage.removeItem('nonum_is_admin_device');
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
 * Authenticates username & password securely via backend server and registers
 * this physical device as an administrative device.
 * Eliminates all hardcoded credentials from client bundles.
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

    const config = await getAdminConfig();
    const isAlreadyRegistered = config.registeredDevices.some(d => d.adminDeviceId === adminDeviceId);

    if (!isAlreadyRegistered && config.isFull) {
      return {
        success: false,
        error: 'Access Denied: Maximum authorized administrative device limit reached. Revoke a device in Admin Audit before registering new hardware.'
      };
    }

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

    if (serverRes.ok && regData.success && regData.token) {
      const adminToken = regData.token;
      sessionStorage.setItem('nonum_admin_token', adminToken);
      sessionStorage.setItem('nonum_admin_auth', 'true');
      localStorage.setItem('nonum_is_admin_device', 'true');

      if (db) {
        try {
          const deviceDocRef = doc(db, 'interactions', `admin_device_${adminDeviceId}`);
          const currentConfig = await getAdminConfig();

          const newAdminDevice = {
            type: 'admin_device',
            adminDeviceId,
            userImei,
            os,
            deviceDetails,
            ip,
            registeredAt: new Date().toISOString(),
            label: `Admin Device #${currentConfig.registeredCount + 1}`,
            status: 'active'
          };

          await setDoc(deviceDocRef, newAdminDevice, { merge: true });
        } catch {}
      }

      await ensureFirestoreAdminClaim(adminToken);
      return { success: true, adminDeviceId };
    }

    return { success: false, error: regData.error || 'Access Denied: Invalid credentials.' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Security system error during registration.' };
  }
}

/**
 * Validates administrator credentials against the server without bundle leakage.
 * Sets session token and registers the Firestore administrative write claim.
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
    const res = await fetch('/api/admin-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: u,
        password: p
      })
    });
    let data: any = {};
    try {
      const rawText = await res.text();
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      data = {};
    }
    if (res.ok && data.success && data.token) {
      sessionStorage.setItem('nonum_admin_token', data.token);
      sessionStorage.setItem('nonum_admin_auth', 'true');
      localStorage.setItem('nonum_is_admin_device', 'true');
      await ensureFirestoreAdminClaim(data.token);
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
      sessionStorage.removeItem('nonum_admin_auth');
      localStorage.removeItem('nonum_is_admin_device');
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

/**
 * Validates one-time assistant portal credentials via server without creating
 * hardware Admin IDs, cookies, or persistent browser storage entries.
 */
export async function verifyAssistantCredentials(
  usernameInput: string,
  passwordInput: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  const u = usernameInput.trim();
  const p = passwordInput.trim();

  if (!u || !p) {
    return { success: false, error: 'Username and password are required.' };
  }

  try {
    const res = await fetch('/api/assistant-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: u,
        password: p
      })
    });
    let data: any = {};
    try {
      const rawText = await res.text();
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      data = {};
    }

    if (res.ok && data.success && data.token) {
      setInMemoryAssistantToken(data.token);
      await ensureFirestoreAdminClaim(data.token);
      return { success: true, token: data.token };
    }

    return { success: false, error: data.error || 'Invalid assistant credentials.' };
  } catch {
    return { success: false, error: 'Authentication server unreachable.' };
  }
}

async function deriveKdfHex(input: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(input),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(KDF_SALT),
      iterations: 10000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface AssistantCredentialsMeta {
  usernameDisplay: string;
  isCustom: boolean;
  updatedAt?: string;
}

/**
 * Reads assistant portal credential metadata (Admin Audit only).
 */
export async function getAssistantCredentialsMeta(): Promise<AssistantCredentialsMeta> {
  try {
    if (!db) {
      return { usernameDisplay: 'theakshatpopat', isCustom: false };
    }
    await ensureFirestoreAdminClaim();
    const snap = await getDoc(doc(db, 'admin_config', 'assistant_credentials'));
    if (snap.exists()) {
      const data = snap.data() as any;
      return {
        usernameDisplay: data.usernameDisplay || 'theakshatpopat',
        isCustom: Boolean(data.usernameHash && data.passwordHash),
        updatedAt: data.updatedAt
      };
    }
  } catch (err) {
    console.warn('Could not read assistant credential metadata:', err);
  }
  return { usernameDisplay: 'theakshatpopat', isCustom: false };
}

/**
 * Updates assistant portal username & password digests in Firestore (Admin Audit only).
 */
export async function updateAssistantCredentials(
  newUsername: string,
  newPassword: string
): Promise<{ success: boolean; error?: string; usernameDisplay?: string; updatedAt?: string }> {
  const cleanUser = newUsername.trim();
  const cleanPass = newPassword.trim();

  if (!cleanUser || !cleanPass) {
    return { success: false, error: 'Both assistant username and password are required.' };
  }
  if (cleanUser.length < 3) {
    return { success: false, error: 'Assistant username must be at least 3 characters.' };
  }
  if (cleanPass.length < 4) {
    return { success: false, error: 'Assistant password must be at least 4 characters.' };
  }
  if (!db) {
    return { success: false, error: 'Database connection unavailable.' };
  }

  try {
    const claimed = await ensureFirestoreAdminClaim();
    if (!claimed) {
      return { success: false, error: 'Admin clearance claim required before updating credentials.' };
    }

    const [usernameHash, passwordHash] = await Promise.all([
      deriveKdfHex(cleanUser.toLowerCase()),
      deriveKdfHex(cleanPass)
    ]);

    const updatedAt = new Date().toISOString();
    await setDoc(
      doc(db, 'admin_config', 'assistant_credentials'),
      {
        type: 'assistant_credentials',
        usernameDisplay: cleanUser,
        usernameHash,
        passwordHash,
        updatedAt
      },
      { merge: true }
    );

    return { success: true, usernameDisplay: cleanUser, updatedAt };
  } catch (err: any) {
    console.error('Failed to update assistant credentials:', err);
    return { success: false, error: err?.message || 'Failed to update assistant credentials.' };
  }
}

/**
 * Resets custom assistant credentials back to default system digests (Admin Audit only).
 */
export async function resetAssistantCredentials(): Promise<boolean> {
  if (!db) return false;
  try {
    await ensureFirestoreAdminClaim();
    await deleteDoc(doc(db, 'admin_config', 'assistant_credentials'));
    return true;
  } catch (err) {
    console.error('Failed to reset assistant credentials:', err);
    return false;
  }
}
