import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

function isConfigured() {
  return Boolean(
    process.env.FIREBASE_ADMIN_PROJECT_ID &&
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
      process.env.FIREBASE_ADMIN_PRIVATE_KEY,
  );
}

function isEmulatorMode() {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST);
}

let _app: App | undefined;
let _auth: Auth | undefined;
let _initialized = false;

function ensureInitialized() {
  if (_initialized) return;
  _initialized = true;

  _app = getApps()[0];
  if (_app) return;

  if (isConfigured()) {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, '\n');
    _app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
  } else if (isEmulatorMode()) {
    _app = initializeApp({ projectId: process.env.FIREBASE_ADMIN_PROJECT_ID ?? 'demo-aevixclinic' });
  }
}

export function getAdminApp(): App | undefined {
  ensureInitialized();
  return _app;
}

export function getAdminAuth(): Auth | null {
  ensureInitialized();
  if (!_auth && _app && isConfigured()) {
    _auth = getAuth(_app);
  }
  return _auth ?? null;
}

export { isConfigured as firebaseAdminConfigured };
