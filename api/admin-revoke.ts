import { IncomingMessage, ServerResponse } from 'http';
import { verifySessionToken } from './_authUtils.js';
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

  const { sessionToken, adminDeviceId } = body || {};

  const verification = verifySessionToken(sessionToken);
  if (!verification.valid) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: 'Unauthorized.' }));
  }

  try {
    const db = getAdminFirestore();
    const docRef = db.collection('interactions').doc(`admin_device_${adminDeviceId}`);
    await docRef.set({
      status: 'revoked',
      revokedAt: new Date().toISOString()
    }, { merge: true });
    await docRef.delete();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true }));
  } catch (err) {
    console.error('Revoke admin device failed:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: 'Revoke failed.' }));
  }
}
