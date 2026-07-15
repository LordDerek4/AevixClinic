import { NextResponse } from 'next/server';
import { firestore } from '../../../lib/db';
import { getDefaultClinic } from '../../../lib/clinic';
import { withErrorHandling } from '../../../lib/apiError';
import type { ServiceDoc } from '../../../lib/firestoreModels';

export const GET = withErrorHandling(async () => {
  await getDefaultClinic(); // ensures the DB is seeded on a fresh deploy

  const snap = await firestore.collection('services').get();
  const services = snap.docs
    .map((doc) => {
      const data = doc.data() as ServiceDoc;
      return { id: doc.id, name: data.name, durationMinutes: data.durationMinutes, createdAt: data.createdAt.toMillis() };
    })
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(({ id, name, durationMinutes }) => ({ id, name, durationMinutes }));

  return NextResponse.json({ services });
});
