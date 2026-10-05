import { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';
import { getAdminFirestore } from './_firebaseAdmin.js';

export default async function handler(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
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

  const { communityId, password } = body || {};

  if (!communityId || typeof communityId !== 'string') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: false, error: 'Community ID required.' }));
  }

  try {
    const db = getAdminFirestore();
    const commRef = db.collection('communities').doc(communityId);
    const commSnap = await commRef.get();

    if (!commSnap.exists) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: 'Community not found.' }));
    }

    const commData = commSnap.data();
    if (!commData || !commData.hasPassword || !commData.passwordHash || !commData.passwordSalt) {
      // No password on community
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, passwordVersion: commData?.passwordVersion || 1 }));
    }

    const inputPass = (password || '').trim();
    const derivedBuf = crypto.scryptSync(inputPass, commData.passwordSalt, 64);
    const expectedBuf = Buffer.from(commData.passwordHash, 'hex');

    let isValid = false;
    if (derivedBuf.length === expectedBuf.length) {
      isValid = crypto.timingSafeEqual(derivedBuf, expectedBuf);
    }

    if (isValid) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, passwordVersion: commData.passwordVersion || 1 }));
    } else {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: 'DECRYPTION FAILURE: Incendiary password. Access denied.' }));
    }
  } catch (err) {
    console.error('Community verification error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: false, error: 'Verification server error.' }));
  }
}
