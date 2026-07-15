import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '../../../lib/db';
import { getDefaultClinic } from '../../../lib/clinic';
import { ApiError, withErrorHandling } from '../../../lib/apiError';
import {
  computeAvailableStartMinutes,
  minutesToTime,
  parseDateOnly,
} from '../../../lib/scheduling';

export const GET = withErrorHandling(async (req: NextRequest) => {
  const clinic = await getDefaultClinic();
  const serviceId = req.nextUrl.searchParams.get('serviceId');
  const dateParam = req.nextUrl.searchParams.get('date');
  const practitionerId = req.nextUrl.searchParams.get('practitionerId') || undefined;
  const excludeAppointmentId = req.nextUrl.searchParams.get('excludeAppointmentId') || undefined;

  if (!serviceId) throw new ApiError('serviceId is required');
  if (!dateParam) throw new ApiError('date is required (YYYY-MM-DD)');

  const service = await prisma.service.findFirst({ where: { id: serviceId, clinicId: clinic.id } });
  if (!service) throw new ApiError('Unknown service', 404);

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

  if (practitionerId) {
    const offers = await prisma.practitionerService.findFirst({ where: { practitionerId, serviceId } });
    if (!offers) throw new ApiError('This practitioner does not offer the selected service', 400);
  }

  const practitioners = await prisma.practitioner.findMany({
    where: {
      clinicId: clinic.id,
      services: { some: { serviceId } },
      ...(practitionerId ? { id: practitionerId } : {}),
    },
    orderBy: { createdAt: 'asc' },
  });

  if (practitioners.length === 0) {
    throw new ApiError('No practitioner offers this service', 404);
  }

  const weekday = day.getDay();
  const dayEnd = new Date(day);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const [availabilityRows, appointments] = await Promise.all([
    prisma.availability.findMany({
      where: { practitionerId: { in: practitioners.map((p) => p.id) }, weekday },
    }),
    prisma.appointment.findMany({
      where: {
        practitionerId: { in: practitioners.map((p) => p.id) },
        status: { in: ['booked', 'completed'] },
        startsAt: { gte: day, lt: dayEnd },
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      },
      select: { practitionerId: true, startsAt: true, endsAt: true },
    }),
  ]);

  const now = new Date();
  let anyWindowToday = false;
  const timeToPractitioner = new Map<string, string>();

  for (const practitioner of practitioners) {
    const windows = availabilityRows
      .filter((a) => a.practitionerId === practitioner.id)
      .map((a) => ({ startMinutes: a.startMinutes, endMinutes: a.endMinutes, slotMinutes: a.slotMinutes }));
    if (windows.length === 0) continue;
    anyWindowToday = true;

    const busy = appointments
      .filter((a) => a.practitionerId === practitioner.id)
      .map((a) => ({ startsAt: a.startsAt, endsAt: a.endsAt }));

    const starts = computeAvailableStartMinutes(windows, service.durationMinutes, busy, day, now);
    for (const start of starts) {
      const time = minutesToTime(start);
      if (!timeToPractitioner.has(time)) timeToPractitioner.set(time, practitioner.id);
    }
  }

  const slots = Array.from(timeToPractitioner.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([time, practitionerId]) => ({ time, practitionerId }));

  return NextResponse.json({ date: dateParam, open: anyWindowToday, slots });
});
