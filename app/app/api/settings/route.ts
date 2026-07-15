import { NextResponse } from 'next/server';
import { firestore } from '../../../lib/db';
import { getDefaultClinic } from '../../../lib/clinic';
import { withStaffAuth } from '../../../lib/requireStaffAuth';
import type { PractitionerDoc } from '../../../lib/firestoreModels';

export const GET = withStaffAuth(async () => {
  const clinic = await getDefaultClinic();

  const snap = await firestore.collection('practitioners').get();
  const practitioners = snap.docs
    .map((doc) => {
      const data = doc.data() as PractitionerDoc;
      return { id: doc.id, name: data.name, role: data.role, createdAt: data.createdAt.toMillis(), availability: data.availability };
    })
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(({ id, name, role, availability }) => ({
      id,
      name,
      role,
      availability: availability.map((a) => ({
        weekday: a.weekday,
        startMinutes: a.startMinutes,
        endMinutes: a.endMinutes,
        slotMinutes: a.slotMinutes,
      })),
    }));

  return NextResponse.json({
    clinic: { id: clinic.id, name: clinic.name, phone: clinic.phone, address: clinic.address },
    reminderSettings: clinic.reminderSettings,
    practitioners,
  });
});
