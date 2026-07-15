import type { Prisma } from '../prisma/generated/prisma/client';
import { ApiError } from './apiError';
import { isValidPhone } from './scheduling';

type Tx = Prisma.TransactionClient;

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

/** Whether the given practitioner has a recurring availability window covering [startsAt, endsAt) on its weekday. */
export async function isWithinAvailabilityWindow(
  tx: Tx,
  practitionerId: string,
  startsAt: Date,
  endsAt: Date,
): Promise<boolean> {
  const dayStart = new Date(startsAt);
  dayStart.setHours(0, 0, 0, 0);
  const startMinutes = Math.round((startsAt.getTime() - dayStart.getTime()) / 60_000);
  const endMinutes = Math.round((endsAt.getTime() - dayStart.getTime()) / 60_000);
  const weekday = startsAt.getDay();

  const windows = await tx.availability.findMany({ where: { practitionerId, weekday } });
  return windows.some((w) => startMinutes >= w.startMinutes && endMinutes <= w.endMinutes);
}

/** Whether the practitioner has no conflicting active appointment overlapping [startsAt, endsAt). */
export async function hasNoConflict(
  tx: Tx,
  practitionerId: string,
  startsAt: Date,
  endsAt: Date,
  excludeAppointmentId?: string,
): Promise<boolean> {
  const conflict = await tx.appointment.findFirst({
    where: {
      practitionerId,
      status: { in: ['booked', 'completed'] },
      id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined,
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  });
  return !conflict;
}

export async function isPractitionerFreeAt(
  tx: Tx,
  practitionerId: string,
  startsAt: Date,
  endsAt: Date,
  excludeAppointmentId?: string,
): Promise<boolean> {
  const [withinHours, noConflict] = await Promise.all([
    isWithinAvailabilityWindow(tx, practitionerId, startsAt, endsAt),
    hasNoConflict(tx, practitionerId, startsAt, endsAt, excludeAppointmentId),
  ]);
  return withinHours && noConflict;
}

/** Picks the first practitioner (in creation order) offering the service who is free at the given time. */
export async function pickAutoAssignedPractitioner(
  tx: Tx,
  clinicId: string,
  serviceId: string,
  startsAt: Date,
  endsAt: Date,
): Promise<string | null> {
  const practitioners = await tx.practitioner.findMany({
    where: { clinicId, services: { some: { serviceId } } },
    orderBy: { createdAt: 'asc' },
  });

  for (const practitioner of practitioners) {
    if (await isPractitionerFreeAt(tx, practitioner.id, startsAt, endsAt)) {
      return practitioner.id;
    }
  }
  return null;
}
