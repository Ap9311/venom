import { IncomingMessage, ServerResponse } from 'http';
import { getAdminFirestore } from './_firebaseAdmin.js';

export default async function handler(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
  }

  let body = req.body;
  if (!body) {
    try {
      const buffers = [];
      for await (const chunk of req) {
        buffers.push(chunk);
      }
      body = JSON.parse(Buffer.concat(buffers).toString('utf-8'));
    } catch {
      body = {};
    }
  }

  const { ip, imei, reason, blockType, expiresAt, triggerPostId, blockData } = body || {};

  try {
    const db = getAdminFirestore();

    if (ip) {
      const ipRef = db.collection('blockedIps').doc(ip);
      await ipRef.set({
        isBlocked: true,
        reason: reason || 'Community Guidelines Violation',
        blockType: blockType || 'temporary',
        expiresAt: expiresAt || null,
        blockedAt: new Date().toISOString(),
        triggerPostId: triggerPostId || null,
        ...(blockData || {})
      }, { merge: true });
    }

    if (imei) {
      const imeiRef = db.collection('blockedImeis').doc(imei);
      await imeiRef.set({
        isBlocked: true,
        reason: reason || 'Community Guidelines Violation',
        blockType: blockType || 'temporary',
        expiresAt: expiresAt || null,
        blockedAt: new Date().toISOString(),
        triggerPostId: triggerPostId || null
      }, { merge: true });
    }

    if (triggerPostId) {
      const postRef = db.collection('posts').doc(triggerPostId);
      await postRef.set({
        isDeleted: true,
        deletedAt: new Date().toISOString(),
        deletedReason: 'Auto-quarantined due to report thresholds'
      }, { merge: true });
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true }));
  } catch (err) {
    console.error('Auto-block failed:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: 'Auto-block server error.' }));
  }
}
