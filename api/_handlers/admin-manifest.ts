/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export default function handler(_req: any, res: any) {
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(200).json({
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
        src: '/nonum-admin-logo.svg',
        sizes: '192x192',
        type: 'image/svg+xml'
      },
      {
        src: '/nonum-admin-logo.svg',
        sizes: '512x512',
        type: 'image/svg+xml'
      }
    ]
  });
}
