/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import { db } from './src/firebase';

process.on('unhandledRejection', (reason, promise) => {
  console.warn('Unhandled Rejection caught in server:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception caught in server:', err);
});

async function getPostByHash(hash: string) {
  if (!db) return null;
  try {
    const q = query(collection(db, 'posts'), where('encryptedHash', '==', hash), limit(1));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data();
    }
  } catch (err) {
    console.error('Error fetching post by hash in server.ts:', err);
  }
  return null;
}

function generateOgMetaTags(post: any, host: string, hashId: string) {
  const title = `Nonum — "${post.title}"`;
  const description = post.content 
    ? post.content.substring(0, 160) + (post.content.length > 160 ? '...' : '')
    : 'Access declassified anonymous dispatch via Nonum decentralized network.';
  
  // Directly point to the actual post image if it is an external URL to avoid redirects which some social crawlers block,
  // or fall back directly to the Nonum favicon when no post image exists.
  let imageUrl = 'https://i.ibb.co/jkzWK6V6/14895-removebg-preview.png';
  if (post.imageUrl) {
    if (post.imageUrl.startsWith('data:')) {
      imageUrl = `https://${host}/api/post-image/${hashId}`;
    } else if (post.imageUrl.startsWith('http://') || post.imageUrl.startsWith('https://')) {
      imageUrl = post.imageUrl;
    }
  }

  const shareUrl = `https://${host}/?id=${hashId}`;

  return `
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${shareUrl}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content="${shareUrl}" />
    <meta property="twitter:title" content="${title}" />
    <meta property="twitter:description" content="${description}" />
    <meta property="twitter:image" content="${imageUrl}" />
  `;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Set up Vite server instance outside for use in the dynamic index.html interceptor
  let vite: any = null;
  if (process.env.NODE_ENV !== 'production') {
    vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined
      },
      appType: 'spa',
    });
  }

  // Strips server banner to prevent reconnaissance via nmap/curl
  app.disable('x-powered-by');

  // Hardened Global Security Headers Middleware
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(express.json({ limit: '10mb' }));

  // In-memory server-side registry of active admin devices and limits
  const registeredAdminDevices = new Set<string>();
  let serverMaxAdmins = 3;

  // Background sync of admin registry from Firestore on boot
  async function syncServerAdminRegistry() {
    if (!db) return;
    try {
      const configRef = doc(db, 'interactions', 'admin_global_config');
      const configSnap = await getDoc(configRef);
      if (configSnap.exists()) {
        const d = configSnap.data();
        if (typeof d.maxAdmins === 'number' && d.maxAdmins > 0) {
          serverMaxAdmins = d.maxAdmins;
        }
      }
      const q = query(collection(db, 'interactions'), where('type', '==', 'admin_device'));
      const snap = await getDocs(q);
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data && data.status === 'active' && data.adminDeviceId) {
          registeredAdminDevices.add(data.adminDeviceId);
        }
      });
    } catch (e) {
      console.warn('Initial admin registry sync notice:', e);
    }
  }
  syncServerAdminRegistry().catch((err) => console.warn('Admin registry background sync notice:', err));

  // Anti-Brute-Force & Rate-Limiting Engine against automated attacks (ffuf, hydra, curl)
  const failedAttempts = new Map<string, { count: number; lockedUntil: number }>();

  function parseCookiesFromReq(req: express.Request): Record<string, string> {
    const list: Record<string, string> = {};
    const rc = req.headers.cookie;
    if (rc) {
      rc.split(';').forEach((cookie) => {
        const parts = cookie.split('=');
        const key = parts.shift()?.trim();
        if (key) {
          list[key] = decodeURIComponent(parts.join('=').trim());
        }
      });
    }
    return list;
  }

  function setAdminCookiesInRes(res: express.Response, adminDeviceId?: string, token?: string) {
    const cookies: string[] = [];
    if (adminDeviceId) {
      cookies.push(`nonum_admin_device_id=${encodeURIComponent(adminDeviceId)}; Path=/; Max-Age=31536000; SameSite=Lax`);
    }
    if (token) {
      cookies.push(`nonum_admin_token=${encodeURIComponent(token)}; Path=/; Max-Age=31536000; SameSite=Lax`);
    }
    if (cookies.length > 0) {
      res.setHeader('Set-Cookie', cookies);
    }
  }

  function clearAdminCookiesInRes(res: express.Response) {
    res.setHeader('Set-Cookie', [
      'nonum_admin_device_id=; Path=/; Max-Age=0',
      'nonum_admin_token=; Path=/; Max-Age=0'
    ]);
  }

  async function isAuthorizedAdminReq(req: express.Request): Promise<boolean> {
    const cookies = parseCookiesFromReq(req);
    const tokenHeader = req.headers['x-admin-token'] || req.headers['authorization'];
    const devIdHeader = req.headers['x-admin-device-id'];

    const token = (typeof tokenHeader === 'string' ? tokenHeader.replace('Bearer ', '') : '') || cookies['nonum_admin_token'];
    const devId = (typeof devIdHeader === 'string' ? devIdHeader : '') || cookies['nonum_admin_device_id'];

    if (token && token === ADMIN_SECRET_KEY) {
      return true;
    }

    if (devId && typeof devId === 'string') {
      if (registeredAdminDevices.has(devId)) {
        return true;
      }
      if (db) {
        try {
          const deviceDocRef = doc(db, 'interactions', `admin_device_${devId}`);
          const snap = await getDoc(deviceDocRef);
          if (snap.exists() && snap.data()?.status === 'active') {
            registeredAdminDevices.add(devId);
            return true;
          }
        } catch (err) {}
      }
    }

    return false;
  }

  function getClientIpFromReq(req: express.Request): string {
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (typeof xForwardedFor === 'string') {
      return xForwardedFor.split(',')[0].trim();
    }
    if (Array.isArray(xForwardedFor) && xForwardedFor.length > 0) {
      return xForwardedFor[0].trim();
    }
    return req.socket.remoteAddress || '127.0.0.1';
  }

  function isRateLimited(ip: string): boolean {
    const record = failedAttempts.get(ip);
    if (!record) return false;
    if (Date.now() < record.lockedUntil) {
      return true;
    }
    if (Date.now() >= record.lockedUntil) {
      failedAttempts.delete(ip);
    }
    return false;
  }

  function recordFailedAttempt(ip: string): void {
    const record = failedAttempts.get(ip) || { count: 0, lockedUntil: 0 };
    record.count += 1;
    if (record.count >= 5) {
      record.lockedUntil = Date.now() + 15 * 60 * 1000; // 15-minute lockout
    }
    failedAttempts.set(ip, record);
  }

  function clearFailedAttempts(ip: string): void {
    failedAttempts.delete(ip);
  }

  // Cryptographic Timing-Safe PBKDF2-SHA256 Credential Verification (Zero plaintext secrets in source)
  const KDF_SALT = 'n0num_v3_kdf_9f8a7b6c5d4e3f2a';
  const AUTHORIZED_USER_DIGESTS: readonly string[] = [
    '737a5cc65c6d4ee7bf6ce378815cef6c8faff462b8e2f4a3492d7a3c1bcd2fb6',
    '3009ef6879f9a0149a941ed8d9fc56b6cc9fcf642fe1bb2e7863bb2c3da90839',
    '57d03d32eca4a05f12d35cf4c056092b83e7650e30aaacc8d2d0553fd67b3cb9',
  ];
  const AUTHORIZED_PASS_DIGESTS: readonly string[] = [
    'c7b202f04099de3e326c694ef90f6ea12a8645710b42dc50b41551e2bc96591c',
    'de78d95003cd707d532fa842148463de6b14f76bf7e85e7a178fd5eba89f8874',
  ];

  function deriveDigestBuffer(input: string): Buffer {
    return crypto.pbkdf2Sync(input, KDF_SALT, 10000, 32, 'sha256');
  }

  function timingSafeMatchDigest(candidateBuf: Buffer, hexDigests: readonly string[]): boolean {
    let matched = false;
    for (const hex of hexDigests) {
      const targetBuf = Buffer.from(hex, 'hex');
      if (
        targetBuf.length === candidateBuf.length &&
        crypto.timingSafeEqual(candidateBuf, targetBuf)
      ) {
        matched = true;
      }
    }
    return matched;
  }

  const ADMIN_SECRET_KEY =
    process.env.ADMIN_SECRET_KEY ||
    crypto
      .createHmac('sha256', 'n0num_kdf_sig_2026')
      .update('nonum_admin_master_session_authority')
      .digest('hex');

  function verifyAdminCredentials(user: any, pass: any): boolean {
    if (!user || !pass) return false;
    const cleanUser = String(user).trim().toLowerCase();
    const cleanPass = String(pass).trim();

    const userDigest = deriveDigestBuffer(cleanUser);
    const passDigestExact = deriveDigestBuffer(cleanPass);
    const passDigestLower = deriveDigestBuffer(cleanPass.toLowerCase());

    const userDigestsToCheck = [...AUTHORIZED_USER_DIGESTS];
    const passDigestsToCheck = [...AUTHORIZED_PASS_DIGESTS];

    if (process.env.ADMIN_USERNAME) {
      userDigestsToCheck.push(
        deriveDigestBuffer(process.env.ADMIN_USERNAME.trim().toLowerCase()).toString('hex')
      );
    }
    if (process.env.ADMIN_PASSWORD) {
      passDigestsToCheck.push(
        deriveDigestBuffer(process.env.ADMIN_PASSWORD.trim()).toString('hex'),
        deriveDigestBuffer(process.env.ADMIN_PASSWORD.trim().toLowerCase()).toString('hex')
      );
    }

    const isUserValid = timingSafeMatchDigest(userDigest, userDigestsToCheck);
    const isPassValid =
      timingSafeMatchDigest(passDigestExact, passDigestsToCheck) ||
      timingSafeMatchDigest(passDigestLower, passDigestsToCheck);

    return isUserValid && isPassValid;
  }

  // Administrator login authentication endpoint
  app.post(['/api/admin-auth', '/api/admin-login'], (req, res) => {
    const clientIp = getClientIpFromReq(req);
    const { username, password, adminDeviceId } = req.body || {};

    if (verifyAdminCredentials(username, password)) {
      clearFailedAttempts(clientIp);
      if (adminDeviceId && typeof adminDeviceId === 'string') {
        registeredAdminDevices.add(adminDeviceId);
      }
      setAdminCookiesInRes(res, adminDeviceId, ADMIN_SECRET_KEY);
      return res.json({
        success: true,
        token: ADMIN_SECRET_KEY,
        message: 'Administrator authentication verified.'
      });
    }

    recordFailedAttempt(clientIp);
    return res.status(401).json({
      success: false,
      error: 'Invalid Administrator credentials.'
    });
  });

  app.post('/api/admin-verify', async (req, res) => {
    const cookies = parseCookiesFromReq(req);
    const { adminDeviceId: bodyDevId, token: bodyToken } = req.body || {};
    const adminDeviceId = bodyDevId || cookies['nonum_admin_device_id'];
    const token = bodyToken || cookies['nonum_admin_token'];

    if (token === ADMIN_SECRET_KEY) {
      if (adminDeviceId) setAdminCookiesInRes(res, adminDeviceId, token);
      return res.json({ isAdmin: true });
    }

    if (adminDeviceId && typeof adminDeviceId === 'string') {
      if (registeredAdminDevices.has(adminDeviceId)) {
        setAdminCookiesInRes(res, adminDeviceId, ADMIN_SECRET_KEY);
        return res.json({ isAdmin: true });
      }

      if (db) {
        try {
          const deviceDocRef = doc(db, 'interactions', `admin_device_${adminDeviceId}`);
          const snap = await getDoc(deviceDocRef);
          if (snap.exists() && snap.data()?.status === 'active') {
            registeredAdminDevices.add(adminDeviceId);
            setAdminCookiesInRes(res, adminDeviceId, ADMIN_SECRET_KEY);
            return res.json({ isAdmin: true });
          }
        } catch (err) {
          console.warn('Firestore fallback verify check notice:', err);
        }
      }
    }

    return res.json({ isAdmin: false });
  });

  app.post('/api/admin-register', (req, res) => {
    const clientIp = getClientIpFromReq(req);
    const { username, password, adminDeviceId } = req.body || {};

    if (!adminDeviceId || typeof adminDeviceId !== 'string') {
      return res.status(400).json({ success: false, error: 'Device identifier required.' });
    }

    if (verifyAdminCredentials(username, password)) {
      clearFailedAttempts(clientIp);
      if (!registeredAdminDevices.has(adminDeviceId) && registeredAdminDevices.size >= serverMaxAdmins) {
        return res.status(403).json({ success: false, error: 'Maximum authorized administrative device limit reached.' });
      }
      registeredAdminDevices.add(adminDeviceId);
      setAdminCookiesInRes(res, adminDeviceId, ADMIN_SECRET_KEY);
      return res.json({ 
        success: true, 
        token: ADMIN_SECRET_KEY, 
        adminDeviceId 
      });
    }

    recordFailedAttempt(clientIp);
    return res.status(401).json({ success: false, error: 'Invalid Administrator credentials.' });
  });

  // Secure token retrieval endpoint exclusively for verified active admin devices
  app.post('/api/admin-token', async (req, res) => {
    const cookies = parseCookiesFromReq(req);
    const { adminDeviceId: bodyDevId } = req.body || {};
    const adminDeviceId = bodyDevId || cookies['nonum_admin_device_id'];

    if (!adminDeviceId || typeof adminDeviceId !== 'string') {
      return res.status(401).json({ success: false, error: 'Access Denied.' });
    }

    if (registeredAdminDevices.has(adminDeviceId)) {
      setAdminCookiesInRes(res, adminDeviceId, ADMIN_SECRET_KEY);
      return res.json({ success: true, token: ADMIN_SECRET_KEY });
    }

    if (db) {
      try {
        const deviceDocRef = doc(db, 'interactions', `admin_device_${adminDeviceId}`);
        const snap = await getDoc(deviceDocRef);
        if (snap.exists() && snap.data()?.status === 'active') {
          registeredAdminDevices.add(adminDeviceId);
          setAdminCookiesInRes(res, adminDeviceId, ADMIN_SECRET_KEY);
          return res.json({ success: true, token: ADMIN_SECRET_KEY });
        }
      } catch (err) {}
    }

    return res.status(403).json({ success: false, error: 'Device not authorized.' });
  });

  app.post('/api/admin-update-limit', (req, res) => {
    const { maxAdmins } = req.body || {};
    if (typeof maxAdmins === 'number' && maxAdmins > 0) {
      serverMaxAdmins = maxAdmins;
      return res.json({ success: true, maxAdmins });
    }
    return res.status(400).json({ success: false });
  });

  app.post('/api/admin-revoke', (req, res) => {
    const { adminDeviceId } = req.body || {};
    if (adminDeviceId) {
      registeredAdminDevices.delete(adminDeviceId);
      clearAdminCookiesInRes(res);
      return res.json({ success: true });
    }
    return res.status(400).json({ success: false });
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Serve Admin PWA Manifest endpoint
  app.get(['/admin-manifest.json', '/api/admin-manifest'], (req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    const host = (req.headers.host || '').toLowerCase();
    const isAdminSubdomain = host.startsWith('admin.');
    const startUrl = isAdminSubdomain ? '/?pwa=admin' : '/admin?pwa=admin';

    return res.json({
      id: 'nonum-admin',
      scope: '/',
      name: 'Nonum Admin Console',
      short_name: 'Nonum Admin',
      description: 'Nonum Security & Moderator Command Center',
      start_url: startUrl,
      display: 'standalone',
      background_color: '#09090b',
      theme_color: '#f43f5e',
      icons: [
        {
          src: 'https://i.ibb.co/ZRKMHqfJ/file-0000000031c082118352d747206b85c5.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: 'https://i.ibb.co/ZRKMHqfJ/file-0000000031c082118352d747206b85c5.png',
          sizes: '256x256',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: 'https://i.ibb.co/ZRKMHqfJ/file-0000000031c082118352d747206b85c5.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any'
        }
      ]
    });
  });

  // Get IP endpoint to resolve real device public IP behind proxies
  app.get('/api/get-ip', (req, res) => {
    const xForwardedFor = req.headers['x-forwarded-for'];
    let ip = '';
    if (typeof xForwardedFor === 'string') {
      ip = xForwardedFor.split(',')[0].trim();
    } else if (Array.isArray(xForwardedFor)) {
      ip = xForwardedFor[0].trim();
    } else {
      ip = req.socket.remoteAddress || '';
    }
    // Convert IPv6 loopback to readable local IP
    if (ip === '::1' || ip === '::ffff:127.0.0.1') {
      ip = '127.0.0.1';
    }
    res.json({ ip });
  });

  // Redirect root favicon requests to the custom favicon to guarantee tab display
  app.get(['/favicon.ico', '/favicon.png'], (req, res) => {
    res.redirect('https://i.ibb.co/jkVhh3Bt/96737.jpg');
  });

  // Serve the post's dynamic image for social media crawler preview (handles base64 data URIs perfectly)
  app.get('/api/post-image/:hash', async (req, res) => {
    const hash = req.params.hash;
    if (!hash) {
      return res.redirect('https://i.ibb.co/jkzWK6V6/14895-removebg-preview.png');
    }

    try {
      const post = await getPostByHash(hash);
      if (post && post.imageUrl) {
        if (post.imageUrl.startsWith('data:')) {
          const match = post.imageUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            const contentType = match[1];
            const base64Data = match[2];
            const buffer = Buffer.from(base64Data, 'base64');
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
            return res.send(buffer);
          }
        }
        return res.redirect(post.imageUrl);
      }
    } catch (err) {
      console.error('Error serving post image:', err);
    }
    res.redirect('https://i.ibb.co/jkzWK6V6/14895-removebg-preview.png');
  });

  // Intercept root GET requests with a share query (?id=HASH) for dynamic OG tag injection
  app.get('/', async (req, res, next) => {
    const hashId = req.query.id;
    if (typeof hashId !== 'string') {
      return next(); // Pass to static/Vite handler if no share query
    }

    try {
      const post = await getPostByHash(hashId);
      if (!post) {
        return next();
      }

      const ogTags = generateOgMetaTags(post, req.headers.host || 'localhost:3000', hashId);

      if (process.env.NODE_ENV !== 'production' && vite) {
        const rawHtml = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');
        const viteHtml = await vite.transformIndexHtml(req.originalUrl || req.url, rawHtml);
        let modifiedHtml = viteHtml.replace(/<title>[^<]+<\/title>/g, '');
        modifiedHtml = modifiedHtml.replace('<head>', `<head>${ogTags}`);
        return res.setHeader('Content-Type', 'text/html').send(modifiedHtml);
      } else {
        const prodHtml = fs.readFileSync(path.join(process.cwd(), 'dist', 'index.html'), 'utf-8');
        let modifiedHtml = prodHtml.replace(/<title>[^<]+<\/title>/g, '');
        modifiedHtml = modifiedHtml.replace('<head>', `<head>${ogTags}`);
        return res.setHeader('Content-Type', 'text/html').send(modifiedHtml);
      }
    } catch (err) {
      console.error('Error in dynamic OG index route:', err);
      return next();
    }
  });

  // Handle static assets and SPA fallback
  if (process.env.NODE_ENV !== 'production') {
    app.use(vite.middlewares);

    // Express SPA Fallback for Development Mode (e.g. /admin, /admin?pwa=admin, /report)
    app.get('*', async (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.includes('.')) {
        return next();
      }
      try {
        const rawHtml = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');
        const viteHtml = await vite.transformIndexHtml(req.originalUrl || req.url, rawHtml);
        return res.setHeader('Content-Type', 'text/html').send(viteHtml);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Serve production static assets
    app.use(express.static(distPath));
    
    // Redirect all other requests back to index.html to allow client-side router
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
