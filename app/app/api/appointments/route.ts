import { NextResponse, type NextRequest } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { firestore } from '../../../lib/db';
import { getDefaultClinic } from '../../../lib/clinic';
import { ApiError, withErrorHandling } from '../../../lib/apiError';
import { withStaffAuth } from '../../../lib/requireStaffAuth';
import { combineDateAndTime, parseDateOnly } from '../../../lib/scheduling';
import {
  isWithinAvailabilityWindow,
  hasNoConflict,
  pickAutoAssignedPractitioner,
  validatePatientInput,
} from '../../../lib/booking';
import type { AppointmentDoc, AppointmentStatusValue, PatientDoc, PractitionerDoc, ServiceDoc } from '../../../lib/firestoreModels';

function dateKeyFor(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toClientShape(id: string, data: AppointmentDoc) {
  return {
    id,
    startsAt: data.startsAt.toDate().toISOString(),
    endsAt: data.endsAt.toDate().toISOString(),
    status: data.status,
    notes: data.notes,
    reminderSentAt: data.reminderSentAt ? data.reminderSentAt.toDate().toISOString() : null,
    patient: { id: data.patientId, name: data.patientName, phone: data.patientPhone, email: data.patientEmail },
    practitioner: { id: data.practitionerId, name: data.practitionerName, role: '' },
    service: { id: data.serviceId, name: data.serviceName, durationMinutes: data.serviceDurationMinutes },
  };
}

export const GET = withStaffAuth(async (req: NextRequest) => {
  const clinic = await getDefaultClinic();
  const filter = req.nextUrl.searchParams.get('filter') ?? 'today';
  const practitionerId = req.nextUrl.searchParams.get('practitionerId') || undefined;
  const status = req.nextUrl.searchParams.get('status') as AppointmentStatusValue | null;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const snap = await firestore.collection('appointments').where('clinicId', '==', clinic.id).get();

  let appointments = snap.docs.map((doc) => ({ id: doc.id, data: doc.data() as AppointmentDoc }));

  appointments = appointments.filter(({ data }) => {
    const startsAt = data.startsAt.toDate();
    if (filter === 'today') return startsAt >= todayStart && startsAt < tomorrowStart;
    if (filter === 'upcoming') return startsAt >= tomorrowStart;
    if (filter === 'past') return startsAt < todayStart;
    return true; // 'all'
  });
  if (practitionerId) appointments = appointments.filter(({ data }) => data.practitionerId === practitionerId);
  if (status) appointments = appointments.filter(({ data }) => data.status === status);

  appointments.sort((a, b) => {
    const diff = a.data.startsAt.toMillis() - b.data.startsAt.toMillis();
    return filter === 'past' ? -diff : diff;
  });

  return NextResponse.json({ appointments: appointments.map(({ id, data }) => toClientShape(id, data)) });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const clinic = await getDefaultClinic();
  const body = await req.json().catch(() => null);
  if (!body) throw new ApiError('Invalid JSON body');

  const { serviceId, practitionerId, date, time, notes } = body as Record<string, unknown>;

  if (typeof serviceId !== 'string') throw new ApiError('serviceId is required');
  if (typeof date !== 'string' || typeof time !== 'string') {
    throw new ApiError('date and time are required');
  }
  if (!/^\d{2}:\d{2}$/.test(time)) throw new ApiError('time must be in HH:MM format');

  const patientInput = validatePatientInput(body.patient);

  const serviceSnap = await firestore.collection('services').doc(serviceId).get();
  if (!serviceSnap.exists) throw new ApiError('Unknown service', 404);
  const service = serviceSnap.data() as ServiceDoc;

  let day: Date;
  try {
    day = parseDateOnly(date);
  } catch {
    throw new ApiError('Invalid date format, expected YYYY-MM-DD');
  }
  const startsAt = combineDateAndTime(day, time);
  const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);

  if (startsAt.getTime() <= Date.now()) {
    throw new ApiError('Cannot book an appointment in the past');
  }

  if (practitionerId !== undefined && typeof practitionerId !== 'string') {
    throw new ApiError('practitionerId must be a string if provided');
  }

  const appointmentRef = firestore.collection('appointments').doc();

  const appointment = await firestore.runTransaction(async (tx) => {
    let resolvedPractitionerId: string;
    let resolvedPractitioner: PractitionerDoc;

    if (typeof practitionerId === 'string') {
      const snap = await tx.get(firestore.collection('practitioners').doc(practitionerId));
      if (!snap.exists) throw new ApiError('Unknown practitioner', 404);
      const data = snap.data() as PractitionerDoc;
      if (!data.serviceIds.includes(serviceId)) {
        throw new ApiError('This practitioner does not offer the selected service', 400);
      }
      if (!isWithinAvailabilityWindow(data.availability, startsAt, endsAt)) {
        throw new ApiError('That time is outside business hours', 409);
      }
      const free = await hasNoConflict(firestore, tx, snap.id, startsAt, endsAt);
      if (!free) throw new ApiError('That slot was just booked — please pick another time', 409);
      resolvedPractitionerId = snap.id;
      resolvedPractitioner = data;
    } else {
      const candidatesSnap = await tx.get(
        firestore.collection('practitioners').where('serviceIds', 'array-contains', serviceId),
      );
      const candidates = candidatesSnap.docs.map((d) => ({ id: d.id, data: d.data() as PractitionerDoc }));
      const pickedId = await pickAutoAssignedPractitioner(
        firestore,
        tx,
        candidates.map((c) => ({ id: c.id, availability: c.data.availability })),
        startsAt,
        endsAt,
      );
      if (!pickedId) throw new ApiError('That slot is no longer available — please pick another time', 409);
      resolvedPractitionerId = pickedId;
      resolvedPractitioner = candidates.find((c) => c.id === pickedId)!.data;
    }

    const patientRef = firestore.collection('patients').doc();
    const patientDoc: PatientDoc = {
      name: patientInput.name,
      phone: patientInput.phone,
      email: patientInput.email ?? null,
      createdAt: Timestamp.now(),
    };
    tx.create(patientRef, patientDoc);

    const now = Timestamp.now();
    const appointmentDoc: AppointmentDoc = {
      clinicId: clinic.id,
      patientId: patientRef.id,
      practitionerId: resolvedPractitionerId,
      serviceId,
      dateKey: dateKeyFor(startsAt),
      startsAt: Timestamp.fromDate(startsAt),
      endsAt: Timestamp.fromDate(endsAt),
      status: 'booked',
      notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
      reminderSentAt: null,
      nudgeSentAt: null,
      createdAt: now,
      updatedAt: now,
      patientName: patientDoc.name,
      patientPhone: patientDoc.phone,
      patientEmail: patientDoc.email,
      practitionerName: resolvedPractitioner.name,
      serviceName: service.name,
      serviceDurationMinutes: service.durationMinutes,
    };
    tx.create(appointmentRef, appointmentDoc);

    return appointmentDoc;
  });

  return NextResponse.json({ appointment: toClientShape(appointmentRef.id, appointment) }, { status: 201 });
});
