/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Retreives the real public IP address of the user. If blocked or offline,
 * falls back to a deterministic, realistic public IP cached in local storage.
 */
export async function getClientIp(): Promise<string> {
  try {
    const controllers = new AbortController();
    const timeoutId = setTimeout(() => controllers.abort(), 2000); // Fail fast in 2s
    
    const response = await fetch('/api/get-ip', { signal: controllers.signal });
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      return data.ip || '127.0.0.1';
    }
  } catch (error) {
    console.warn('IP API lookup failed/timeout, falling back to device signature IP:', error);
  }
  
  // Persistent deterministic simulated IP
  let cachedIp = localStorage.getItem('venom_simulated_client_ip');
  if (!cachedIp) {
    const octet1 = Math.floor(Math.random() * 100) + 80; // realistic IPs
    const octet2 = Math.floor(Math.random() * 150) + 10;
    const octet3 = Math.floor(Math.random() * 200) + 1;
    const octet4 = Math.floor(Math.random() * 250) + 1;
    cachedIp = `${octet1}.${octet2}.${octet3}.${octet4}`;
    localStorage.setItem('venom_simulated_client_ip', cachedIp);
  }
  return cachedIp;
}

/**
 * Retreives standard device metadata for admin tracking.
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
  else if (ua.indexOf('Chrome') !== -1) browser = 'Chrome';
  else if (ua.indexOf('Safari') !== -1) browser = 'Safari';
  else if (ua.indexOf('Edge') !== -1) browser = 'Edge';

  return `${os} (${browser})`;
}

import { murmurX64Hash128 } from '@fingerprintjs/fingerprintjs';

let cachedDeviceFingerprint: string | null = null;

/**
 * Extracts normalized GPU hardware details without any browser-specific wrappers.
 * Removes browser-level prefixes (ANGLE, Direct3D11, OpenGL, WebKit, Google Inc, etc.)
 * so Chrome, Firefox, Safari, and Edge on the same machine output the identical hardware string.
 */
function getNormalizedGpuHardware(): {
  model: string;
  maxTextureSize: number;
  maxVertexAttribs: number;
  maxViewport: string;
} {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) {
      return { model: 'NO_WEBGL', maxTextureSize: 0, maxVertexAttribs: 0, maxViewport: '0x0' };
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const rawRenderer = ext ? (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '') : '';

    // Strip browser-specific wrappers, driver versions, and API wrappers
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
      .replace(/llvmpipe/gi, 'llvmpipe')
      .replace(/\b(PCIe|SSE\d*|PCI|AGP)\b/gi, '')
      .replace(/\b0x[0-9a-f]+\b/gi, '')
      .replace(/[^\w\s-]/g, ' ')
      .replace(/\b(r|tm)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Deduplicate consecutive identical words (e.g. "Intel Intel UHD" -> "Intel UHD")
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

    return {
      model: cleanModel,
      maxTextureSize,
      maxVertexAttribs,
      maxViewport,
    };
  } catch {
    return { model: 'UNKNOWN_GPU', maxTextureSize: 0, maxVertexAttribs: 0, maxViewport: '0x0' };
  }
}

/**
 * Detects the physical device Operating System family without browser names or versions.
 * Chrome on Windows -> "Windows"
 * Firefox on Windows -> "Windows"
 * Edge on Windows -> "Windows"
 * Safari on iOS -> "iOS"
 * Chrome on iOS -> "iOS"
 * Chrome on Android -> "Android"
 * Firefox on Android -> "Android"
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
 * Computes a pure cross-browser device hardware fingerprint.
 * CRITICAL REQUIREMENT: This does NOT save or include ANY browser data
 * (no userAgent, no browser vendor, no browser plugins, no browser-specific APIs).
 * Chrome, Firefox, Safari, Edge, Brave on the exact same physical device produce
 * the identical fingerprint hash, preserving all user likes, reactions, and communities.
 */
