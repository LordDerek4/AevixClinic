import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAdminApp } from './firebaseAdmin';

let _firestore: Firestore | undefined;

export function getDb(): Firestore {
  if (!_firestore) {
    const app = getAdminApp();
    if (!app) {
      throw new Error(
        'Firestore is not configured. Set FIREBASE_ADMIN_* env vars (see .env.example), ' +
          'or FIRESTORE_EMULATOR_HOST for local testing against the emulator.',
      );
    }
    _firestore = getFirestore(app);
  }
  return _firestore;
}
