import { IncomingMessage, ServerResponse } from 'http';
import { verifySessionToken } from './_authUtils.js';
import { getAdminFirestore } from './_firebaseAdmin.js';

export default async function handler(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ isAdmin: false }));
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

  if (!sessionToken || !adminDeviceId) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ isAdmin: false }));
  }

  const verification = verifySessionToken(sessionToken);
  if (!verification.valid || verification.adminDeviceId !== adminDeviceId) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ isAdmin: false }));
  }

  try {
    const db = getAdminFirestore();
    const docRef = db.collection('interactions').doc(`admin_device_${adminDeviceId}`);
    const snap = await docRef.get();
    if (snap.exists && snap.data()?.status === 'active') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ isAdmin: true }));
    }
  } catch (err) {
    console.warn('Admin verify check notice:', err);
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ isAdmin: false }));
}
