import { getDb } from './db';
import { seedDatabase } from './seedDatabase';
import { CLINIC_ID } from './firestoreModels';
import type { ClinicDoc } from './firestoreModels';

export interface ClinicWithId extends ClinicDoc {
  id: string;
}

/**
 * MVP is single-clinic, at a fixed document ID. Seeds the sample dataset lazily
 * on first use if the database is empty (e.g. a fresh deploy with no way to run
 * a one-off seed command) — see `seedDatabase` for the concurrency story.
 */
export async function getDefaultClinic(): Promise<ClinicWithId> {
  const firestore = getDb();
  const ref = firestore.collection('clinics').doc(CLINIC_ID);
  const snap = await ref.get();
  if (snap.exists) return { id: snap.id, ...(snap.data() as ClinicDoc) };

  return firestore.runTransaction(async (tx) => {
    const freshSnap = await tx.get(ref);
    if (freshSnap.exists) return { id: freshSnap.id, ...(freshSnap.data() as ClinicDoc) };
    return seedDatabase(firestore, tx);
  });
}
