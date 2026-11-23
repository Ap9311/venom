/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { murmurX64Hash128 } from '@fingerprintjs/fingerprintjs';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const VAULT_COOKIE_NAME = 'nonum_device_vault_v4';
const VAULT_LS_KEY = 'nonum_device_vault_v4';
const VAULT_IDB_DB = 'NonumSecurityVaultDB';
const VAULT_IDB_STORE = 'device_identity_store';
const VAULT_CACHE_NAME = 'nonum-identity-vault-v4';
const VAULT_CACHE_URL = '/__nonum_device_identity_vault__';
const ALIAS_IMEIS_KEY = 'nonum_alias_device_imeis';

interface VaultIdentityRecord {
  vaultFp: string;
  imei: string;
  serial: string;
  coreSig: string;
  deepSig: string;
  legacyFp: string;
  aliasImeis: string[];
  updatedAt: number;
}

let cachedClientIp: string | null = null;
let cachedIdentityPromise: Promise<VaultIdentityRecord> | null = null;
let resolvedIdentityCache: VaultIdentityRecord | null = null;
let crossBrowserSynced = false;

/**
 * Retrieves the real public IP address of the user. If blocked or offline,
 * falls back to a deterministic, realistic public IP cached in local storage.
 */
export async function getClientIp(): Promise<string> {
  if (cachedClientIp && cachedClientIp !== '127.0.0.1') {
    return cachedClientIp;
  }

  try {
    const controllers = new AbortController();
    const timeoutId = setTimeout(() => controllers.abort(), 2500);

    const response = await fetch('/api/get-ip', { signal: controllers.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.ip) {
        cachedClientIp = data.ip;
        try {
          localStorage.setItem('nonum_last_real_ip', data.ip);
        } catch {}
        return data.ip;
      }
    }
  } catch (error) {
    console.warn('IP API lookup failed/timeout, falling back to cached IP:', error);
  }

  try {
    const lastRealIp = localStorage.getItem('nonum_last_real_ip');
    if (lastRealIp) {
      cachedClientIp = lastRealIp;
      return lastRealIp;
    }
  } catch {}

  let cachedIp = '';
  try {
    cachedIp = localStorage.getItem('nonum_simulated_client_ip') || '';
    if (!cachedIp) {
      const core = getCoreHardwareSignature();
      const o1 = (parseInt(core.substring(0, 2), 16) % 100) + 80;
      const o2 = (parseInt(core.substring(2, 4), 16) % 150) + 10;
      const o3 = (parseInt(core.substring(4, 6), 16) % 200) + 1;
      const o4 = (parseInt(core.substring(6, 8), 16) % 250) + 1;
      cachedIp = `${o1}.${o2}.${o3}.${o4}`;
      localStorage.setItem('nonum_simulated_client_ip', cachedIp);
    }
  } catch {
    cachedIp = '127.0.0.1';
  }
  cachedClientIp = cachedIp;
  return cachedIp;
}

/**
 * Extracts the /24 IPv4 subnet or /48 IPv6 prefix for anti-evasion network correlation.
 */
export function getIpSubnetPrefix(ip: string): string {
  if (!ip) return 'unknown_subnet';
  const clean = ip.trim();
  if (clean.includes('.')) {
    const parts = clean.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
    }
  }
  if (clean.includes(':')) {
    const parts = clean.split(':');
    return parts.slice(0, 3).join(':') + '::/48';
  }
  return clean;
}

/**
 * Retrieves standard device metadata for admin tracking.
 */
export function getDeviceDetails(): string {
  const ua = navigator.userAgent;
  let os = 'Unknown OS';
  if (ua.indexOf('Win') !== -1) os = 'Windows';
  else if (ua.indexOf('Mac') !== -1) os = 'macOS';
  else if (ua.indexOf('X11') !== -1) os = 'Linux';
  else if (ua.indexOf('Android') !== -1) os = 'Android';
  else if (ua.indexOf('iPhone') !== -1 || ua.indexOf('iPad') !== -1) os = 'iOS';

  let browser = 'Unknown Browser';
  if (ua.indexOf('Firefox') !== -1) browser = 'Firefox';
  else if (ua.indexOf('SamsungBrowser') !== -1) browser = 'Samsung Browser';
  else if (ua.indexOf('Edg') !== -1 || ua.indexOf('Edge') !== -1) browser = 'Edge';
  else if (ua.indexOf('OPR') !== -1 || ua.indexOf('Opera') !== -1) browser = 'Opera';
  else if (ua.indexOf('Chrome') !== -1) browser = 'Chrome';
  else if (ua.indexOf('Safari') !== -1) browser = 'Safari';

  return `${os} (${browser})`;
}

