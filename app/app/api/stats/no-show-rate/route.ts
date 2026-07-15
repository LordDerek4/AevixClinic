import { NextResponse } from 'next/server';
import { firestore } from '../../../../lib/db';
import { getDefaultClinic } from '../../../../lib/clinic';
import { withStaffAuth } from '../../../../lib/requireStaffAuth';
import type { AppointmentDoc } from '../../../../lib/firestoreModels';

function rateForWindow(appointments: AppointmentDoc[], from: Date, to: Date) {
  let completed = 0;
  let noShow = 0;
  for (const a of appointments) {
    const startsAt = a.startsAt.toDate();
    if (startsAt < from || startsAt >= to) continue;
    if (a.status === 'completed') completed++;
    else if (a.status === 'no_show') noShow++;
  }
  const total = completed + noShow;
  return { total, noShow, rate: total > 0 ? (noShow / total) * 100 : null };
}

export const GET = withStaffAuth(async () => {
  const clinic = await getDefaultClinic();

  const snap = await firestore.collection('appointments').where('clinicId', '==', clinic.id).get();
  const appointments = snap.docs.map((doc) => doc.data() as AppointmentDoc);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const current = rateForWindow(appointments, thirtyDaysAgo, now);
  const previous = rateForWindow(appointments, sixtyDaysAgo, thirtyDaysAgo);

  return NextResponse.json({
    currentRate: current.rate,
    previousRate: previous.rate,
    sampleSize: current.total,
  });
});
