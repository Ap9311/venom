import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let adminApp: App | null = null;

export function getAdminApp(): App {
  if (adminApp) return adminApp;
  const existingApps = getApps();
  if (existingApps.length > 0) {
    adminApp = existingApps[0];
    return adminApp;
  }

  const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  let serviceAccount: any = null;
  if (saEnv) {
    try {
      const decoded = saEnv.trim().startsWith('{') ? saEnv : Buffer.from(saEnv, 'base64').toString('utf-8');
      serviceAccount = JSON.parse(decoded);
    } catch (e) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT env var:', e);
    }
  }

  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'venom-9311';

  if (serviceAccount) {
    adminApp = initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id || projectId
    });
  } else {
    adminApp = initializeApp({
      projectId
    });
  }

  return adminApp;
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminFirestore() {
  return getFirestore(getAdminApp());
}