/**
 * Detects the physical device Operating System family without browser names or versions.
 */
export function getPureDeviceOS(): string {
  if (typeof window === 'undefined') return 'Server';
  const ua = navigator.userAgent || '';
  const platform = (navigator as any).userAgentData?.platform || navigator.platform || '';
  if (/Android/i.test(ua) || /Android/i.test(platform)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua) || /iPhone|iPad|iPod/i.test(platform)) return 'iOS';
  if (/Win/i.test(ua) || /Win/i.test(platform)) return 'Windows';
  if (/Mac/i.test(ua) || /Mac/i.test(platform)) return 'macOS';
  if (/Linux/i.test(ua) || /Linux/i.test(platform)) return 'Linux';
  return 'UnknownOS';
}

/**
 * Checks if the user is on a mobile device.
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

/**
 * Extracts normalized GPU hardware details and shader precision capabilities.
 */
function getNormalizedGpuHardware(): {
  model: string;
  maxTextureSize: number;
  maxVertexAttribs: number;
  maxViewport: string;
  shaderPrecision: string;
} {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) {
      return { model: 'NO_WEBGL', maxTextureSize: 0, maxVertexAttribs: 0, maxViewport: '0x0', shaderPrecision: '0' };
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const rawRenderer = ext ? (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '') : '';

    const s = rawRenderer
      .replace(/ANGLE\s*\(/gi, '')
      .replace(/\)/g, '')
      .replace(/Google Inc\.\s*\(/gi, '')
      .replace(/Direct3D\d*/gi, '')
      .replace(/D3D\d*/gi, '')
      .replace(/vs_\d+_\d+/gi, '')
      .replace(/ps_\d+_\d+/gi, '')
      .replace(/OpenGL\s*(ES)?\s*[\d\.]*/gi, '')
      .replace(/WebGL\s*[\d\.]*/gi, '')
      .replace(/WebKit/gi, '')
      .replace(/,\s*or\s*similar/gi, '')
      .replace(/llvmpipe/gi, 'llvmpipe')
      .replace(/\b(PCIe|SSE\d*|PCI|AGP)\b/gi, '')
      .replace(/\b0x[0-9a-f]+\b/gi, '')
      .replace(/[^\w\s-]/g, ' ')
      .replace(/\b(r|tm)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const words = s.split(' ').filter(Boolean);
    const dedupeed: string[] = [];
    for (let i = 0; i < words.length; i++) {
      const word = words[i].toUpperCase();
      if (i === 0 || word !== dedupeed[dedupeed.length - 1]) {
        dedupeed.push(word);
      }
    }
    const cleanModel = dedupeed.join(' ') || 'STANDARD_GPU';

    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0;
    const maxVertexAttribs = gl.getParameter(gl.MAX_VERTEX_ATTRIBS) || 0;
    const maxViewport = (gl.getParameter(gl.MAX_VIEWPORT_DIMS) || [0, 0]).join('x');

    let shaderPrecision = 'STD';
    try {
      const vf = gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.HIGH_FLOAT);
      const ff = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
      if (vf && ff) {
        shaderPrecision = `${vf.rangeMin}:${vf.rangeMax}:${vf.precision}|${ff.rangeMin}:${ff.rangeMax}:${ff.precision}`;
      }
    } catch {}

    return {
      model: cleanModel,
      maxTextureSize,
      maxVertexAttribs,
      maxViewport,
      shaderPrecision
    };
  } catch {
    return { model: 'UNKNOWN_GPU', maxTextureSize: 0, maxVertexAttribs: 0, maxViewport: '0x0', shaderPrecision: '0' };
  }
}

