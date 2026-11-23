import { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import { setCorsHeaders, ADMIN_SECRET_KEY } from './_helpers.js';

function parseCookiesFromReq(req: IncomingMessage): Record<string, string> {
  const list: Record<string, string> = {};
  const rc = req.headers.cookie;
  if (rc) {
    rc.split(';').forEach((cookie) => {
      const parts = cookie.split('=');
      const key = parts.shift()?.trim();
      if (key) {
        list[key] = decodeURIComponent(parts.join('=').trim());
      }
    });
  }
  return list;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    setCorsHeaders(res, req);

    if (req.method === 'OPTIONS') {
      res.statusCode = 200;
      return res.end();
    }

    const cookies = parseCookiesFromReq(req);
    const tokenHeader = req.headers['x-admin-token'] || req.headers['authorization'];
    const devIdHeader = req.headers['x-admin-device-id'];

    const token = (typeof tokenHeader === 'string' ? tokenHeader.replace('Bearer ', '') : '') || cookies['nonum_admin_token'];
    const devId = (typeof devIdHeader === 'string' ? devIdHeader : '') || cookies['nonum_admin_device_id'];

    // Serve index.html, letting the SPA handle authorization redirects
    const indexFilePath = path.join(process.cwd(), 'dist', 'index.html');
    let htmlContent = '';
    if (fs.existsSync(indexFilePath)) {
      htmlContent = fs.readFileSync(indexFilePath, 'utf-8');
    } else {
      const devIndexPath = path.join(process.cwd(), 'index.html');
      if (fs.existsSync(devIndexPath)) {
        htmlContent = fs.readFileSync(devIndexPath, 'utf-8');
      }
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(htmlContent);
  } catch (err: any) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end(`Cannot GET ${req.url || '/'}`);
  }
}
