import { prisma } from '../lib/db';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function at(hour: number, minute: number): Date {
  const d = startOfToday();
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function main() {
  await prisma.appointment.deleteMany();
  await prisma.reminderSettings.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.practitionerService.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.service.deleteMany();
  await prisma.practitioner.deleteMany();
  await prisma.clinic.deleteMany();

  const clinic = await prisma.clinic.create({
    data: {
      name: 'Cedar Grove Clinic',
      phone: '(555) 210-8842',
      address: '14 Alder St, Suite 2',
      bookingSlug: 'cedargrove',
      reminderSettings: {
        create: { hoursBefore: 24, sameDayNudge: true },
      },
    },
  });

  const [ashaRao, tomWhelan, kimLy] = await Promise.all([
    prisma.practitioner.create({
      data: { clinicId: clinic.id, name: 'Dr. Asha Rao', role: 'Doctor', email: 'asha@cedargroveclinic.com' },
    }),
    prisma.practitioner.create({
      data: { clinicId: clinic.id, name: 'Dr. Tom Whelan', role: 'Doctor', email: 'tom@cedargroveclinic.com' },
    }),
    prisma.practitioner.create({
      data: { clinicId: clinic.id, name: 'Nurse Kim Ly', role: 'Nurse', email: 'kim@cedargroveclinic.com' },
    }),
  ]);

  const [generalConsult, followUp, bloodTest, vaccination] = await Promise.all([
    prisma.service.create({ data: { clinicId: clinic.id, name: 'General consultation', durationMinutes: 15 } }),
    prisma.service.create({ data: { clinicId: clinic.id, name: 'Follow-up visit', durationMinutes: 10 } }),
    prisma.service.create({ data: { clinicId: clinic.id, name: 'Blood test', durationMinutes: 10 } }),
    prisma.service.create({ data: { clinicId: clinic.id, name: 'Vaccination', durationMinutes: 10 } }),
  ]);

  const offerings: [string, string][] = [
    [ashaRao.id, generalConsult.id],
    [ashaRao.id, followUp.id],
    [ashaRao.id, vaccination.id],
    [tomWhelan.id, generalConsult.id],
    [tomWhelan.id, followUp.id],
    [tomWhelan.id, vaccination.id],
    [kimLy.id, bloodTest.id],
    [kimLy.id, vaccination.id],
    [kimLy.id, followUp.id],
  ];
  await prisma.practitionerService.createMany({
    data: offerings.map(([practitionerId, serviceId]) => ({ practitionerId, serviceId })),
  });

  // Weekly hours: Mon-Fri, Wed/Fri shortened, Sat/Sun closed. Same schedule for all practitioners.
  const weeklyHours: { weekday: number; startMinutes: number; endMinutes: number }[] = [
    { weekday: 1, startMinutes: 8 * 60 + 30, endMinutes: 17 * 60 }, // Mon
    { weekday: 2, startMinutes: 8 * 60 + 30, endMinutes: 17 * 60 }, // Tue
    { weekday: 3, startMinutes: 8 * 60 + 30, endMinutes: 13 * 60 }, // Wed
    { weekday: 4, startMinutes: 8 * 60 + 30, endMinutes: 17 * 60 }, // Thu
    { weekday: 5, startMinutes: 8 * 60 + 30, endMinutes: 16 * 60 }, // Fri
  ];
  for (const practitioner of [ashaRao, tomWhelan, kimLy]) {
    await prisma.availability.createMany({
      data: weeklyHours.map((h) => ({
        practitionerId: practitioner.id,
        weekday: h.weekday,
        startMinutes: h.startMinutes,
        endMinutes: h.endMinutes,
        slotMinutes: 15,
      })),
    });
  }

  const patients = await Promise.all([
    prisma.patient.create({ data: { name: 'Daniel Okafor', phone: '(555) 019-3321' } }),
    prisma.patient.create({ data: { name: 'Rosa Jiménez', phone: '(555) 002-8810' } }),
    prisma.patient.create({ data: { name: 'Margaret Ellis', phone: '(555) 014-2276', email: 'margaret.ellis@example.com' } }),
    prisma.patient.create({ data: { name: 'Sam Whitfield', phone: '(555) 044-1189' } }),
    prisma.patient.create({ data: { name: 'Priya Nair', phone: '(555) 071-5540' } }),
    prisma.patient.create({ data: { name: 'George Tanaka', phone: '(555) 090-2213' } }),
  ]);
  const [daniel, rosa, margaret, sam, priya, george] = patients;

  function appt(
    patientId: string,
    practitionerId: string,
    serviceId: string,
    start: Date,
    durationMinutes: number,
    status: 'booked' | 'completed' | 'no_show' | 'cancelled',
  ) {
    const endsAt = new Date(start.getTime() + durationMinutes * 60_000);
    return prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId,
        practitionerId,
        serviceId,
        startsAt: start,
        endsAt,
        status,
      },
    });
  }

  await appt(daniel.id, ashaRao.id, followUp.id, at(9, 0), 10, 'completed');
  await appt(rosa.id, kimLy.id, bloodTest.id, at(9, 30), 10, 'no_show');
  await appt(margaret.id, ashaRao.id, generalConsult.id, at(10, 15), 15, 'booked');
  await appt(sam.id, tomWhelan.id, vaccination.id, at(11, 0), 10, 'booked');
  await appt(priya.id, ashaRao.id, generalConsult.id, at(11, 45), 15, 'booked');
  await appt(george.id, tomWhelan.id, followUp.id, at(14, 0), 10, 'booked');

  console.log('Seed complete:', {
    clinic: clinic.name,
    practitioners: 3,
    services: 4,
    patients: patients.length,
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