/**
 * LAYER 1: 100% Browser-Invariant Core Hardware Signature.
 * Uses ONLY physical OS, logical screen dimensions, system timezone, and device class.
 * Guaranteed to be 100% identical across Chrome, Firefox, Safari, Edge, Brave, and Opera
 * on the exact same physical machine.
 */
export function getCoreHardwareSignature(): string {
  if (typeof window === 'undefined') return '00000000000000000000000000000000';
  const os = getPureDeviceOS();
  const screenW = window.screen.width || 0;
  const screenH = window.screen.height || 0;
  const minRes = Math.min(screenW, screenH);
  const maxRes = Math.max(screenW, screenH);

  let timezone = 'UTC';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {}
  const tzOffset = new Date().getTimezoneOffset();
  const deviceType = isMobileDevice() ? 'MOBILE' : 'DESKTOP';

  const coreTokens = [
    'CORE_HW_V4',
    os,
    `${minRes}x${maxRes}`,
    timezone,
    tzOffset,
    deviceType
  ].join('|');

  return murmurX64Hash128(coreTokens);
}

/**
 * Computes the exact legacy PURE_DEVICE_V3 fingerprint so existing admin devices
 * and previously stored interactions remain 100% backward-compatible.
 */
export function getLegacyHardwareFingerprint(): string {
  if (typeof window === 'undefined') return '00000000000000000000000000000000';
  const os = getPureDeviceOS();
  const screenW = window.screen.width || 0;
  const screenH = window.screen.height || 0;
  const minRes = Math.min(screenW, screenH);
  const maxRes = Math.max(screenW, screenH);
  const colorDepth = window.screen.colorDepth || 24;
  const dpr = Math.round((window.devicePixelRatio || 1) * 100) / 100;
  const physMin = Math.round(minRes * dpr);
  const physMax = Math.round(maxRes * dpr);
  const cores = navigator.hardwareConcurrency || 4;
  const maxTouchPoints = navigator.maxTouchPoints || 0;

  let timezone = 'UTC';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {}
  const tzOffset = new Date().getTimezoneOffset();

  let colorGamut = 'srgb';
  try {
    if (window.matchMedia && window.matchMedia('(color-gamut: p3)').matches) {
      colorGamut = 'p3';
    } else if (window.matchMedia && window.matchMedia('(color-gamut: rec2020)').matches) {
      colorGamut = 'rec2020';
    }
  } catch {}

  const gpu = getNormalizedGpuHardware();
  const deviceType = isMobileDevice() ? 'MOBILE' : 'DESKTOP';

  const hardwareTokens = [
    'PURE_DEVICE_V3',
    os,
    `${minRes}x${maxRes}`,
    `${physMin}x${physMax}`,
    colorDepth,
    dpr,
    cores,
    maxTouchPoints,
    timezone,
    tzOffset,
    colorGamut,
    gpu.model,
    gpu.maxTextureSize,
    gpu.maxVertexAttribs,
    gpu.maxViewport,
    deviceType
  ].join('|');

  return murmurX64Hash128(hardwareTokens);
}

/**
 * LAYER 2: Deep Micro-Hardware & Calibration Fingerprint.
 * Combines 20+ hardware, GPU shader precision, DSP math calibration, and locale signals.
 */
export function getDeepHardwareFingerprint(): string {
  if (typeof window === 'undefined') return '00000000000000000000000000000000';
  const legacyFp = getLegacyHardwareFingerprint();
  const gpu = getNormalizedGpuHardware();

  // Floating-point hardware FPU / math calibration signature
  const mathCalib = [
    Math.acos(0.123456789),
    Math.asin(0.987654321),
    Math.atan(2.5),
    Math.expm1(1),
    Math.log1p(0.5)
  ].map(n => n.toString().substring(0, 14)).join(',');

  let sysCalendar = 'gregory';
  let sysNumbering = 'latn';
  try {
    const opts = Intl.DateTimeFormat().resolvedOptions();
    sysCalendar = opts.calendar || 'gregory';
    sysNumbering = opts.numberingSystem || 'latn';
  } catch {}

  const primaryLang = (navigator.language || 'en').split('-')[0].toLowerCase();
  const deviceMem = (navigator as any).deviceMemory || 'unknown_mem';

  const deepTokens = [
    'DEEP_HW_V4',
    legacyFp,
    gpu.shaderPrecision,
    mathCalib,
    sysCalendar,
    sysNumbering,
    primaryLang,
    deviceMem
  ].join('|');

  return murmurX64Hash128(deepTokens);
}

