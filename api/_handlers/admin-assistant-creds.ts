/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  setCorsHeaders,
  verifyCsrfOrigin,
  requireFullAdmin,
  fetchStoredAssistantCredentials,
  saveAssistantCredentialsServer,
  resetAssistantCredentialsServer,
  sanitizePayload
} from '../_helpers.js';

/**
 * GET / POST /api/admin-assistant-creds
 * Strictly full-administrator only (role === 'admin'). Assistants are NEVER allowed here.
 * Manages assistant portal credentials using server-side scrypt hashing.
 */
export default async function handler(req: any, res: any) {
  setCorsHeaders(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }
  if (req.method === 'POST' && !verifyCsrfOrigin(req)) {
    return res.status(403).json({ success: false, error: 'Origin not allowed.' });
  }

  const authCheck = await requireFullAdmin(req);
  if (!authCheck.ok) {
    return res.status(authCheck.status).json({ success: false, error: authCheck.error });
  }

  if (req.method === 'GET') {
    const stored = await fetchStoredAssistantCredentials();
    if (stored) {
      return res.status(200).json({
        success: true,
        usernameDisplay: stored.usernameDisplay,
        isCustom: true,
        updatedAt: stored.updatedAt
      });
    }
    return res.status(200).json({
      success: true,
      usernameDisplay: process.env.ASSISTANT_USERNAME?.trim() || 'Not configured',
      isCustom: false
    });
  }

  const body = sanitizePayload(req.body || {});
  if (body.action === 'reset') {
    await resetAssistantCredentialsServer();
    return res.status(200).json({
      success: true,
      usernameDisplay: process.env.ASSISTANT_USERNAME?.trim() || 'Not configured',
      isCustom: false
    });
  }

  const cleanUser = typeof body.username === 'string' ? body.username.trim() : '';
  const cleanPass = typeof body.password === 'string' ? body.password.trim() : '';
  if (cleanUser.length < 3 || cleanUser.length > 64) {
    return res.status(400).json({ success: false, error: 'Username must be between 3 and 64 characters.' });
  }
  if (cleanPass.length < 8 || cleanPass.length > 128) {
    return res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });
  }

  const saved = await saveAssistantCredentialsServer(cleanUser, cleanPass);
  return res.status(200).json({
    success: true,
    usernameDisplay: saved.usernameDisplay,
    updatedAt: saved.updatedAt
  });
}
