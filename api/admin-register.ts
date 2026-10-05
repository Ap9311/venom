import { IncomingMessage, ServerResponse } from 'http';
import { verifyUsername, verifyPassword, generateSessionToken } from './_authUtils.js';
import { getAdminAuth, getAdminFirestore } from './_firebaseAdmin.js';

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

  const { username, password, adminDeviceId, userImei = '', os = '', ip = '' } = body || {};

  if (!adminDeviceId || typeof adminDeviceId !== 'string') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: 'Device identifier required.' }));
  }

  const isUserValid = verifyUsername(username);
  const isPassValid = verifyPassword(password);

  if (!isUserValid || !isPassValid) {
    await new Promise((r) => setTimeout(r, 500));
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: 'Access Denied: Invalid credentials.' }));
  }

  try {
    const db = getAdminFirestore();
    const configRef = db.collection('interactions').doc('admin_global_config');
    const configSnap = await configRef.get();
    let maxAdmins = 3;
    if (configSnap.exists) {
      const confData = configSnap.data();
      if (confData && typeof confData.maxAdmins === 'number') {
        maxAdmins = confData.maxAdmins;
      }
    }

    const devicesSnap = await db.collection('interactions')
      .where('type', '==', 'admin_device')
      .get();

    const activeDevices = devicesSnap.docs.filter(d => d.data()?.status === 'active');
    const isAlreadyRegistered = activeDevices.some(d => d.data()?.adminDeviceId === adminDeviceId);

    if (!isAlreadyRegistered && activeDevices.length >= maxAdmins) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'Maximum admin device capacity reached.' }));
    }

    const deviceDocRef = db.collection('interactions').doc(`admin_device_${adminDeviceId}`);
    await deviceDocRef.set({
      type: 'admin_device',
      adminDeviceId,
      userImei,
      os,
      ip,
      registeredAt: new Date().toISOString(),
      label: `Admin Device #${activeDevices.length + 1}`,
      status: 'active'
    }, { merge: true });

    const sessionToken = generateSessionToken(adminDeviceId);
    let customToken: string | null = null;
    try {
      const auth = getAdminAuth();
      customToken = await auth.createCustomToken(adminDeviceId, { admin: true });
    } catch (e) {
      console.warn('Could not create custom token:', e);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      sessionToken,
      customToken,
      adminDeviceId
    }));
  } catch (err: any) {
    console.error('Registration failed:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: 'Registration server error.' }));
  }
}