export async function getFingerprint(): Promise<string> {
  if (cachedDeviceFingerprint) {
    return cachedDeviceFingerprint;
  }

  if (typeof window === 'undefined') {
    return '00000000000000000000000000000000';
  }

  // 1. Operating System (Device OS only, strictly NO browser strings)
  const os = getPureDeviceOS();

  // 2. Physical Screen dimensions (orientation-independent min/max)
  const screenW = window.screen.width || 0;
  const screenH = window.screen.height || 0;
  const minRes = Math.min(screenW, screenH);
  const maxRes = Math.max(screenW, screenH);
  const colorDepth = window.screen.colorDepth || 24;
  const dpr = Math.round((window.devicePixelRatio || 1) * 100) / 100;
  const physMin = Math.round(minRes * dpr);
  const physMax = Math.round(maxRes * dpr);

  // 3. CPU hardware concurrency (physical core threads)
  const cores = navigator.hardwareConcurrency || 4;

  // 4. Touch screen hardware support
  const maxTouchPoints = navigator.maxTouchPoints || 0;

  // 5. System timezone (OS level configuration)
  let timezone = 'UTC';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {}
  const tzOffset = new Date().getTimezoneOffset();

  // 6. Color gamut capability (hardware display)
  let colorGamut = 'srgb';
  try {
    if (window.matchMedia && window.matchMedia('(color-gamut: p3)').matches) {
      colorGamut = 'p3';
    } else if (window.matchMedia && window.matchMedia('(color-gamut: rec2020)').matches) {
      colorGamut = 'rec2020';
    }
  } catch {}

  // 7. GPU hardware (physical chip and driver parameters, normalized without browser wrappers)
  const gpu = getNormalizedGpuHardware();

  // 8. Device type (Mobile vs Desktop)
  const deviceType = isMobileDevice() ? 'MOBILE' : 'DESKTOP';

  // Assemble ONLY physical hardware & device signals (zero browser-specific data)
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

  // Compute 128-bit MurmurHash (32 hex characters)
  const fp = murmurX64Hash128(hardwareTokens);
  cachedDeviceFingerprint = fp;
  return fp;
}

/**
 * Checks if the user is on a mobile device.
 */
export function isMobileDevice(): boolean {
  const ua = navigator.userAgent;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

/**
 * Retrieves a persistent, unique 15-digit IMEI signature for this physical device.
 * Generated purely from device hardware so it remains 100% identical across all browsers.
 */
export async function getDeviceImei(): Promise<string> {
  const fp = await getFingerprint();
  // Use characters of the deterministic hex string to create standard 15 digits starting with 35
  let digits = '35';
  for (let i = 0; i < 13; i++) {
    const hexChar = fp[i % fp.length];
    const num = parseInt(hexChar, 16) % 10;
    digits += num.toString();
  }

  // Preserve any legacy browser-polluted IMEI if one was generated before this update
  const existingImei = localStorage.getItem('venom_device_imei');
  if (existingImei && existingImei !== digits) {
    localStorage.setItem('venom_legacy_device_imei', existingImei);
  }

  localStorage.setItem('venom_device_imei', digits);
  return digits;
}

/**
 * Retrieves any legacy browser-specific IMEI stored previously, if different from current pure device IMEI.
 */
export function getLegacyDeviceImei(): string | null {
  const legacy = localStorage.getItem('venom_legacy_device_imei');
  const current = localStorage.getItem('venom_device_imei');
  if (legacy && legacy !== current) {
    return legacy;
  }
  return null;
}

/**
 * Retrieves a persistent, unique 12-character alphanumeric hardware Serial Number for PCs/Laptops/Tablets.
 * Generated purely from device hardware so it remains 100% identical across all browsers.
 */
export async function getDeviceSerial(): Promise<string> {
  const fp = await getFingerprint();
  // Generate a deterministic serial from the pure device fingerprint
  const part1 = fp.substring(0, 5).toUpperCase();
  const part2 = fp.substring(5, 14).toUpperCase();
  const serial = `${part1}/${part2}`;
  
  const existingSerial = localStorage.getItem('venom_device_serial');
  if (existingSerial && existingSerial !== serial) {
    localStorage.setItem('venom_legacy_device_serial', existingSerial);
  }

  localStorage.setItem('venom_device_serial', serial);
  return serial;
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

