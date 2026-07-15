import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';
import { getDefaultClinic } from '../../../lib/clinic';
import { withStaffAuth } from '../../../lib/requireStaffAuth';

export const GET = withStaffAuth(async () => {
  const clinic = await getDefaultClinic();

  const [reminderSettings, practitioners] = await Promise.all([
    prisma.reminderSettings.upsert({
      where: { clinicId: clinic.id },
      update: {},
      create: { clinicId: clinic.id, hoursBefore: 24, sameDayNudge: true },
    }),
    prisma.practitioner.findMany({
      where: { clinicId: clinic.id },
      orderBy: { createdAt: 'asc' },
      include: { availability: { orderBy: { weekday: 'asc' } } },
    }),
  ]);

  return NextResponse.json({
    clinic: { id: clinic.id, name: clinic.name, phone: clinic.phone, address: clinic.address },
    reminderSettings: { hoursBefore: reminderSettings.hoursBefore, sameDayNudge: reminderSettings.sameDayNudge },
    practitioners: practitioners.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      availability: p.availability.map((a) => ({
        weekday: a.weekday,
        startMinutes: a.startMinutes,
        endMinutes: a.endMinutes,
        slotMinutes: a.slotMinutes,
      })),
    })),
  });
});
