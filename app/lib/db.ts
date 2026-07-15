import { getFirestore } from 'firebase-admin/firestore';
import { adminApp } from './firebaseAdmin';

if (!adminApp) {
  throw new Error(
    'Firestore is not configured. Set FIREBASE_ADMIN_* env vars (see .env.example), ' +
      'or FIRESTORE_EMULATOR_HOST for local testing against the emulator.',
  );
}

export const firestore = getFirestore(adminApp);
