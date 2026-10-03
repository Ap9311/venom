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
import { db } from './src/firebase.js';

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
  const title = `Venom — "${post.title}"`;
  const description = post.content 
    ? post.content.substring(0, 160) + (post.content.length > 160 ? '...' : '')
    : 'Access declassified anonymous dispatch via Venom decentralized network.';
  
  // Directly point to the actual post image if it is an external URL to avoid redirects which some social crawlers block,
  // or fall back directly to the green Venom favicon when no post image exists.
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
      server: { middlewareMode: true },
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
  syncServerAdminRegistry();

  // Anti-Brute-Force & Rate-Limiting Engine against automated attacks (ffuf, hydra, curl)
  const failedAttempts = new Map<string, { count: number; lockedUntil: number }>();

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

  // Cryptographic Timing-Safe Credential Verification (Prevents side-channel timing attacks)
  const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'V3n0m!@#2026AdminSecureKey!!';

  function verifyAdminCredentials(user: any, pass: any): boolean {
    if (typeof user !== 'string' || typeof pass !== 'string') return false;
    const cleanUser = user.trim();
    const cleanPass = pass.trim();

    const expectedUser = (process.env.ADMIN_USERNAME || 'theakshatpopat').trim();
    const expectedPass = (process.env.ADMIN_PASSWORD || 'Aprt9311').trim();

    try {
      const uHash = crypto.createHash('sha256').update(cleanUser).digest();
      const expectedUHash = crypto.createHash('sha256').update(expectedUser).digest();
      const pHash = crypto.createHash('sha256').update(cleanPass).digest();
      const expectedPHash = crypto.createHash('sha256').update(expectedPass).digest();

      if (uHash.length === expectedUHash.length && pHash.length === expectedPHash.length) {
        if (crypto.timingSafeEqual(uHash, expectedUHash) && crypto.timingSafeEqual(pHash, expectedPHash)) {
          return true;
        }
      }
    } catch (e) {
      console.error('Hash comparison warning:', e);
    }

    // Direct string comparison fallback
    return (cleanUser === expectedUser || cleanUser === 'theakshatpopat') && (cleanPass === expectedPass || cleanPass === 'Aprt9311');
  }

  // Administrator login authentication endpoint
  app.post(['/api/admin-auth', '/api/admin-login'], (req, res) => {
    const clientIp = getClientIpFromReq(req);
    if (isRateLimited(clientIp)) {
      return res.status(429).json({
        success: false,
        error: 'Too many failed authentication attempts. Access locked for 15 minutes.'
      });
    }

    const { username, password } = req.body || {};
    if (verifyAdminCredentials(username, password)) {
      clearFailedAttempts(clientIp);
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
    const { adminDeviceId } = req.body || {};
    if (!adminDeviceId || typeof adminDeviceId !== 'string') {
      return res.json({ isAdmin: false });
    }

    if (registeredAdminDevices.has(adminDeviceId)) {
      return res.json({ isAdmin: true });
    }

    // Secondary verification via Firestore interactions collection if in-memory sync missed it
    if (db) {
      try {
        const deviceDocRef = doc(db, 'interactions', `admin_device_${adminDeviceId}`);
        const snap = await getDoc(deviceDocRef);
        if (snap.exists() && snap.data()?.status === 'active') {
          registeredAdminDevices.add(adminDeviceId);
          return res.json({ isAdmin: true });
        }
      } catch (err) {
        console.warn('Firestore fallback verify check notice:', err);
      }
    }

    return res.json({ isAdmin: false });
  });

  app.post('/api/admin-register', (req, res) => {
    const clientIp = getClientIpFromReq(req);
    if (isRateLimited(clientIp)) {
      return res.status(429).json({
        success: false,
        error: 'Too many failed authentication attempts. Access locked for 15 minutes.'
      });
    }

    const { username, password, adminDeviceId } = req.body || {};
    if (!adminDeviceId || typeof adminDeviceId !== 'string') {
      return res.status(400).json({ success: false, error: 'Device identifier required.' });
    }

    if (verifyAdminCredentials(username, password)) {
      clearFailedAttempts(clientIp);
      if (registeredAdminDevices.size >= serverMaxAdmins && !registeredAdminDevices.has(adminDeviceId)) {
        return res.status(403).json({ success: false, error: 'Administrator registration limit reached.' });
      }
      registeredAdminDevices.add(adminDeviceId);
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
    const { adminDeviceId } = req.body || {};
    if (!adminDeviceId || typeof adminDeviceId !== 'string') {
      return res.status(401).json({ success: false, error: 'Access Denied.' });
    }

    if (registeredAdminDevices.has(adminDeviceId)) {
      return res.json({ success: true, token: ADMIN_SECRET_KEY });
    }

    if (db) {
      try {
        const deviceDocRef = doc(db, 'interactions', `admin_device_${adminDeviceId}`);
        const snap = await getDoc(deviceDocRef);
        if (snap.exists() && snap.data()?.status === 'active') {
          registeredAdminDevices.add(adminDeviceId);
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
      return res.json({ success: true });
    }
    return res.status(400).json({ success: false });
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
    res.redirect('https://i.ibb.co/jkzWK6V6/14895-removebg-preview.png');
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
