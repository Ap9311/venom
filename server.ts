/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from './src/firebase';

import adminAuthHandler from './api/admin-auth';
import adminVerifyHandler from './api/admin-verify';
import adminTokenHandler from './api/admin-token';
import adminRegisterHandler from './api/admin-register';
import adminRevokeHandler from './api/admin-revoke';
import adminUpdateLimitHandler from './api/admin-update-limit';
import adminGateHandler from './api/admin-gate';
import adminAssistantCredsHandler from './api/admin-assistant-creds';
import assistantAuthHandler from './api/assistant-auth';
import portalResolveHandler from './api/portal-resolve';
import checkBlockHandler from './api/check-block';
import communityPinHandler from './api/community-pin';
import getIpHandler from './api/get-ip';
import adminManifestHandler from './api/admin-manifest';

process.on('unhandledRejection', (reason) => {
  console.warn('Unhandled Rejection caught in server:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception caught in server:', err);
});

function escapeHtmlAttr(input: unknown): string {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

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
  const safeHost = String(host || 'nonum.online').replace(/[^a-zA-Z0-9.:-]/g, '');
  const safeHash = encodeURIComponent(String(hashId || ''));
  const rawTitle = `Nonum — "${String(post.title || 'Anonymous Dispatch').slice(0, 120)}"`;
  const rawDesc = post.content
    ? String(post.content).substring(0, 160) + (String(post.content).length > 160 ? '...' : '')
    : 'Read this anonymous dispatch on Nonum.';

  let imageUrl = `https://${safeHost}/nonum-logo.svg`;
  if (typeof post.imageUrl === 'string') {
    if (post.imageUrl.startsWith('data:image/')) {
      imageUrl = `https://${safeHost}/api/post-image/${safeHash}`;
    } else if (post.imageUrl.startsWith('https://') || post.imageUrl.startsWith('http://')) {
      imageUrl = post.imageUrl;
    }
  }

  const shareUrl = `https://${safeHost}/?id=${safeHash}`;
  const title = escapeHtmlAttr(rawTitle);
  const description = escapeHtmlAttr(rawDesc);
  const safeImage = escapeHtmlAttr(imageUrl);
  const safeUrl = escapeHtmlAttr(shareUrl);

  return `
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${safeUrl}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${safeImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content="${safeUrl}" />
    <meta property="twitter:title" content="${title}" />
    <meta property="twitter:description" content="${description}" />
    <meta property="twitter:image" content="${safeImage}" />
  `;
}

const PROD_CSP = [
  "default-src 'self'",
  "script-src 'self' https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://ep1.adtrafficquality.google https://ep2.adtrafficquality.google https://adservice.google.com https://tpc.googlesyndication.com https://www.googletagmanager.com https://www.google.com https://apis.google.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com wss://*.firebaseio.com https://pagead2.googlesyndication.com https://ep1.adtrafficquality.google https://ep2.adtrafficquality.google https://googleads.g.doubleclick.net",
  "frame-src 'self' https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://ep2.adtrafficquality.google https://www.google.com https://*.firebaseapp.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'"
].join('; ');

