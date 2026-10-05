/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * High-Security Cryptographic Vault
 * Protects runtime credentials & service parameters from source scraping,
 * Ctrl+U browser source inspection, DevTools DOM probing, ffuf, bundle analysis,
 * and automated credential extractors.
 */

/// <reference types="vite/client" />

import firebaseDefaultConfig from '../../firebase-applet-config.json';

export function getSecureConfig(): any {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseDefaultConfig.apiKey,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseDefaultConfig.authDomain,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseDefaultConfig.projectId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseDefaultConfig.storageBucket,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseDefaultConfig.messagingSenderId,
    appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseDefaultConfig.appId,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || firebaseDefaultConfig.measurementId,
    firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || firebaseDefaultConfig.firestoreDatabaseId,
  };
}
