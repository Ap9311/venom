import { IncomingMessage, ServerResponse } from 'http';
import { setCorsHeaders, parseJsonBody, ADMIN_SECRET_KEY } from './_helpers.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    setCorsHeaders(res, req);

    if (req.method === 'OPTIONS') {
      res.statusCode = 200;
      return res.end();
    }

    const body = await parseJsonBody(req);
    const { token, adminDeviceId } = body || {};

    const isValid = Boolean(
      (token && token === ADMIN_SECRET_KEY) ||
      (adminDeviceId && typeof adminDeviceId === 'string')
    );

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(
      JSON.stringify({
        success: true,
        isAdmin: isValid,
        valid: isValid
      })
    );
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ success: false, error: err?.message || 'Server Error' }));
  }
}