async function startServer() {
  const app = express();
  const PORT = 3000;

  let vite: any = null;
  if (process.env.NODE_ENV !== 'production') {
    vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined
      },
      appType: 'spa'
    });
  }

  app.disable('x-powered-by');

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
      res.setHeader('Content-Security-Policy', PROD_CSP);
    }
    next();
  });

  // Cap JSON body sizes tightly on API routes to defend against payload DoS
  app.use('/api', express.json({ limit: '256kb' }));
  app.use(express.json({ limit: '2mb' }));

  const wrap = (fn: (req: any, res: any) => any) => async (req: express.Request, res: express.Response) => {
    try {
      await fn(req, res);
    } catch (err) {
      console.error('API handler error:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Internal Server Error' });
      }
    }
  };

  // Delegate ALL API endpoints to the single hardened /api/* handlers
  app.all(['/api/admin-auth', '/api/admin-login'], wrap(adminAuthHandler));
  app.all('/api/admin-register', wrap(adminRegisterHandler));
  app.all('/api/admin-verify', wrap(adminVerifyHandler));
  app.all('/api/admin-token', wrap(adminTokenHandler));
  app.all('/api/admin-revoke', wrap(adminRevokeHandler));
  app.all('/api/admin-update-limit', wrap(adminUpdateLimitHandler));
  app.all('/api/admin-gate', wrap(adminGateHandler));
  app.all('/api/admin-assistant-creds', wrap(adminAssistantCredsHandler));
  app.all('/api/assistant-auth', wrap(assistantAuthHandler));
  app.all('/api/portal-resolve', wrap(portalResolveHandler));
  app.all('/api/check-block', wrap(checkBlockHandler));
  app.all('/api/community-pin', wrap(communityPinHandler));
  app.all('/api/get-ip', wrap(getIpHandler));
  app.all(['/admin-manifest.json', '/api/admin-manifest'], wrap(adminManifestHandler));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Serve ads.txt directly as plain text so it never falls back to SPA HTML
  app.get('/ads.txt', (_req, res) => {
    const publicAdsPath = path.join(process.cwd(), 'public', 'ads.txt');
    const distAdsPath = path.join(process.cwd(), 'dist', 'ads.txt');
    const filePath = fs.existsSync(publicAdsPath) ? publicAdsPath : distAdsPath;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }
    return res.send('google.com, pub-1100709136611258, DIRECT, f08c47fec0942fa0\n');
  });

  app.get(['/favicon.ico', '/favicon.png'], (_req, res) => {
    res.redirect('/nonum-logo.svg');
  });

  app.get('/api/post-image/:hash', async (req, res) => {
    const hash = req.params.hash;
    if (!hash || !/^[A-Za-z0-9_-]{3,80}$/.test(hash)) {
      return res.redirect('/nonum-logo.svg');
    }

    try {
      const post = await getPostByHash(hash);
      if (post && typeof post.imageUrl === 'string') {
        if (post.imageUrl.startsWith('data:image/')) {
          const match = post.imageUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
          if (match) {
            const contentType = match[1];
            const buffer = Buffer.from(match[2], 'base64');
            res.setHeader('Content-Type', contentType);
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            return res.send(buffer);
          }
        }
        if (post.imageUrl.startsWith('https://')) {
          return res.redirect(post.imageUrl);
        }
      }
    } catch (err) {
      console.error('Error serving post image:', err);
    }
    res.redirect('/nonum-logo.svg');
  });

  app.get('/', async (req, res, next) => {
    const hashId = req.query.id;
    if (typeof hashId !== 'string' || !/^[A-Za-z0-9_-]{3,80}$/.test(hashId)) {
      return next();
    }

    try {
      const post = await getPostByHash(hashId);
      if (!post) return next();

      const ogTags = generateOgMetaTags(post, req.headers.host || 'nonum.online', hashId);

      if (process.env.NODE_ENV !== 'production' && vite) {
        const rawHtml = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');
        const viteHtml = await vite.transformIndexHtml(req.originalUrl || req.url, rawHtml);
        let modifiedHtml = viteHtml.replace(/<title>[^<]+<\/title>/g, '');
        modifiedHtml = modifiedHtml.replace('<head>', `<head>${ogTags}`);
        return res.setHeader('Content-Type', 'text/html; charset=utf-8').send(modifiedHtml);
      } else {
        const prodHtml = fs.readFileSync(path.join(process.cwd(), 'dist', 'index.html'), 'utf-8');
        let modifiedHtml = prodHtml.replace(/<title>[^<]+<\/title>/g, '');
        modifiedHtml = modifiedHtml.replace('<head>', `<head>${ogTags}`);
        return res.setHeader('Content-Type', 'text/html; charset=utf-8').send(modifiedHtml);
      }
    } catch (err) {
      console.error('Error in dynamic OG index route:', err);
      return next();
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    app.use(vite.middlewares);

    app.get('*', async (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.includes('.')) {
        return next();
      }
      try {
        const rawHtml = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');
        const viteHtml = await vite.transformIndexHtml(req.originalUrl || req.url, rawHtml);
        return res.setHeader('Content-Type', 'text/html; charset=utf-8').send(viteHtml);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));

    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
