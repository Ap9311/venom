import { IncomingMessage, ServerResponse } from 'http';
import { setCorsHeaders, parseJsonBody, ADMIN_SECRET_KEY } from './_helpers.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.statusCode = 200;
      return res.end();
    }

    const body = await parseJsonBody(req);
    const { adminDeviceId } = body || {};

    if (!adminDeviceId || typeof adminDeviceId !== 'string') {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ success: false, error: 'Access Denied.' }));
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ success: true, token: ADMIN_SECRET_KEY }));
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ success: false, error: err?.message || 'Server Error' }));
  }
}
