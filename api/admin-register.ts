import { IncomingMessage, ServerResponse } from 'http';
import { setCorsHeaders, parseJsonBody, verifyAdminCredentials, ADMIN_SECRET_KEY } from './_helpers.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.statusCode = 200;
      return res.end();
    }

    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ success: false, error: 'Method Not Allowed' }));
    }

    const body = await parseJsonBody(req);
    const { username, password, adminDeviceId } = body || {};

    if (!adminDeviceId || typeof adminDeviceId !== 'string') {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ success: false, error: 'Device identifier required.' }));
    }

    if (verifyAdminCredentials(username, password)) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(
        JSON.stringify({
          success: true,
          token: ADMIN_SECRET_KEY,
          adminDeviceId
        })
      );
    }

    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(
      JSON.stringify({
        success: false,
        error: 'Invalid Administrator credentials.'
      })
    );
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ success: false, error: err?.message || 'Server Error' }));
  }
}
