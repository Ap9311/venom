import { IncomingMessage, ServerResponse } from 'http';
import { setCorsHeaders } from './_helpers.js';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  setCorsHeaders(res, req);

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  const xForwardedFor = req.headers['x-forwarded-for'];
  let ip = '';
  if (typeof xForwardedFor === 'string') {
    ip = xForwardedFor.split(',')[0].trim();
  } else if (Array.isArray(xForwardedFor)) {
    ip = xForwardedFor[0].trim();
  } else {
    ip = req.socket.remoteAddress || '';
  }
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    ip = '127.0.0.1';
  }
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ip }));
}