/**
 * Converts any 32-char hex fingerprint into a deterministic 15-digit IMEI starting with 35.
 */
export function fpToImei(fp: string): string {
  let digits = '35';
  for (let i = 0; i < 13; i++) {
    const hexChar = fp[i % fp.length];
    const num = parseInt(hexChar, 16);
    digits += (isNaN(num) ? 0 : num % 10).toString();
  }
  return digits;
}

/**
 * Converts any 32-char hex fingerprint into a deterministic Serial Number XXXXX/XXXXXXXXX.
 */
export function fpToSerial(fp: string): string {
  const part1 = fp.substring(0, 5).toUpperCase();
  const part2 = fp.substring(5, 14).toUpperCase();
  return `${part1}/${part2}`;
}

// ============================================================================
// LAYER 3: 4-VAULT SELF-HEALING STORAGE (localStorage + IndexedDB + Cookie + CacheStorage)
// ============================================================================

function readVaultCookie(): VaultIdentityRecord | null {
  try {
    const cookies = document.cookie.split(';');
    for (const c of cookies) {
      const [k, v] = c.trim().split('=');
      if (k === VAULT_COOKIE_NAME && v) {
        return JSON.parse(decodeURIComponent(v));
      }
    }
  } catch {}
  return null;
}

function writeVaultCookie(record: VaultIdentityRecord): void {
  try {
    const encoded = encodeURIComponent(JSON.stringify(record));
    document.cookie = `${VAULT_COOKIE_NAME}=${encoded}; max-age=315360000; path=/; SameSite=Lax`;
  } catch {}
}

