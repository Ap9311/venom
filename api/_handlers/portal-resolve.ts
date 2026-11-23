/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  setCorsHeaders,
  verifyCsrfOrigin,
  getConfiguredAssistantPortalPath,
  safeStringEqual,
  sanitizePayload
} from '../_helpers.js';

const ALLOWED_ASSISTANT_SUBPATHS = new Set<string>([
  '',
  '/report',
  '/communities',
  '/community-reports',
  '/report-communities'
]);

/**
 * POST /api/portal-resolve
 * Checks whether a candidate admin pathname matches the server-configured
 * ASSISTANT_PORTAL_PATH environment variable without EVER exposing that path
 * in client-side JavaScript or the public git repository.
 */
export default async function handler(req: any, res: any) {
  setCorsHeaders(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ isAssistantPortal: false });
  }
  if (!verifyCsrfOrigin(req)) {
    return res.status(403).json({ isAssistantPortal: false });
  }

  const configuredSegment = getConfiguredAssistantPortalPath();
  if (!configuredSegment) {
    return res.status(200).json({ isAssistantPortal: false });
  }

  const body = sanitizePayload(req.body || {});
  const rawPath = typeof body.path === 'string' ? body.path.split('?')[0].replace(/\/+$/, '') : '';
  if (!rawPath || rawPath.length > 256) {
    return res.status(200).json({ isAssistantPortal: false });
  }

  // Normalize /admin + segment match
  const expectedBase = configuredSegment.startsWith('/admin/')
    ? configuredSegment
    : `/admin${configuredSegment}`;

  if (safeStringEqual(rawPath, expectedBase)) {
    return res.status(200).json({
      isAssistantPortal: true,
      subPath: ''
    });
  }

  const prefix = `${expectedBase}/`;
  if (rawPath.length > prefix.length && safeStringEqual(rawPath.slice(0, prefix.length), prefix)) {
    const subPath = rawPath.slice(expectedBase.length);
    if (ALLOWED_ASSISTANT_SUBPATHS.has(subPath)) {
      return res.status(200).json({
        isAssistantPortal: true,
        subPath
      });
    }
  }

  return res.status(200).json({ isAssistantPortal: false });
}
