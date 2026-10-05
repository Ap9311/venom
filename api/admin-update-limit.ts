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

  const { sessionToken, maxAdmins } = body || {};

  const verification = verifySessionToken(sessionToken);
  if (!verification.valid) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: 'Unauthorized.' }));
  }

  if (typeof maxAdmins !== 'number' || maxAdmins < 1) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: 'Invalid limit value.' }));
  }

  try {
    const db = getAdminFirestore();
    const configRef = db.collection('interactions').doc('admin_global_config');
    await configRef.set({
      type: 'admin_config',
      maxAdmins,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, maxAdmins }));
  } catch (err) {
    console.error('Update limit failed:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: 'Update failed.' }));
  }
}
