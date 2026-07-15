import { prisma } from './db';
import type { Prisma } from '../prisma/generated/prisma/client';

type Tx = Prisma.TransactionClient;

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

function appt(
  tx: Tx,
  clinicId: string,
  patientId: string,
  practitionerId: string,
  serviceId: string,
  start: Date,
  durationMinutes: number,
  status: 'booked' | 'completed' | 'no_show' | 'cancelled',
) {
  const endsAt = new Date(start.getTime() + durationMinutes * 60_000);
  return tx.appointment.create({
    data: { clinicId, patientId, practitionerId, serviceId, startsAt: start, endsAt, status },
  });
}

/**
 * Creates the sample Cedar Grove Clinic dataset in a single transaction, so it's
 * atomically all-or-nothing. That matters because `getDefaultClinic` calls this
 * lazily on first use against an empty database (e.g. a fresh deploy with no way
 * to run a one-off seed command): if a concurrent cold start loses the race on the
 * unique `bookingSlug` constraint, the transaction guarantees it only ever sees
 * either no clinic or a *fully* seeded one — never a clinic row with no services yet.
 */
export async function seedDatabase() {
  return prisma.$transaction(async (tx) => {
    const clinic = await tx.clinic.create({
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
      tx.practitioner.create({
        data: { clinicId: clinic.id, name: 'Dr. Asha Rao', role: 'Doctor', email: 'asha@cedargroveclinic.com' },
      }),
      tx.practitioner.create({
        data: { clinicId: clinic.id, name: 'Dr. Tom Whelan', role: 'Doctor', email: 'tom@cedargroveclinic.com' },
      }),
      tx.practitioner.create({
        data: { clinicId: clinic.id, name: 'Nurse Kim Ly', role: 'Nurse', email: 'kim@cedargroveclinic.com' },
      }),
    ]);

    const [generalConsult, followUp, bloodTest, vaccination] = await Promise.all([
      tx.service.create({ data: { clinicId: clinic.id, name: 'General consultation', durationMinutes: 15 } }),
      tx.service.create({ data: { clinicId: clinic.id, name: 'Follow-up visit', durationMinutes: 10 } }),
      tx.service.create({ data: { clinicId: clinic.id, name: 'Blood test', durationMinutes: 10 } }),
      tx.service.create({ data: { clinicId: clinic.id, name: 'Vaccination', durationMinutes: 10 } }),
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
    await tx.practitionerService.createMany({
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
      await tx.availability.createMany({
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
      tx.patient.create({ data: { name: 'Daniel Okafor', phone: '(555) 019-3321' } }),
      tx.patient.create({ data: { name: 'Rosa Jiménez', phone: '(555) 002-8810' } }),
      tx.patient.create({ data: { name: 'Margaret Ellis', phone: '(555) 014-2276', email: 'margaret.ellis@example.com' } }),
      tx.patient.create({ data: { name: 'Sam Whitfield', phone: '(555) 044-1189' } }),
      tx.patient.create({ data: { name: 'Priya Nair', phone: '(555) 071-5540' } }),
      tx.patient.create({ data: { name: 'George Tanaka', phone: '(555) 090-2213' } }),
    ]);
    const [daniel, rosa, margaret, sam, priya, george] = patients;

    await appt(tx, clinic.id, daniel.id, ashaRao.id, followUp.id, at(9, 0), 10, 'completed');
    await appt(tx, clinic.id, rosa.id, kimLy.id, bloodTest.id, at(9, 30), 10, 'no_show');
    await appt(tx, clinic.id, margaret.id, ashaRao.id, generalConsult.id, at(10, 15), 15, 'booked');
    await appt(tx, clinic.id, sam.id, tomWhelan.id, vaccination.id, at(11, 0), 10, 'booked');
    await appt(tx, clinic.id, priya.id, ashaRao.id, generalConsult.id, at(11, 45), 15, 'booked');
    await appt(tx, clinic.id, george.id, tomWhelan.id, followUp.id, at(14, 0), 10, 'booked');

    return { clinic, practitionerCount: 3, serviceCount: 4, patientCount: patients.length };
  });
}
