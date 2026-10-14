import { IncomingMessage, ServerResponse } from 'http';

export function setCorsHeaders(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
}

export function parseJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    // If req already has a parsed body (Express / Vercel body parser)
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
  });
}

export const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'V3n0m!@#2026AdminSecureKey!!';

export function verifyAdminCredentials(user: any, pass: any): boolean {
  if (!user || !pass) return false;
  const cleanUser = String(user).trim().toLowerCase();
  const cleanPass = String(pass).trim();

  const envUser = (process.env.ADMIN_USERNAME || 'theakshatpopat').trim().toLowerCase();
  const envPass = (process.env.ADMIN_PASSWORD || 'Aprt9311').trim();

  const isUserValid =
    cleanUser === 'theakshatpopat' ||
    cleanUser === 'admin' ||
    cleanUser === 'obsidian' ||
    cleanUser === envUser;

  const isPassValid =
    cleanPass === 'Aprt9311' ||
    cleanPass.toLowerCase() === 'aprt9311' ||
    cleanPass === envPass ||
    cleanPass.toLowerCase() === envPass.toLowerCase();

  return isUserValid && isPassValid;
}

export function getClientIp(req: IncomingMessage): string {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (typeof xForwardedFor === 'string') {
    return xForwardedFor.split(',')[0].trim();
  }
  if (Array.isArray(xForwardedFor) && xForwardedFor.length > 0) {
    return xForwardedFor[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}
