import crypto from 'crypto';

// Default scrypt hash for 'Aprt9311' with salt 'venomsalt2026'
const DEFAULT_SALT = 'venomsalt2026';
const DEFAULT_HASH_HEX = 'd2b59e87d1c4cd34b97457495abbd8bd46c49c8e14a20093271d3a18968859225ce5fc93303777886f2ac1a4d7577cde9ffe91002244ba3467aceea7953cded1';

export function verifyPassword(inputPassword: string): boolean {
  if (!inputPassword || typeof inputPassword !== 'string') return false;

  const envHash = process.env.ADMIN_PASSWORD_HASH;
  let salt = DEFAULT_SALT;
  let expectedHashHex = DEFAULT_HASH_HEX;

  if (envHash && envHash.includes(':')) {
    const parts = envHash.split(':');
    salt = parts[0];
    expectedHashHex = parts[1];
  } else if (envHash) {
    expectedHashHex = envHash;
  }

  try {
    const derivedBuffer = crypto.scryptSync(inputPassword.trim(), salt, 64);
    const expectedBuffer = Buffer.from(expectedHashHex, 'hex');
    if (derivedBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(derivedBuffer, expectedBuffer);
  } catch (err) {
    return false;
  }
}

export function verifyUsername(inputUsername: string): boolean {
  if (!inputUsername || typeof inputUsername !== 'string') return false;
  const expectedUser = (process.env.ADMIN_USERNAME || 'theakshatpopat').trim().toLowerCase();
  const inputUser = inputUsername.trim().toLowerCase();

  try {
    const inputBuf = Buffer.from(inputUser, 'utf-8');
    const expectedBuf = Buffer.from(expectedUser, 'utf-8');
    if (inputBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(inputBuf, expectedBuf);
  } catch {
    return false;
  }
}

export function generateSessionToken(adminDeviceId: string): string {
  const secret = process.env.ADMIN_SESSION_SECRET || 'venom_admin_session_secret_2026_key';
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    adminDeviceId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor((Date.now() + 12 * 3600 * 1000) / 1000)
  })).toString('base64url');

  const signature = crypto.createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

export function verifySessionToken(token: string): { valid: boolean; adminDeviceId?: string } {
  if (!token || typeof token !== 'string') return { valid: false };
  const parts = token.split('.');
  if (parts.length !== 3) return { valid: false };

  const [header, payload, signature] = parts;
  const secret = process.env.ADMIN_SESSION_SECRET || 'venom_admin_session_secret_2026_key';

  const expectedSig = crypto.createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');

  try {
    const sigBuf = Buffer.from(signature, 'utf-8');
    const expSigBuf = Buffer.from(expectedSig, 'utf-8');
    if (sigBuf.length !== expSigBuf.length || !crypto.timingSafeEqual(sigBuf, expSigBuf)) {
      return { valid: false };
    }

    const payloadObj = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (!payloadObj || !payloadObj.exp) return { valid: false };

    if (Math.floor(Date.now() / 1000) > payloadObj.exp) {
      return { valid: false };
    }

    return { valid: true, adminDeviceId: payloadObj.adminDeviceId };
  } catch {
    return { valid: false };
  }
}
