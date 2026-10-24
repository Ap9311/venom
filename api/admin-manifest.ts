import { IncomingMessage, ServerResponse } from 'http';
import { setCorsHeaders } from './_helpers.js';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  setCorsHeaders(res, req);

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  const host = String(req.headers.host || '').toLowerCase();
  const referer = String(req.headers.referer || '').toLowerCase();
  const origin = String(req.headers.origin || '').toLowerCase();

  const isAdminAccess =
    host.includes('admin') ||
    referer.includes('admin') ||
    origin.includes('admin') ||
    host.includes('localhost');

  if (!isAdminAccess) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Not found' }));
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/manifest+json');
  res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  return res.end(
    JSON.stringify({
      id: 'nonum-admin',
      scope: '/admin',
      name: 'Nonum Admin Console',
      short_name: 'Nonum Admin',
      description: 'Nonum Security & Moderator Command Center',
      start_url: '/admin?pwa=admin',
      display: 'standalone',
      background_color: '#09090b',
      theme_color: '#f43f5e',
      icons: [
        {
          src: 'https://iili.io/nWbQlNj.png',
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: 'https://iili.io/nWbQlNj.png',
          sizes: '512x512',
          type: 'image/png'
        }
      ]
    })
  );
}
