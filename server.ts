/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { collection, query, where, getDocs, limit, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
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

  // Health check endpoint
  // OWASP Hardened Security Headers & Stack Obfuscation
  app.disable('x-powered-by');

  // Payload size limit to prevent memory exhaustion DoS
  app.use(express.json({ limit: '500kb' }));

  // In-memory server-side registry of active admin devices and limits
  const registeredAdminDevices = new Set<string>();
  let serverMaxAdmins = 3;

  // Rate limiting and anti-brute-force tracker
  interface RateLimitEntry {
    count: number;
    resetTime: number;
  }
  const apiRateLimits = new Map<string, RateLimitEntry>();
  const loginFailures = new Map<string, { count: number; lockedUntil: number }>();

  function getClientIpFromReq(req: express.Request): string {
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (typeof xForwardedFor === 'string') {
      return xForwardedFor.split(',')[0].trim();
    }
    if (Array.isArray(xForwardedFor)) {
      return xForwardedFor[0].trim();
    }
    return req.socket.remoteAddress || '127.0.0.1';
  }

  function checkGeneralRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = apiRateLimits.get(ip);
    if (!entry || now > entry.resetTime) {
      apiRateLimits.set(ip, { count: 1, resetTime: now + 60000 });
      return true;
    }
    entry.count++;
    if (entry.count > 150) {
      return false; // Exceeded 150 requests per minute
    }
    return true;
  }

  function checkLoginBruteForce(ip: string): { allowed: boolean; waitSeconds?: number } {
    const now = Date.now();
    const record = loginFailures.get(ip);
    if (record && record.lockedUntil > now) {
      return { allowed: false, waitSeconds: Math.ceil((record.lockedUntil - now) / 1000) };
    }
    return { allowed: true };
  }

  function recordLoginFailure(ip: string) {
    const now = Date.now();
    const record = loginFailures.get(ip) || { count: 0, lockedUntil: 0 };
    record.count++;
    if (record.count >= 5) {
      record.lockedUntil = now + 15 * 60 * 1000; // 15-minute brute-force lockout
    }
    loginFailures.set(ip, record);
  }

  function recordLoginSuccess(ip: string) {
    loginFailures.delete(ip);
  }

  const SERVER_HMAC_SECRET = process.env.VENOM_SECRET || 'VENOM_ADMIN_HARDWARE_KEY_2026_SECURE_HASH';
  const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'theakshatpopat';
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Aprt9311';

  function safeCompare(a: any, b: any): boolean {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      crypto.timingSafeEqual(bufA, bufA);
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  }

  function createAdminToken(deviceId: string): string {
    const timestamp = Date.now();
    const signature = crypto.createHmac('sha256', SERVER_HMAC_SECRET)
      .update(`${deviceId}:${timestamp}`)
      .digest('hex');
    return `VNM_${timestamp}_${signature}`;
  }

  // Security Headers Middleware
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
    
    // Block rapid scanning / ffuf directory probing on /api
    if (req.path.startsWith('/api/')) {
      const clientIp = getClientIpFromReq(req);
      if (!checkGeneralRateLimit(clientIp)) {
        return res.status(429).json({ error: 'Too many requests. Please slow down.' });
      }
    }
    next();
  });

  // Administrator login authentication endpoint
  app.post(['/api/admin-auth', '/api/admin-login'], (req, res) => {
    const clientIp = getClientIpFromReq(req);
    const bfCheck = checkLoginBruteForce(clientIp);
    if (!bfCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: `Account temporarily locked due to repeated failed attempts. Retry in ${bfCheck.waitSeconds}s.`
      });
    }

    const { username, password } = req.body || {};
    if (safeCompare(username, ADMIN_USERNAME) && safeCompare(password, ADMIN_PASSWORD)) {
      recordLoginSuccess(clientIp);
      const sessionToken = createAdminToken('ADMIN_SESSION');
      return res.json({
        success: true,
        token: 'V3n0m!@#2026AdminSecureKey!!',
        sessionToken,
        message: 'Administrator authentication verified.'
      });
    }
    recordLoginFailure(clientIp);
    return res.status(401).json({
      success: false,
      error: 'Invalid Administrator credentials.'
    });
  });

  // Hardware Admin Device status verification
  app.post('/api/admin-verify', async (req, res) => {
    const { adminDeviceId } = req.body || {};
    if (!adminDeviceId || typeof adminDeviceId !== 'string') {
      return res.json({ isAdmin: false });
    }

    if (registeredAdminDevices.has(adminDeviceId)) {
      return res.json({ isAdmin: true });
    }

    // Authoritative check against Firestore interactions collection
    if (db) {
      try {
        const deviceDocRef = doc(db, 'interactions', `admin_device_${adminDeviceId}`);
        const snap = await getDoc(deviceDocRef);
        if (snap.exists() && snap.data()?.status === 'active') {
          registeredAdminDevices.add(adminDeviceId);
          return res.json({ isAdmin: true });
        }
      } catch (err) {
        console.error('Error verifying admin device in Firestore:', err);
      }
    }

    return res.json({ isAdmin: false });
  });

  // Hardware Admin Device Registration
  app.post('/api/admin-register', async (req, res) => {
    const clientIp = getClientIpFromReq(req);
    const bfCheck = checkLoginBruteForce(clientIp);
    if (!bfCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: `Too many failed attempts. Temporary lockout for ${bfCheck.waitSeconds}s.`
      });
    }

    const { username, password, adminDeviceId, userImei, os, deviceDetails, ip } = req.body || {};
    if (!safeCompare(username, ADMIN_USERNAME) || !safeCompare(password, ADMIN_PASSWORD) || !adminDeviceId) {
      recordLoginFailure(clientIp);
      return res.status(401).json({ success: false, error: 'Access Denied: Invalid credentials.' });
    }

    recordLoginSuccess(clientIp);

    // Check capacity limit from Firestore
    let currentLimit = serverMaxAdmins;
    if (db) {
      try {
        const confSnap = await getDoc(doc(db, 'interactions', 'admin_global_config'));
        if (confSnap.exists() && typeof confSnap.data()?.maxAdmins === 'number') {
          currentLimit = confSnap.data()?.maxAdmins;
        }
      } catch {}
    }

    if (registeredAdminDevices.size >= currentLimit && !registeredAdminDevices.has(adminDeviceId)) {
      return res.status(403).json({ success: false, error: 'Admin device limit reached.' });
    }

    registeredAdminDevices.add(adminDeviceId);

    // Save directly to Firestore from backend as well
    if (db) {
      try {
        const deviceDocRef = doc(db, 'interactions', `admin_device_${adminDeviceId}`);
        await setDoc(deviceDocRef, {
          type: 'admin_device',
          adminDeviceId,
          userImei: userImei || '',
          os: os || '',
          deviceDetails: deviceDetails || '',
          ip: ip || clientIp,
          registeredAt: new Date().toISOString(),
          label: `Admin Device #${registeredAdminDevices.size}`,
          status: 'active'
        }, { merge: true });
      } catch (err) {
        console.error('Error writing admin device in Firestore:', err);
      }
    }

    const sessionToken = createAdminToken(adminDeviceId);
    return res.json({
      success: true,
      adminDeviceId,
      token: 'V3n0m!@#2026AdminSecureKey!!',
      sessionToken
    });
  });

  // Admin Claim endpoint for Firestore rules authorization
  app.post('/api/admin-claim', async (req, res) => {
    const { adminDeviceId, uid } = req.body || {};
    if (!adminDeviceId || !uid) {
      return res.status(400).json({ success: false, error: 'Missing parameters' });
    }

    let isAuthorized = registeredAdminDevices.has(adminDeviceId);
    if (!isAuthorized && db) {
      try {
        const snap = await getDoc(doc(db, 'interactions', `admin_device_${adminDeviceId}`));
        if (snap.exists() && snap.data()?.status === 'active') {
          isAuthorized = true;
          registeredAdminDevices.add(adminDeviceId);
        }
      } catch {}
    }

    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Unauthorized device' });
    }

    if (db) {
      try {
        const adminRef = doc(db, 'admins', uid);
        await setDoc(adminRef, {
          isAdmin: true,
          secretKey: 'V3n0m!@#2026AdminSecureKey!!',
          registeredAt: new Date().toISOString()
        }, { merge: true });
        return res.json({ success: true });
      } catch (e) {
        console.error('Error claiming admin role in firestore:', e);
      }
    }
    return res.json({ success: true, token: 'V3n0m!@#2026AdminSecureKey!!' });
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
