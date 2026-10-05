import { IncomingMessage, ServerResponse } from 'http';
import { verifyUsername, verifyPassword, generateSessionToken } from './_authUtils.js';
import { getAdminAuth } from './_firebaseAdmin.js';

export default async function handler(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
  }

  let body = req.body;
  if (!body) {
    try {
      const buffers = [];
      for await (const chunk of req) {
        buffers.push(chunk);
      }
      body = JSON.parse(Buffer.concat(buffers).toString('utf-8'));
    } catch {
      body = {};
    }
  }

  const { username, password, adminDeviceId = 'admin_device' } = body || {};

  const isUserValid = verifyUsername(username);
  const isPassValid = verifyPassword(password);

  if (!isUserValid || !isPassValid) {
    await new Promise((r) => setTimeout(r, 500));
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: 'Access Denied: Invalid credentials.' }));
  }

  const sessionToken = generateSessionToken(adminDeviceId);
  let customToken: string | null = null;

  try {
    const auth = getAdminAuth();
    customToken = await auth.createCustomToken(adminDeviceId, { admin: true });
  } catch (err) {
    console.warn('Could not generate Firebase admin custom token:', err);
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({
    success: true,
    sessionToken,
    customToken,
    adminDeviceId,
    message: 'Administrator authentication verified.'
  }));
}
