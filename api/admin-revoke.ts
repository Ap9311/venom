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

  if (adminDeviceId) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true }));
  }

  res.writeHead(400, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ success: false }));
}
