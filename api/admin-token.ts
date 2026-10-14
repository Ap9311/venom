import { IncomingMessage, ServerResponse } from 'http';
import { setCorsHeaders, parseJsonBody, ADMIN_SECRET_KEY } from './_helpers';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: 'Method Not Allowed' }));
  }

  const body = await parseJsonBody(req);
  const { adminDeviceId } = body || {};

  if (!adminDeviceId || typeof adminDeviceId !== 'string') {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: 'Access Denied.' }));
  }

  const isValidFormat = /^ADM-[A-F0-9]{12}$/i.test(adminDeviceId);
  if (isValidFormat) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, token: ADMIN_SECRET_KEY }));
  }

  res.writeHead(403, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ success: false, error: 'Device not authorized.' }));
}
