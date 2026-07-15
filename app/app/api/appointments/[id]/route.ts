import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getDb } from '../../../../lib/db';
import { getDefaultClinic } from '../../../../lib/clinic';
import { ApiError } from '../../../../lib/apiError';
import { withStaffAuth } from '../../../../lib/requireStaffAuth';
import { combineDateAndTime, isValidPhone, parseDateOnly } from '../../../../lib/scheduling';
import { isWithinAvailabilityWindow, hasNoConflict } from '../../../../lib/booking';
import type { AppointmentDoc, PatientDoc, PractitionerDoc, ServiceDoc } from '../../../../lib/firestoreModels';

const VALID_STATUSES = ['booked', 'completed', 'no_show', 'cancelled'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

export const PATCH = withStaffAuth<{ params: Promise<{ id: string }> }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const firestore = getDb();
  const clinic = await getDefaultClinic();

  const appointmentRef = firestore.collection('appointments').doc(id);

  const body = await req.json().catch(() => null);
  if (!body) throw new ApiError('Invalid JSON body');
  const { status, date, time, practitionerId, serviceId, notes, patient } = body as Record<string, unknown>;

  if (status !== undefined && !VALID_STATUSES.includes(status as string)) {
    throw new ApiError(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  const updated = await firestore.runTransaction(async (tx) => {
    const existingSnap = await tx.get(appointmentRef);
    if (!existingSnap.exists) throw new ApiError('Appointment not found', 404);
    const existing = existingSnap.data() as AppointmentDoc;
    if (existing.clinicId !== clinic.id) throw new ApiError('Appointment not found', 404);

    const updates: Partial<AppointmentDoc> = { updatedAt: Timestamp.now() };
    if (status !== undefined) updates.status = status as AppointmentDoc['status'];
    if (notes !== undefined) updates.notes = typeof notes === 'string' ? notes.trim() || null : null;

    const reschedule = date !== undefined || time !== undefined || practitionerId !== undefined || serviceId !== undefined;
    if (reschedule) {
      const nextServiceId = (serviceId as string | undefined) ?? existing.serviceId;
      const nextPractitionerId = (practitionerId as string | undefined) ?? existing.practitionerId;

      const serviceSnap = await tx.get(firestore.collection('services').doc(nextServiceId));
      if (!serviceSnap.exists) throw new ApiError('Unknown service', 404);
      const service = serviceSnap.data() as ServiceDoc;

      let startsAt = existing.startsAt.toDate();
      if (date !== undefined || time !== undefined) {
        if (typeof date !== 'string' || typeof time !== 'string') {
          throw new ApiError('Both date and time must be provided together when rescheduling');
        }
        let day: Date;
        try {
          day = parseDateOnly(date);
        } catch {
          throw new ApiError('Invalid date format, expected YYYY-MM-DD');
        }
        startsAt = combineDateAndTime(day, time);
      }
      const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);

      const practitionerSnap = await tx.get(firestore.collection('practitioners').doc(nextPractitionerId));
      if (!practitionerSnap.exists) throw new ApiError('Unknown practitioner', 404);
      const practitioner = practitionerSnap.data() as PractitionerDoc;
      if (!practitioner.serviceIds.includes(nextServiceId)) {
        throw new ApiError('This practitioner does not offer the selected service', 400);
      }

      if (!isWithinAvailabilityWindow(practitioner.availability, startsAt, endsAt)) {
        throw new ApiError('That time is outside business hours', 409);
      }
      const free = await hasNoConflict(firestore, tx, nextPractitionerId, startsAt, endsAt, id);
      if (!free) throw new ApiError('That slot is already booked — please pick another time', 409);

      updates.serviceId = nextServiceId;
      updates.practitionerId = nextPractitionerId;
      updates.startsAt = Timestamp.fromDate(startsAt);
      updates.endsAt = Timestamp.fromDate(endsAt);
      updates.dateKey = dateKeyFor(startsAt);
      updates.practitionerName = practitioner.name;
      updates.serviceName = service.name;
      updates.serviceDurationMinutes = service.durationMinutes;
    }

    let patientUpdates: Partial<PatientDoc> | null = null;
    if (patient && typeof patient === 'object') {
      const p = patient as Record<string, unknown>;
      patientUpdates = {};
      if (p.name !== undefined) {
        if (typeof p.name !== 'string' || !p.name.trim()) throw new ApiError('Patient name cannot be empty');
        patientUpdates.name = p.name.trim();
        updates.patientName = patientUpdates.name;
      }
      if (p.phone !== undefined) {
        if (typeof p.phone !== 'string' || !isValidPhone(p.phone)) throw new ApiError('Please provide a valid phone number');
        patientUpdates.phone = p.phone.trim();
        updates.patientPhone = patientUpdates.phone;
      }
      if (p.email !== undefined) {
        if (p.email === null || p.email === '') patientUpdates.email = null;
        else if (typeof p.email === 'string' && EMAIL_REGEX.test(p.email)) patientUpdates.email = p.email.trim();
        else throw new ApiError('Please provide a valid email address');
        updates.patientEmail = patientUpdates.email;
      }
    }

    if (patientUpdates && Object.keys(patientUpdates).length > 0) {
      tx.update(firestore.collection('patients').doc(existing.patientId), patientUpdates);
    }
    tx.update(appointmentRef, updates);

    return { ...existing, ...updates };
  });

  return NextResponse.json({ appointment: toClientShape(id, updated as AppointmentDoc) });
});
