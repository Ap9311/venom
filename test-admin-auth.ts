import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, setDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import firebaseConfig from './firebase-applet-config.json' assert { type: "json" };

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, { ignoreUndefinedProperties: true }, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function test() {
  try {
    const cred = await signInAnonymously(auth);
    console.log("Signed in anonymously as:", cred.user.uid);
    const adminRef = doc(db, 'admins', cred.user.uid);
    await setDoc(adminRef, {
      isAdmin: true,
      secretKey: "V3n0m!@#2026AdminSecureKey!!",
      registeredAt: new Date().toISOString()
    });
    console.log("Successfully wrote to admins collection!");
  } catch (e: any) {
    console.error("Error:", e.message);
  }
  process.exit(0);
}
test();
