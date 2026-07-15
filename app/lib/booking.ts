import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { ApiError } from './apiError';
import { isValidPhone } from './scheduling';
import type { AppointmentDoc, AvailabilityWindowDoc, PractitionerDoc } from './firestoreModels';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface PatientInput {
  name: string;
  phone: string;
  email?: string;
}

export function validatePatientInput(input: unknown): PatientInput {
  if (!input || typeof input !== 'object') throw new ApiError('Patient details are required');
  const { name, phone, email } = input as Record<string, unknown>;

  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new ApiError('Patient name is required');
  }
  if (typeof phone !== 'string' || !isValidPhone(phone)) {
    throw new ApiError('Please provide a valid phone number');
  }
  if (email !== undefined && email !== null && email !== '') {
    if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
      throw new ApiError('Please provide a valid email address');
    }
  }

  return {
    name: name.trim(),
    phone: phone.trim(),
    email: typeof email === 'string' && email.trim() ? email.trim() : undefined,
  };
}

/** Whether [startsAt, endsAt) on its weekday falls fully inside one of the practitioner's recurring windows. */
export function isWithinAvailabilityWindow(
  availability: AvailabilityWindowDoc[],
  startsAt: Date,
  endsAt: Date,
): boolean {
  const dayStart = new Date(startsAt);
  dayStart.setHours(0, 0, 0, 0);
  const startMinutes = Math.round((startsAt.getTime() - dayStart.getTime()) / 60_000);
  const endMinutes = Math.round((endsAt.getTime() - dayStart.getTime()) / 60_000);
  const weekday = startsAt.getDay();

  return availability.some((w) => w.weekday === weekday && startMinutes >= w.startMinutes && endMinutes <= w.endMinutes);
}

/**
 * Whether the practitioner has no conflicting active appointment overlapping [startsAt, endsAt).
 * Queries by practitionerId only (always index-free in Firestore) and filters the rest in
 * memory — appointment volumes at this MVP's scale make that cheaper than managing composite
 * indexes for a production deploy that has to work without any manual Firestore console steps.
 */
export async function hasNoConflict(
  firestore: Firestore,
  tx: Transaction,
  practitionerId: string,
  startsAt: Date,
  endsAt: Date,
  excludeAppointmentId?: string,
): Promise<boolean> {
  const snap = await tx.get(firestore.collection('appointments').where('practitionerId', '==', practitionerId));

  return !snap.docs.some((doc) => {
    if (doc.id === excludeAppointmentId) return false;
    const data = doc.data() as AppointmentDoc;
    if (data.status !== 'booked' && data.status !== 'completed') return false;
    const existingStart = data.startsAt.toDate();
    const existingEnd = data.endsAt.toDate();
    return existingStart < endsAt && existingEnd > startsAt;
  });
}

export async function isPractitionerFreeAt(
  firestore: Firestore,
  tx: Transaction,
  practitioner: { id: string; availability: AvailabilityWindowDoc[] },
  startsAt: Date,
  endsAt: Date,
  excludeAppointmentId?: string,
): Promise<boolean> {
  if (!isWithinAvailabilityWindow(practitioner.availability, startsAt, endsAt)) return false;
  return hasNoConflict(firestore, tx, practitioner.id, startsAt, endsAt, excludeAppointmentId);
}

/** Picks the first practitioner (in creation order) offering the service who is free at the given time. */
export async function pickAutoAssignedPractitioner(
  firestore: Firestore,
  tx: Transaction,
  candidates: { id: string; availability: AvailabilityWindowDoc[] }[],
  startsAt: Date,
  endsAt: Date,
): Promise<string | null> {
  for (const practitioner of candidates) {
    if (await isPractitionerFreeAt(firestore, tx, practitioner, startsAt, endsAt)) {
      return practitioner.id;
    }
  }
  return null;
}

export function toTimestamp(date: Date): Timestamp {
  return Timestamp.fromDate(date);
}

export function practitionerDocToCandidate(id: string, data: PractitionerDoc) {
  return { id, availability: data.availability };
}