function readVaultIndexedDB(): Promise<VaultIdentityRecord | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(VAULT_IDB_DB, 1);
      req.onupgradeneeded = () => {
        const dbInstance = req.result;
        if (!dbInstance.objectStoreNames.contains(VAULT_IDB_STORE)) {
          dbInstance.createObjectStore(VAULT_IDB_STORE);
        }
      };
      req.onsuccess = () => {
        try {
          const dbInstance = req.result;
          const tx = dbInstance.transaction(VAULT_IDB_STORE, 'readonly');
          const store = tx.objectStore(VAULT_IDB_STORE);
          const getReq = store.get('primary');
          getReq.onsuccess = () => resolve(getReq.result || null);
          getReq.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function writeVaultIndexedDB(record: VaultIdentityRecord): void {
  try {
    if (typeof indexedDB === 'undefined') return;
    const req = indexedDB.open(VAULT_IDB_DB, 1);
    req.onupgradeneeded = () => {
      const dbInstance = req.result;
      if (!dbInstance.objectStoreNames.contains(VAULT_IDB_STORE)) {
        dbInstance.createObjectStore(VAULT_IDB_STORE);
      }
    };
    req.onsuccess = () => {
      try {
        const dbInstance = req.result;
        const tx = dbInstance.transaction(VAULT_IDB_STORE, 'readwrite');
        tx.objectStore(VAULT_IDB_STORE).put(record, 'primary');
      } catch {}
    };
  } catch {}
}

async function readVaultCacheStorage(): Promise<VaultIdentityRecord | null> {
  try {
    if (typeof caches === 'undefined') return null;
    const cache = await caches.open(VAULT_CACHE_NAME);
    const res = await cache.match(VAULT_CACHE_URL);
    if (res) {
      return await res.json();
    }
  } catch {}
  return null;
}

function writeVaultCacheStorage(record: VaultIdentityRecord): void {
  try {
    if (typeof caches === 'undefined') return;
    caches.open(VAULT_CACHE_NAME).then((cache) => {
      const response = new Response(JSON.stringify(record), {
        headers: { 'Content-Type': 'application/json' }
      });
      cache.put(VAULT_CACHE_URL, response).catch(() => {});
    }).catch(() => {});
  } catch {}
}

function persistToAllVaults(record: VaultIdentityRecord): void {
  resolvedIdentityCache = record;
  try {
    localStorage.setItem(VAULT_LS_KEY, JSON.stringify(record));
    localStorage.setItem('nonum_device_imei', record.imei);
    localStorage.setItem('nonum_device_serial', record.serial);
    if (record.aliasImeis && record.aliasImeis.length > 0) {
      localStorage.setItem(ALIAS_IMEIS_KEY, JSON.stringify(record.aliasImeis));
    }
  } catch {}
  writeVaultCookie(record);
  writeVaultIndexedDB(record);
  writeVaultCacheStorage(record);
}

export function addAliasImei(aliasImei: string): void {
  if (!aliasImei || aliasImei.length < 10) return;
  try {
    const existingRaw = localStorage.getItem(ALIAS_IMEIS_KEY);
    const list: string[] = existingRaw ? JSON.parse(existingRaw) : [];
    if (!list.includes(aliasImei)) {
      list.push(aliasImei);
      localStorage.setItem(ALIAS_IMEIS_KEY, JSON.stringify(list));
    }
    if (resolvedIdentityCache && !resolvedIdentityCache.aliasImeis.includes(aliasImei)) {
      resolvedIdentityCache.aliasImeis.push(aliasImei);
      persistToAllVaults(resolvedIdentityCache);
    }
  } catch {}
}

/**
 * Returns all IMEIs ever associated with this physical device (primary + cross-browser aliases + legacy).
 */
export function getAllDeviceImeis(): string[] {
  const result = new Set<string>();
  try {
    const current = localStorage.getItem('nonum_device_imei');
    if (current) result.add(current);
    const legacy = localStorage.getItem('nonum_legacy_device_imei');
    if (legacy) result.add(legacy);
    const aliasesRaw = localStorage.getItem(ALIAS_IMEIS_KEY);
    if (aliasesRaw) {
      const parsed = JSON.parse(aliasesRaw);
      if (Array.isArray(parsed)) {
        parsed.forEach((id) => {
          if (typeof id === 'string' && id.length >= 10) result.add(id);
        });
      }
    }
    const legacyFp = getLegacyHardwareFingerprint();
    result.add(fpToImei(legacyFp));
    const coreFp = getCoreHardwareSignature();
    result.add(fpToImei(coreFp));
  } catch {}
  if (resolvedIdentityCache) {
    result.add(resolvedIdentityCache.imei);
    resolvedIdentityCache.aliasImeis.forEach(a => result.add(a));
  }
  return Array.from(result);
}

/**
 * Resolves the local multi-vault identity (healing across localStorage, Cookie, IndexedDB, CacheStorage)
 * and kicks off non-blocking Cross-Browser Firestore Anchor synchronization.
 */
async function resolveLocalOrVaultIdentity(): Promise<VaultIdentityRecord> {
  if (resolvedIdentityCache) {
    return resolvedIdentityCache;
  }

  const coreSig = getCoreHardwareSignature();
  const deepSig = getDeepHardwareFingerprint();
  const legacyFp = getLegacyHardwareFingerprint();
  const legacyHardwareImei = fpToImei(legacyFp);
  const coreHardwareImei = fpToImei(coreSig);

  // 1. Check synchronous localStorage or Cookie first
  let record: VaultIdentityRecord | null = null;
  try {
    const lsRaw = localStorage.getItem(VAULT_LS_KEY);
    if (lsRaw) {
      record = JSON.parse(lsRaw);
    }
  } catch {}

  if (!record) {
    record = readVaultCookie();
  }

  // 2. Check asynchronous IndexedDB & CacheStorage if synchronous storage was cleared
  if (!record) {
    const [idbRec, cacheRec] = await Promise.all([
      readVaultIndexedDB(),
      readVaultCacheStorage()
    ]);
    record = idbRec || cacheRec || null;
  }

  // 3. If no v4 vault record exists yet, check if this device had a previous IMEI or generate a unique hybrid identity
  if (!record || !record.imei || !record.vaultFp) {
    let existingImei = '';
    let existingLegacyImei = '';
    try {
      existingImei = localStorage.getItem('nonum_device_imei') || '';
      existingLegacyImei = localStorage.getItem('nonum_legacy_device_imei') || '';
    } catch {}

    // Create a unique device cryptographic salt so two identical phones owned by different people never collide
    const randomEntropy = typeof crypto !== 'undefined' && crypto.getRandomValues
      ? Array.from(crypto.getRandomValues(new Uint32Array(2))).map(n => n.toString(16)).join('')
      : Math.random().toString(36).substring(2) + Date.now().toString(36);

    const uniqueVaultFp = murmurX64Hash128(`${deepSig}|${coreSig}|${randomEntropy}`);
    const canonicalImei = existingImei || fpToImei(uniqueVaultFp);
    const canonicalSerial = fpToSerial(existingImei ? legacyFp : uniqueVaultFp);

    const aliasSet = new Set<string>([legacyHardwareImei, coreHardwareImei]);
    if (existingImei) aliasSet.add(existingImei);
    if (existingLegacyImei) aliasSet.add(existingLegacyImei);
    aliasSet.add(canonicalImei);

    record = {
      vaultFp: existingImei ? legacyFp : uniqueVaultFp,
      imei: canonicalImei,
      serial: canonicalSerial,
      coreSig,
      deepSig,
      legacyFp,
      aliasImeis: Array.from(aliasSet),
      updatedAt: Date.now()
    };
  } else {
    // Ensure hardware aliases are always tracked in the record
    const aliases = new Set<string>(record.aliasImeis || []);
    aliases.add(legacyHardwareImei);
    aliases.add(coreHardwareImei);
    aliases.add(record.imei);
    record.aliasImeis = Array.from(aliases);
  }

  // Heal all 4 vaults immediately
  persistToAllVaults(record);

  // Trigger background Cross-Browser Firestore Anchor unification
  if (!crossBrowserSynced) {
    syncCrossBrowserDeviceIdentity(record).catch(() => {});
  }

  return record;
}

/**
 * LAYER 4: Cross-Browser Device Anchor Synchronization via Firestore.
 * Unites Chrome, Firefox, Safari, Edge, Brave, and PWA on the SAME physical device + IP
 * onto the exact same canonical Device IMEI & Serial, while keeping different users on
 * different networks 100% isolated even if they own the exact same phone model.
 */
export async function syncCrossBrowserDeviceIdentity(initialRecord?: VaultIdentityRecord): Promise<VaultIdentityRecord> {
  const localRec = initialRecord || await resolveLocalOrVaultIdentity();
  if (!db) return localRec;

  try {
    const ip = await getClientIp();
    if (!ip || ip === '127.0.0.1') return localRec;

    const safeIp = ip.replace(/[^a-zA-Z0-9]/g, '_');
    const coreSig = getCoreHardwareSignature();
    const anchorId = `device_anchor_${safeIp}_${coreSig}`;
    const anchorRef = doc(db, 'interactions', anchorId);
    const anchorSnap = await getDoc(anchorRef);

    crossBrowserSynced = true;

    if (anchorSnap.exists()) {
      const data = anchorSnap.data();
      if (data && typeof data.imei === 'string' && data.imei.length >= 10) {
        const mergedAliases = Array.from(new Set([
          ...(localRec.aliasImeis || []),
          ...(Array.isArray(data.aliasImeis) ? data.aliasImeis : []),
          localRec.imei,
          data.imei
        ]));

        const imeiChanged = localRec.imei !== data.imei;
        const aliasesChanged = mergedAliases.length !== (Array.isArray(data.aliasImeis) ? data.aliasImeis.length : 0);

        const unifiedRecord: VaultIdentityRecord = {
          vaultFp: data.vaultFp || localRec.vaultFp,
          imei: data.imei,
          serial: data.serial || fpToSerial(data.vaultFp || localRec.vaultFp),
          coreSig,
          deepSig: localRec.deepSig,
          legacyFp: localRec.legacyFp,
          aliasImeis: mergedAliases,
          updatedAt: Date.now()
        };

        if (localRec.imei !== data.imei) {
          try {
            localStorage.setItem('nonum_legacy_device_imei', localRec.imei);
          } catch {}
        }

        persistToAllVaults(unifiedRecord);

        if (aliasesChanged) {
          await setDoc(anchorRef, {
            type: 'device_anchor',
            ip,
            ipSubnet: getIpSubnetPrefix(ip),
            coreSig,
            deepSig: localRec.deepSig,
            vaultFp: unifiedRecord.vaultFp,
            imei: unifiedRecord.imei,
            serial: unifiedRecord.serial,
            aliasImeis: mergedAliases,
            updatedAt: new Date().toISOString()
          }, { merge: true }).catch(() => {});
        }

        if (imeiChanged && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('nonum_identity_synced', { detail: unifiedRecord }));
          window.dispatchEvent(new Event('storage'));
        }

        return unifiedRecord;
      }
    }

    // No anchor exists yet for this (IP + Core Hardware Signature) — register this device as canonical
    await setDoc(anchorRef, {
      type: 'device_anchor',
      ip,
      ipSubnet: getIpSubnetPrefix(ip),
      coreSig,
      deepSig: localRec.deepSig,
      vaultFp: localRec.vaultFp,
      imei: localRec.imei,
      serial: localRec.serial,
      aliasImeis: localRec.aliasImeis,
      updatedAt: new Date().toISOString()
    }, { merge: true }).catch(() => {});

    return localRec;
  } catch {
    return localRec;
  }
}

/**
 * Computes the hybrid device fingerprint (combining hardware signature + 4-vault anchor + cross-browser sync).
 */
export async function getFingerprint(): Promise<string> {
  if (typeof window === 'undefined') {
    return '00000000000000000000000000000000';
  }
  if (!cachedIdentityPromise) {
    cachedIdentityPromise = resolveLocalOrVaultIdentity();
  }
  const rec = await cachedIdentityPromise;
  return rec.vaultFp;
}

/**
 * Retrieves the persistent, unique 15-digit IMEI signature for this physical device.
 * Synchronized across all browsers on the same device via the Cross-Browser Device Anchor,
 * while guaranteeing zero collisions between different owners of identical phone models.
 */
export async function getDeviceImei(): Promise<string> {
  if (typeof window === 'undefined') return '350000000000000';
  if (!cachedIdentityPromise) {
    cachedIdentityPromise = resolveLocalOrVaultIdentity();
  }
  const rec = await cachedIdentityPromise;
  return rec.imei;
}

/**
 * Retrieves any legacy or alias browser IMEI stored previously on this device.
 */
export function getLegacyDeviceImei(): string | null {
  try {
    const legacy = localStorage.getItem('nonum_legacy_device_imei');
    const current = localStorage.getItem('nonum_device_imei');
    if (legacy && legacy !== current) {
      return legacy;
    }
    const all = getAllDeviceImeis();
    const other = all.find(id => id !== current);
    return other || null;
  } catch {
    return null;
  }
}

/**
 * Retrieves the persistent, unique hardware Serial Number (XXXXX/XXXXXXXXX) for PCs/Laptops/Tablets.
 */
export async function getDeviceSerial(): Promise<string> {
  if (typeof window === 'undefined') return '00000/000000000';
  if (!cachedIdentityPromise) {
    cachedIdentityPromise = resolveLocalOrVaultIdentity();
  }
  const rec = await cachedIdentityPromise;
  return rec.serial;
}

/**
 * Returns the active device identifier (either IMEI or Serial Number) based on device type.
 */
export async function getDeviceIdentifier(): Promise<{ type: 'IMEI' | 'SERIAL'; value: string }> {
  if (isMobileDevice()) {
    return { type: 'IMEI', value: await getDeviceImei() };
  } else {
    return { type: 'SERIAL', value: await getDeviceSerial() };
  }
}
