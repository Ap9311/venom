import { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';

export function setCorsHeaders(res: ServerResponse, req?: IncomingMessage) {
  const origin = req?.headers?.origin;
  let allowedOrigin = 'https://nonum.online';

  if (typeof origin === 'string' && origin) {
    const cleanOrigin = origin.toLowerCase().trim();
    if (
      cleanOrigin === 'https://nonum.online' ||
      cleanOrigin.endsWith('.nonum.online') ||
      cleanOrigin.includes('vercel.app') ||
      cleanOrigin.includes('localhost')
    ) {
      allowedOrigin = origin;
    }
  }

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Admin-Token, X-Admin-Device-Id');
}

export function parseJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    try {
      if ((req as any).body) {
        if (typeof (req as any).body === 'string') {
          try {
            return resolve(JSON.parse((req as any).body));
          } catch {
            return resolve({});
          }
        }
        return resolve((req as any).body);
      }

      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        if (!body) return resolve({});
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve({});
        }
      });
      req.on('error', () => {
        resolve({});
      });
    } catch {
      resolve({});
    }
  });
}

const KDF_SALT = 'n0num_v3_kdf_9f8a7b6c5d4e3f2a';

const AUTHORIZED_USER_DIGESTS: readonly string[] = [
  '737a5cc65c6d4ee7bf6ce378815cef6c8faff462b8e2f4a3492d7a3c1bcd2fb6',
  '3009ef6879f9a0149a941ed8d9fc56b6cc9fcf642fe1bb2e7863bb2c3da90839',
  '57d03d32eca4a05f12d35cf4c056092b83e7650e30aaacc8d2d0553fd67b3cb9',
];

const AUTHORIZED_PASS_DIGESTS: readonly string[] = [
  'c7b202f04099de3e326c694ef90f6ea12a8645710b42dc50b41551e2bc96591c',
  'de78d95003cd707d532fa842148463de6b14f76bf7e85e7a178fd5eba89f8874',
];

function deriveDigestBuffer(input: string): Buffer {
  return crypto.pbkdf2Sync(input, KDF_SALT, 10000, 32, 'sha256');
}

function timingSafeMatchDigest(candidateBuf: Buffer, hexDigests: readonly string[]): boolean {
  let matched = false;
  for (const hex of hexDigests) {
    const targetBuf = Buffer.from(hex, 'hex');
    if (
      targetBuf.length === candidateBuf.length &&
      crypto.timingSafeEqual(candidateBuf, targetBuf)
    ) {
      matched = true;
    }
  }
  return matched;
}

export const ADMIN_SECRET_KEY =
  process.env.ADMIN_SECRET_KEY ||
  crypto
    .createHmac('sha256', 'n0num_kdf_sig_2026')
    .update('nonum_admin_master_session_authority')
    .digest('hex');

export function verifyAdminCredentials(user: any, pass: any): boolean {
  if (!user || !pass) return false;
  const cleanUser = String(user).trim().toLowerCase();
  const cleanPass = String(pass).trim();

  const userDigest = deriveDigestBuffer(cleanUser);
  const passDigestExact = deriveDigestBuffer(cleanPass);
  const passDigestLower = deriveDigestBuffer(cleanPass.toLowerCase());

  const userDigestsToCheck = [...AUTHORIZED_USER_DIGESTS];
  const passDigestsToCheck = [...AUTHORIZED_PASS_DIGESTS];

  if (process.env.ADMIN_USERNAME) {
    userDigestsToCheck.push(
      deriveDigestBuffer(process.env.ADMIN_USERNAME.trim().toLowerCase()).toString('hex')
    );
  }
  if (process.env.ADMIN_PASSWORD) {
    passDigestsToCheck.push(
      deriveDigestBuffer(process.env.ADMIN_PASSWORD.trim()).toString('hex'),
      deriveDigestBuffer(process.env.ADMIN_PASSWORD.trim().toLowerCase()).toString('hex')
    );
  }

  const isUserValid = timingSafeMatchDigest(userDigest, userDigestsToCheck);
  const isPassValid =
    timingSafeMatchDigest(passDigestExact, passDigestsToCheck) ||
    timingSafeMatchDigest(passDigestLower, passDigestsToCheck);

  return isUserValid && isPassValid;
}

export function setAdminCookies(
  res: ServerResponse,
  req?: IncomingMessage,
  adminDeviceId?: string,
  token?: string
) {
  const host = String(req?.headers?.host || '').toLowerCase();
  const domainAttr = host.endsWith('nonum.online') ? '; Domain=.nonum.online; Secure' : '';
  const cookies: string[] = [];
  if (adminDeviceId) {
    cookies.push(
      `nonum_admin_device_id=${encodeURIComponent(adminDeviceId)}; Path=/; Max-Age=31536000; SameSite=Lax${domainAttr}`
    );
  }
  if (token) {
    cookies.push(
      `nonum_admin_token=${encodeURIComponent(token)}; Path=/; Max-Age=31536000; SameSite=Lax${domainAttr}`
    );
  }
  if (cookies.length > 0) {
    res.setHeader('Set-Cookie', cookies);
  }
}

export function getClientIp(req: IncomingMessage): string {
  try {
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (typeof xForwardedFor === 'string') {
      return xForwardedFor.split(',')[0].trim();
    }
    if (Array.isArray(xForwardedFor) && xForwardedFor.length > 0) {
      return xForwardedFor[0].trim();
    }
    return req.socket?.remoteAddress || '127.0.0.1';
  } catch {
    return '127.0.0.1';
  }
}
