import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { adminApp } from './firebaseAdmin';

let _firestore: Firestore | undefined;

export function getDb(): Firestore {
  if (!_firestore) {
    if (!adminApp) {
      throw new Error(
        'Firestore is not configured. Set FIREBASE_ADMIN_* env vars (see .env.example), ' +
          'or FIRESTORE_EMULATOR_HOST for local testing against the emulator.',
      );
    }
    _firestore = getFirestore(adminApp);
  }
  return _firestore;
}
