import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { getDefaultClinic } from '../../../../lib/clinic';
import { ApiError } from '../../../../lib/apiError';
import { withStaffAuth } from '../../../../lib/requireStaffAuth';
import { combineDateAndTime, isValidPhone, parseDateOnly } from '../../../../lib/scheduling';
import { isWithinAvailabilityWindow, hasNoConflict } from '../../../../lib/booking';

const appointmentInclude = {
  patient: { select: { id: true, name: true, phone: true, email: true } },
  practitioner: { select: { id: true, name: true, role: true } },
  service: { select: { id: true, name: true, durationMinutes: true } },
} as const;

const VALID_STATUSES = ['booked', 'completed', 'no_show', 'cancelled'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PATCH = withStaffAuth<{ params: Promise<{ id: string }> }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const clinic = await getDefaultClinic();

  const existing = await prisma.appointment.findFirst({ where: { id, clinicId: clinic.id } });
  if (!existing) throw new ApiError('Appointment not found', 404);

  const body = await req.json().catch(() => null);
  if (!body) throw new ApiError('Invalid JSON body');
  const { status, date, time, practitionerId, serviceId, notes, patient } = body as Record<string, unknown>;

  if (status !== undefined && !VALID_STATUSES.includes(status as string)) {
    throw new ApiError(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  const appointment = await prisma.$transaction(async (tx) => {
    const updates: Record<string, unknown> = {};
    if (status !== undefined) updates.status = status;
    if (notes !== undefined) updates.notes = typeof notes === 'string' ? notes.trim() || null : null;

    const reschedule = date !== undefined || time !== undefined || practitionerId !== undefined || serviceId !== undefined;
    if (reschedule) {
      const nextServiceId = (serviceId as string | undefined) ?? existing.serviceId;
      const nextPractitionerId = (practitionerId as string | undefined) ?? existing.practitionerId;

      const service = await tx.service.findFirst({ where: { id: nextServiceId, clinicId: clinic.id } });
      if (!service) throw new ApiError('Unknown service', 404);

      let startsAt = existing.startsAt;
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

      const offers = await tx.practitionerService.findFirst({
        where: { practitionerId: nextPractitionerId, serviceId: nextServiceId },
      });
      if (!offers) throw new ApiError('This practitioner does not offer the selected service', 400);

      const withinHours = await isWithinAvailabilityWindow(tx, nextPractitionerId, startsAt, endsAt);
      if (!withinHours) throw new ApiError('That time is outside business hours', 409);

      const free = await hasNoConflict(tx, nextPractitionerId, startsAt, endsAt, existing.id);
      if (!free) throw new ApiError('That slot is already booked — please pick another time', 409);

      updates.serviceId = nextServiceId;
      updates.practitionerId = nextPractitionerId;
      updates.startsAt = startsAt;
      updates.endsAt = endsAt;
    }

    if (patient && typeof patient === 'object') {
      const p = patient as Record<string, unknown>;
      const patientUpdates: Record<string, unknown> = {};
      if (p.name !== undefined) {
        if (typeof p.name !== 'string' || !p.name.trim()) throw new ApiError('Patient name cannot be empty');
        patientUpdates.name = p.name.trim();
      }
      if (p.phone !== undefined) {
        if (typeof p.phone !== 'string' || !isValidPhone(p.phone)) throw new ApiError('Please provide a valid phone number');
        patientUpdates.phone = p.phone.trim();
      }
      if (p.email !== undefined) {
        if (p.email === null || p.email === '') patientUpdates.email = null;
        else if (typeof p.email === 'string' && EMAIL_REGEX.test(p.email)) patientUpdates.email = p.email.trim();
        else throw new ApiError('Please provide a valid email address');
      }
      if (Object.keys(patientUpdates).length > 0) {
        await tx.patient.update({ where: { id: existing.patientId }, data: patientUpdates });
      }
    }

    return tx.appointment.update({
      where: { id },
      data: updates,
      include: appointmentInclude,
    });
  });

  return NextResponse.json({ appointment });
});
