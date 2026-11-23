/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * One-time Firestore PII & Leaked Hash Cleanup Migration Script
 * -----------------------------------------------------------------------------
 * Removes personal identifiers (IP, IMEI, serial, device strings) and legacy
 * public PIN hashes (passwordHash / password) from existing Firestore documents:
 *   - posts
 *   - communities (+ nested chats, comments, visits)
 *   - interactions
 *   - reports
 *
 * Usage (run locally from a trusted machine with FIRESTORE_BRIDGE_KEY set in env
 * matching private_config/server_auth { key } in Firestore):
 *   npx tsx scripts/strip-pii-migration.ts
 */

import 'dotenv/config';
import {
  collection,
  getDocs,
  updateDoc,
  deleteField,
  doc,
  setDoc
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { db, auth } from '../src/firebase';

const PII_FIELDS_TO_REMOVE = [
  'postedFromIp',
  'postedFromImei',
  'postedFromSerial',
  'postedFromDevice',
  'postedFromDeviceType',
  'createdByIp',
  'createdByImei',
  'createdBySerial',
  'createdByDeviceType',
  'reporterIp',
  'reporterImei',
  'reporterSerial',
  'ip',
  'imei',
  'serial',
  'passwordHash',
  'password'
];

function buildCleanupUpdate(data: Record<string, any>): Record<string, any> | null {
  const updates: Record<string, any> = {};
  let hasChanges = false;

  for (const field of PII_FIELDS_TO_REMOVE) {
    if (Object.prototype.hasOwnProperty.call(data, field)) {
      updates[field] = deleteField();
      hasChanges = true;
    }
  }

  // If a community previously had an exposed public password/passwordHash, mark hasPin: false
  // so owners can set a fresh server-protected PIN via /api/community-pin.
  if (
    (Object.prototype.hasOwnProperty.call(data, 'passwordHash') ||
      Object.prototype.hasOwnProperty.call(data, 'password')) &&
    data.hasPin !== true
  ) {
    updates.hasPin = false;
    hasChanges = true;
  }

  return hasChanges ? updates : null;
}

async function scrubCollection(collectionPath: string) {
  const snap = await getDocs(collection(db, collectionPath));
  let updated = 0;

  for (const d of snap.docs) {
    const patch = buildCleanupUpdate(d.data() as Record<string, any>);
    if (patch) {
      await updateDoc(d.ref, patch);
      updated++;
    }
  }

  console.log(`[${collectionPath}] scanned ${snap.size} docs, scrubbed ${updated}`);
  return snap.docs;
}

async function main() {
  const bridgeKey = process.env.FIRESTORE_BRIDGE_KEY?.trim();
  if (!bridgeKey) {
    console.error('Missing FIRESTORE_BRIDGE_KEY in environment.');
    process.exit(1);
  }

  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }

  if (auth.currentUser) {
    await setDoc(
      doc(db, 'admins', auth.currentUser.uid),
      {
        isAdmin: true,
        role: 'admin',
        serverAuthKey: bridgeKey,
        expiresAt: Date.now() + 30 * 60 * 1000,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );
  }

  await scrubCollection('posts');
  await scrubCollection('interactions');
  await scrubCollection('reports');

  const commDocs = await scrubCollection('communities');
  for (const c of commDocs) {
    const chatDocs = await scrubCollection(`communities/${c.id}/chats`);
    for (const ch of chatDocs) {
      await scrubCollection(`communities/${c.id}/chats/${ch.id}/comments`);
    }
    await scrubCollection(`communities/${c.id}/visits`);
  }

  console.log('PII & legacy PIN hash cleanup complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
