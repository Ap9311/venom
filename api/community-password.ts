import { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';
import { getAdminFirestore } from './_firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';

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

  const { communityId, password } = body || {};

  if (!communityId || typeof communityId !== 'string') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: 'Community ID required.' }));
  }

  try {
    const db = getAdminFirestore();
    const commRef = db.collection('communities').doc(communityId);
    const passwordVersion = Date.now();

    if (password && typeof password === 'string' && password.trim().length > 0) {
      const salt = crypto.randomBytes(16).toString('hex');
      const hashBuffer = crypto.scryptSync(password.trim(), salt, 64);
      const passwordHash = hashBuffer.toString('hex');

      await commRef.set({
        passwordHash,
        passwordSalt: salt,
        hasPassword: true,
        passwordVersion,
        password: FieldValue.delete()
      }, { merge: true });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, hasPassword: true, passwordVersion }));
    } else {
      await commRef.set({
        passwordHash: null,
        passwordSalt: null,
        hasPassword: false,
        passwordVersion,
        password: FieldValue.delete()
      }, { merge: true });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, hasPassword: false, passwordVersion }));
    }
  } catch (err) {
    console.error('Failed setting community password:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: 'Server error setting community password.' }));
  }
}
