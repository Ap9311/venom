import { IncomingMessage, ServerResponse } from 'http';
import { setCorsHeaders, parseJsonBody, verifyAdminCredentials, ADMIN_SECRET_KEY } from './_helpers';

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
  const { username, password } = body || {};

  if (verifyAdminCredentials(username, password)) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(
      JSON.stringify({
        success: true,
        token: ADMIN_SECRET_KEY,
        message: 'Administrator authentication verified.'
      })
    );
  }

  res.writeHead(401, { 'Content-Type': 'application/json' });
  return res.end(
    JSON.stringify({
      success: false,
      error: 'Invalid Administrator credentials.'
    })
  );
}
