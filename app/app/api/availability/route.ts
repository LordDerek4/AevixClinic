import { NextResponse, type NextRequest } from 'next/server';
import { firestore } from '../../../lib/db';
import { getDefaultClinic } from '../../../lib/clinic';
import { ApiError, withErrorHandling } from '../../../lib/apiError';
import { computeAvailableStartMinutes, minutesToTime, parseDateOnly } from '../../../lib/scheduling';
import type { AppointmentDoc, PractitionerDoc, ServiceDoc } from '../../../lib/firestoreModels';

export const GET = withErrorHandling(async (req: NextRequest) => {
  await getDefaultClinic();
  const serviceId = req.nextUrl.searchParams.get('serviceId');
  const dateParam = req.nextUrl.searchParams.get('date');
  const practitionerId = req.nextUrl.searchParams.get('practitionerId') || undefined;
  const excludeAppointmentId = req.nextUrl.searchParams.get('excludeAppointmentId') || undefined;

  if (!serviceId) throw new ApiError('serviceId is required');
  if (!dateParam) throw new ApiError('date is required (YYYY-MM-DD)');

  const serviceSnap = await firestore.collection('services').doc(serviceId).get();
  if (!serviceSnap.exists) throw new ApiError('Unknown service', 404);
  const service = serviceSnap.data() as ServiceDoc;

  let day: Date;
  try {
    day = parseDateOnly(dateParam);
  } catch {
    throw new ApiError('Invalid date format, expected YYYY-MM-DD');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (day.getTime() < today.getTime()) {
    return NextResponse.json({ date: dateParam, open: false, slots: [], reason: 'past' });
  }

  let practitionerDocs: { id: string; data: PractitionerDoc }[];
  if (practitionerId) {
    const snap = await firestore.collection('practitioners').doc(practitionerId).get();
    if (!snap.exists) throw new ApiError('Unknown practitioner', 404);
    const data = snap.data() as PractitionerDoc;
    if (!data.serviceIds.includes(serviceId)) {
      throw new ApiError('This practitioner does not offer the selected service', 400);
    }
    practitionerDocs = [{ id: snap.id, data }];
  } else {
    const snap = await firestore.collection('practitioners').where('serviceIds', 'array-contains', serviceId).get();
    practitionerDocs = snap.docs.map((d) => ({ id: d.id, data: d.data() as PractitionerDoc }));
  }

  if (practitionerDocs.length === 0) throw new ApiError('No practitioner offers this service', 404);

  const dayEnd = new Date(day);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const weekday = day.getDay();
  const now = new Date();

  let anyWindowToday = false;
  const timeToPractitioner = new Map<string, string>();

  for (const { id: practitionerId, data: practitioner } of practitionerDocs) {
    const windows = practitioner.availability.filter((w) => w.weekday === weekday);
    if (windows.length === 0) continue;
    anyWindowToday = true;

    const apptSnap = await firestore.collection('appointments').where('practitionerId', '==', practitionerId).get();
    const busy = apptSnap.docs
      .filter((doc) => doc.id !== excludeAppointmentId)
      .map((doc) => doc.data() as AppointmentDoc)
      .filter((a) => a.status === 'booked' || a.status === 'completed')
      .map((a) => ({ startsAt: a.startsAt.toDate(), endsAt: a.endsAt.toDate() }))
      .filter((a) => a.startsAt >= day && a.startsAt < dayEnd);

    const starts = computeAvailableStartMinutes(windows, service.durationMinutes, busy, day, now);
    for (const start of starts) {
      const time = minutesToTime(start);
      if (!timeToPractitioner.has(time)) timeToPractitioner.set(time, practitionerId);
    }
  }

  const slots = Array.from(timeToPractitioner.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([time, practitionerId]) => ({ time, practitionerId }));

  return NextResponse.json({ date: dateParam, open: anyWindowToday, slots });
});
