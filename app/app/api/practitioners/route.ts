import { NextResponse, type NextRequest } from 'next/server';
import { firestore } from '../../../lib/db';
import { getDefaultClinic } from '../../../lib/clinic';
import { withErrorHandling } from '../../../lib/apiError';
import type { PractitionerDoc } from '../../../lib/firestoreModels';

export const GET = withErrorHandling(async (req: NextRequest) => {
  await getDefaultClinic();
  const serviceId = req.nextUrl.searchParams.get('serviceId');

  const query = serviceId
    ? firestore.collection('practitioners').where('serviceIds', 'array-contains', serviceId)
    : firestore.collection('practitioners');

  const snap = await query.get();
  const practitioners = snap.docs
    .map((doc) => {
      const data = doc.data() as PractitionerDoc;
      return { id: doc.id, name: data.name, role: data.role, createdAt: data.createdAt.toMillis() };
    })
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(({ id, name, role }) => ({ id, name, role }));

  return NextResponse.json({ practitioners });
});
