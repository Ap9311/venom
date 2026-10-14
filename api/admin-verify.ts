import { IncomingMessage, ServerResponse } from 'http';
import { setCorsHeaders, parseJsonBody } from './_helpers';

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
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ isAdmin: false }));
  }

  // Verification succeeds if adminDeviceId is formatted correctly (ADM-XXXXXXXXXXXX)
  // Client cross-checks with Firestore interactions collection
  const isValidFormat = /^ADM-[A-F0-9]{12}$/i.test(adminDeviceId);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ isAdmin: isValidFormat }));
}
