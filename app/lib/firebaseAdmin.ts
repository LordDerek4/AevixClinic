import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

export const firebaseAdminConfigured = Boolean(projectId && clientEmail && privateKey);

// Local dev/testing against the Firestore emulator doesn't need real credentials —
// just a project ID. `FIRESTORE_EMULATOR_HOST` is what actually redirects traffic
// to the emulator; the Admin SDK picks it up automatically when set.
const emulatorMode = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

let app: App | undefined = getApps()[0];

if (!app && firebaseAdminConfigured) {
  app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
} else if (!app && emulatorMode) {
  app = initializeApp({ projectId: process.env.FIREBASE_ADMIN_PROJECT_ID ?? 'demo-aevixclinic' });
}

export const adminApp = app;
export const adminAuth = app && firebaseAdminConfigured ? getAuth(app) : null;
