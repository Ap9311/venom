/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Migration Script: Community Password Scrypt Hashing
 * Migrates legacy plaintext community passwords to scrypt hashes + salts on Firestore.
 * 
 * DO NOT RUN THIS SCRIPT ON PRODUCTION WITHOUT USER CONFIRMATION!
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';

async function migrateCommunityPasswords() {
  console.log('[MIGRATION SCRIPT INITIALIZING]: Connecting to Firebase Admin...');

  const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  let serviceAccount: any = null;
  if (saEnv) {
    try {
      const decoded = saEnv.trim().startsWith('{') ? saEnv : Buffer.from(saEnv, 'base64').toString('utf-8');
      serviceAccount = JSON.parse(decoded);
    } catch (e) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT:', e);
    }
  }

  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'venom-9311';

  let app;
  if (getApps().length === 0) {
    if (serviceAccount) {
      app = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || projectId
      });
    } else {
      app = initializeApp({ projectId });
    }
  } else {
    app = getApps()[0]!;
  }

  const db = getFirestore(app);
  console.log('[MIGRATION SCRIPT]: Querying communities collection...');

  const commSnap = await db.collection('communities').get();
  console.log(`[MIGRATION SCRIPT]: Found ${commSnap.docs.length} total communities.`);

  let migratedCount = 0;
  for (const docSnap of commSnap.docs) {
    const data = docSnap.data();
    const rawPassword = data.password;

    if (rawPassword && typeof rawPassword === 'string' && rawPassword.trim().length > 0) {
      console.log(`[MIGRATION]: Hashing plaintext password for community ${docSnap.id} ("${data.name}")...`);
      const salt = crypto.randomBytes(16).toString('hex');
      const hashBuffer = crypto.scryptSync(rawPassword.trim(), salt, 64);
      const passwordHash = hashBuffer.toString('hex');

      await docSnap.ref.set({
        passwordHash,
        passwordSalt: salt,
        hasPassword: true,
        passwordVersion: Date.now(),
        password: FieldValue.delete()
      }, { merge: true });

      migratedCount++;
    } else if (data.password === '') {
      await docSnap.ref.set({
        passwordHash: null,
        passwordSalt: null,
        hasPassword: false,
        passwordVersion: Date.now(),
        password: FieldValue.delete()
      }, { merge: true });
    }
  }

  console.log(`[MIGRATION COMPLETE]: Successfully migrated ${migratedCount} communities to scrypt password hashes.`);
}

if (process.argv.includes('--run')) {
  migrateCommunityPasswords().catch(console.error);
} else {
  console.log('Migration script loaded. Pass --run flag to execute after setting up FIREBASE_SERVICE_ACCOUNT.');
}
