import { IncomingMessage, ServerResponse } from 'http';
import { setCorsHeaders } from './_helpers.js';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  setCorsHeaders(res, req);

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
}
