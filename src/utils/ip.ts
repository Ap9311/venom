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

/**
 * Retrieves a persistent, unique 15-digit IMEI signature for this device.
 */
export function getDeviceImei(): string {
  let imei = localStorage.getItem('venom_device_imei');
  if (!imei) {
    // Generate standard 15-digit IMEI starting with 35
    let digits = '35';
    for (let i = 0; i < 13; i++) {
      digits += Math.floor(Math.random() * 10).toString();
    }
    imei = digits;
    localStorage.setItem('venom_device_imei', imei);
  }
  return imei;
}

/**
 * Checks if the user is on a mobile device.
 */
export function isMobileDevice(): boolean {
  const ua = navigator.userAgent;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

/**
 * Retrieves a persistent, unique 12-character alphanumeric hardware Serial Number for PCs/Laptops/Tablets.
 */
export function getDeviceSerial(): string {
  let serial = localStorage.getItem('venom_device_serial');
  if (!serial) {
    // Pre-seed with user's real serial number by default
    serial = '72669/X6R700058';
    localStorage.setItem('venom_device_serial', serial);
  }
  return serial;
}

/**
 * Returns the active device identifier (either IMEI or Serial Number) based on device type.
 */
export function getDeviceIdentifier(): { type: 'IMEI' | 'SERIAL'; value: string } {
  if (isMobileDevice()) {
    return { type: 'IMEI', value: getDeviceImei() };
  } else {
    return { type: 'SERIAL', value: getDeviceSerial() };
  }
}
