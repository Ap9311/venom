/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import adminAssistantCredsHandler from './_handlers/admin-assistant-creds.js';
import adminAuthHandler from './_handlers/admin-auth.js';
import adminGateHandler from './_handlers/admin-gate.js';
import adminLoginHandler from './_handlers/admin-login.js';
import adminManifestHandler from './_handlers/admin-manifest.js';
import adminRegisterHandler from './_handlers/admin-register.js';
import adminRevokeHandler from './_handlers/admin-revoke.js';
import adminTokenHandler from './_handlers/admin-token.js';
import adminUpdateLimitHandler from './_handlers/admin-update-limit.js';
import adminVerifyHandler from './_handlers/admin-verify.js';
import assistantAuthHandler from './_handlers/assistant-auth.js';
import checkBlockHandler from './_handlers/check-block.js';
import communityPinHandler from './_handlers/community-pin.js';
import getIpHandler from './_handlers/get-ip.js';
import healthHandler from './_handlers/health.js';
import portalResolveHandler from './_handlers/portal-resolve.js';

const ROUTES: Record<string, (req: any, res: any) => any> = {
  'admin-assistant-creds': adminAssistantCredsHandler,
  'admin-auth': adminAuthHandler,
  'admin-gate': adminGateHandler,
  'admin-login': adminLoginHandler,
  'admin-manifest': adminManifestHandler,
  'admin-register': adminRegisterHandler,
  'admin-revoke': adminRevokeHandler,
  'admin-token': adminTokenHandler,
  'admin-update-limit': adminUpdateLimitHandler,
  'admin-verify': adminVerifyHandler,
  'assistant-auth': assistantAuthHandler,
  'check-block': checkBlockHandler,
  'community-pin': communityPinHandler,
  'get-ip': getIpHandler,
  health: healthHandler,
  'portal-resolve': portalResolveHandler
};

function resolveRouteName(req: any): string {
  // 1. Prefer explicit rewrite parameter from vercel.json (?__route=...)
  const queryRoute = req?.query?.__route;
  if (typeof queryRoute === 'string' && queryRoute.trim()) {
    return queryRoute.replace(/^\/+|\/+$/g, '').split('/')[0];
  }
  if (Array.isArray(queryRoute) && queryRoute[0]) {
    return String(queryRoute[0]).replace(/^\/+|\/+$/g, '');
  }

  // 2. Fallback to URL pathname parsing (/api/<name> or /admin-manifest.json)
  const rawUrl = typeof req?.url === 'string' ? req.url : '';
  const pathname = rawUrl.split('?')[0].replace(/\/+$/, '');
  if (pathname === '/admin-manifest.json') {
    return 'admin-manifest';
  }
  if (pathname.startsWith('/api/')) {
    return pathname.slice('/api/'.length).split('/')[0];
  }
  return '';
}

/**
 * Single consolidated Vercel Serverless Function router.
 * Keeps total serverless functions at 1 (well within Vercel Hobby's 12-function limit)
 * while dispatching all /api/* routes cleanly to their dedicated handlers.
 */
export default async function handler(req: any, res: any) {
  const route = resolveRouteName(req);
  const target = ROUTES[route];

  if (!target) {
    return res.status(404).json({ success: false, error: 'API endpoint not found.' });
  }

  try {
    return await target(req, res);
  } catch (err) {
    console.error(`API route "${route}" failed:`, err);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  }
}
