import { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  setCorsHeaders,
  parseJsonBody,
  verifyAssistantCredentials,
  ADMIN_SECRET_KEY
} from './_helpers.js';

let cachedDb: any = null;
let cachedAuth: any = null;

function getServerFirebase() {
  if (cachedDb && cachedAuth) {
    return { db: cachedDb, auth: cachedAuth };
  }

  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (!fs.existsSync(configPath)) {
    return { db: null, auth: null };
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const app = getApps().length > 0 ? getApp() : initializeApp(config);
  cachedDb = getFirestore(app, config.firestoreDatabaseId || '(default)');
  cachedAuth = getAuth(app);
  return { db: cachedDb, auth: cachedAuth };
}

async function fetchCustomAssistantCredentials(): Promise<{
  usernameHash?: string;
  passwordHash?: string;
} | null> {
  try {
    const { db, auth } = getServerFirebase();
    if (!db || !auth) return null;

    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }

    if (auth.currentUser) {
      await setDoc(
        doc(db, 'admins', auth.currentUser.uid),
        {
          isAdmin: true,
          secretKey: ADMIN_SECRET_KEY,
          registeredAt: new Date().toISOString()
        },
        { merge: true }
      );
    }

    const snap = await getDoc(doc(db, 'admin_config', 'assistant_credentials'));
    if (snap.exists()) {
      const data = snap.data() as any;
      if (data?.usernameHash && data?.passwordHash) {
        return {
          usernameHash: data.usernameHash,
          passwordHash: data.passwordHash
        };
      }
    }
  } catch (err) {
    console.warn('Assistant credential Firestore lookup fallback:', err);
  }
  return null;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    setCorsHeaders(res, req);

    if (req.method === 'OPTIONS') {
      res.statusCode = 200;
      return res.end();
    }

    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ success: false, error: 'Method Not Allowed' }));
    }

    const body = await parseJsonBody(req);
    const { username, password } = body || {};

    const customCreds = await fetchCustomAssistantCredentials();

    if (verifyAssistantCredentials(username, password, customCreds)) {
      // Ephemeral one-time assistant session: NEVER set persistent admin cookies or register admin device IDs
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(
        JSON.stringify({
          success: true,
          token: ADMIN_SECRET_KEY,
          role: 'assistant',
          message: 'Assistant session verified.'
        })
      );
    }

    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(
      JSON.stringify({
        success: false,
        error: 'Invalid Assistant credentials.'
      })
    );
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ success: false, error: err?.message || 'Server Error' }));
  }
}
