import { IncomingMessage, ServerResponse } from 'http';
import { setCorsHeaders, parseJsonBody } from './_helpers.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    setCorsHeaders(res, req);

    if (req.method === 'OPTIONS') {
      res.statusCode = 200;
      return res.end();
    }

    const body = await parseJsonBody(req);
    const { adminDeviceId } = body || {};

    if (adminDeviceId) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ success: true }));
    }

    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ success: false }));
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ success: false, error: err?.message || 'Server Error' }));
  }
}
