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

  const { ip, imei } = body || {};

  try {
    const db = getAdminFirestore();
    const now = new Date();

    if (ip) {
      const ipRef = db.collection('blockedIps').doc(ip);
      const ipSnap = await ipRef.get();
      if (ipSnap.exists) {
        const data = ipSnap.data();
        if (data && data.isBlocked && data.expiresAt) {
          const exp = new Date(data.expiresAt);
          if (now >= exp) {
            await ipRef.update({
              isBlocked: false,
              expiresAt: null,
              blockedAt: null,
              totalReports: 0
            });
          }
        }
      }
    }

    if (imei) {
      const imeiRef = db.collection('blockedImeis').doc(imei);
      const imeiSnap = await imeiRef.get();
      if (imeiSnap.exists) {
        const data = imeiSnap.data();
        if (data && data.isBlocked && data.expiresAt) {
          const exp = new Date(data.expiresAt);
          if (now >= exp) {
            await imeiRef.update({
              isBlocked: false,
              expiresAt: null,
              blockedAt: null
            });
          }
        }
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true }));
  } catch (err) {
    console.error('Unblock expired failed:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: 'Unblock server error.' }));
  }
}
