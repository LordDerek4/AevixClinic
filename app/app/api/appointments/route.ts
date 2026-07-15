import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '../../../lib/db';
import { getDefaultClinic } from '../../../lib/clinic';
import { ApiError, withErrorHandling } from '../../../lib/apiError';
import { withStaffAuth } from '../../../lib/requireStaffAuth';
import { combineDateAndTime, parseDateOnly } from '../../../lib/scheduling';
import {
  hasNoConflict,
  isWithinAvailabilityWindow,
  pickAutoAssignedPractitioner,
  validatePatientInput,
} from '../../../lib/booking';
import type { AppointmentStatus } from '../../../prisma/generated/prisma/client';

const appointmentInclude = {
  patient: { select: { id: true, name: true, phone: true, email: true } },
  practitioner: { select: { id: true, name: true, role: true } },
  service: { select: { id: true, name: true, durationMinutes: true } },
} as const;

export const GET = withStaffAuth(async (req: NextRequest) => {
  const clinic = await getDefaultClinic();
  const filter = req.nextUrl.searchParams.get('filter') ?? 'today';
  const practitionerId = req.nextUrl.searchParams.get('practitionerId') || undefined;
  const status = req.nextUrl.searchParams.get('status') as AppointmentStatus | null;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  let startsAtFilter: { gte?: Date; lt?: Date } = {};
  if (filter === 'today') startsAtFilter = { gte: todayStart, lt: tomorrowStart };
  else if (filter === 'upcoming') startsAtFilter = { gte: tomorrowStart };
  else if (filter === 'past') startsAtFilter = { lt: todayStart };
  // filter === 'all' -> no date bounds

  const appointments = await prisma.appointment.findMany({
    where: {
      clinicId: clinic.id,
      startsAt: startsAtFilter,
      ...(practitionerId ? { practitionerId } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { startsAt: filter === 'past' ? 'desc' : 'asc' },
    include: appointmentInclude,
  });

  return NextResponse.json({ appointments });
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

  const service = await prisma.service.findFirst({ where: { id: serviceId, clinicId: clinic.id } });
  if (!service) throw new ApiError('Unknown service', 404);

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

  const appointment = await prisma.$transaction(async (tx) => {
    let resolvedPractitionerId = practitionerId as string | undefined;

    if (resolvedPractitionerId) {
      const offers = await tx.practitionerService.findFirst({
        where: { practitionerId: resolvedPractitionerId, serviceId },
      });
      if (!offers) throw new ApiError('This practitioner does not offer the selected service', 400);

      const withinHours = await isWithinAvailabilityWindow(tx, resolvedPractitionerId, startsAt, endsAt);
      if (!withinHours) throw new ApiError('That time is outside business hours', 409);

      const free = await hasNoConflict(tx, resolvedPractitionerId, startsAt, endsAt);
      if (!free) throw new ApiError('That slot was just booked — please pick another time', 409);
    } else {
      const picked = await pickAutoAssignedPractitioner(tx, clinic.id, serviceId, startsAt, endsAt);
      if (!picked) throw new ApiError('That slot is no longer available — please pick another time', 409);
      resolvedPractitionerId = picked;
    }

    const patient = await tx.patient.create({ data: patientInput });

    return tx.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patient.id,
        practitionerId: resolvedPractitionerId,
        serviceId,
        startsAt,
        endsAt,
        notes: typeof notes === 'string' && notes.trim() ? notes.trim() : undefined,
        status: 'booked',
      },
      include: appointmentInclude,
    });
  });

  return NextResponse.json({ appointment }, { status: 201 });
});
