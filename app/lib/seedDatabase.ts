import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { CLINIC_ID } from './firestoreModels';
import type { AppointmentDoc, AppointmentStatusValue, ClinicDoc, PatientDoc, PractitionerDoc, ServiceDoc } from './firestoreModels';

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

function dateKeyFor(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Creates the sample Cedar Grove Clinic dataset inside a single Firestore transaction,
 * so it's atomically all-or-nothing. `getDefaultClinic` calls this lazily on first use
 * against an empty database (e.g. a fresh deploy with no way to run a one-off seed
 * command). The clinic uses a fixed document ID (`CLINIC_ID`): if two cold starts race
 * to seed at once, Firestore's transaction contention handling means only one write
 * wins and the other transparently retries, reading back the winner's fully-committed
 * data — never a half-seeded state.
 */
export function seedDatabase(firestore: Firestore, tx: Transaction) {
  const now = Timestamp.now();

  const clinicRef = firestore.collection('clinics').doc(CLINIC_ID);
  const clinic: ClinicDoc = {
    name: 'Cedar Grove Clinic',
    phone: '(555) 210-8842',
    address: '14 Alder St, Suite 2',
    bookingSlug: 'cedargrove',
    reminderSettings: { hoursBefore: 24, sameDayNudge: true },
    createdAt: now,
  };
  tx.create(clinicRef, clinic);

  const practitionersCol = firestore.collection('practitioners');
  const servicesCol = firestore.collection('services');
  const patientsCol = firestore.collection('patients');
  const appointmentsCol = firestore.collection('appointments');

  const generalConsultRef = servicesCol.doc();
  const followUpRef = servicesCol.doc();
  const bloodTestRef = servicesCol.doc();
  const vaccinationRef = servicesCol.doc();

  const services: [FirebaseFirestore.DocumentReference, ServiceDoc][] = [
    [generalConsultRef, { clinicId: CLINIC_ID, name: 'General consultation', durationMinutes: 15, createdAt: now }],
    [followUpRef, { clinicId: CLINIC_ID, name: 'Follow-up visit', durationMinutes: 10, createdAt: now }],
    [bloodTestRef, { clinicId: CLINIC_ID, name: 'Blood test', durationMinutes: 10, createdAt: now }],
    [vaccinationRef, { clinicId: CLINIC_ID, name: 'Vaccination', durationMinutes: 10, createdAt: now }],
  ];
  for (const [ref, data] of services) tx.create(ref, data);

  const weeklyHours = [
    { weekday: 1, startMinutes: 8 * 60 + 30, endMinutes: 17 * 60, slotMinutes: 15 }, // Mon
    { weekday: 2, startMinutes: 8 * 60 + 30, endMinutes: 17 * 60, slotMinutes: 15 }, // Tue
    { weekday: 3, startMinutes: 8 * 60 + 30, endMinutes: 13 * 60, slotMinutes: 15 }, // Wed
    { weekday: 4, startMinutes: 8 * 60 + 30, endMinutes: 17 * 60, slotMinutes: 15 }, // Thu
    { weekday: 5, startMinutes: 8 * 60 + 30, endMinutes: 16 * 60, slotMinutes: 15 }, // Fri
  ];

  const ashaRaoRef = practitionersCol.doc();
  const tomWhelanRef = practitionersCol.doc();
  const kimLyRef = practitionersCol.doc();

  const practitioners: [FirebaseFirestore.DocumentReference, PractitionerDoc][] = [
    [
      ashaRaoRef,
      {
        clinicId: CLINIC_ID,
        name: 'Dr. Asha Rao',
        role: 'Doctor',
        email: 'asha@cedargroveclinic.com',
        firebaseUid: null,
        serviceIds: [generalConsultRef.id, followUpRef.id, vaccinationRef.id],
        availability: weeklyHours,
        createdAt: now,
      },
    ],
    [
      tomWhelanRef,
      {
        clinicId: CLINIC_ID,
        name: 'Dr. Tom Whelan',
        role: 'Doctor',
        email: 'tom@cedargroveclinic.com',
        firebaseUid: null,
        serviceIds: [generalConsultRef.id, followUpRef.id, vaccinationRef.id],
        availability: weeklyHours,
        createdAt: now,
      },
    ],
    [
      kimLyRef,
      {
        clinicId: CLINIC_ID,
        name: 'Nurse Kim Ly',
        role: 'Nurse',
        email: 'kim@cedargroveclinic.com',
        firebaseUid: null,
        serviceIds: [bloodTestRef.id, vaccinationRef.id, followUpRef.id],
        availability: weeklyHours,
        createdAt: now,
      },
    ],
  ];
  for (const [ref, data] of practitioners) tx.create(ref, data);

  const patientDefs: [string, string, string | null][] = [
    ['Daniel Okafor', '(555) 019-3321', null],
    ['Rosa Jiménez', '(555) 002-8810', null],
    ['Margaret Ellis', '(555) 014-2276', 'margaret.ellis@example.com'],
    ['Sam Whitfield', '(555) 044-1189', null],
    ['Priya Nair', '(555) 071-5540', null],
    ['George Tanaka', '(555) 090-2213', null],
  ];
  const patientRefs = patientDefs.map(([name, phone, email]) => {
    const ref = patientsCol.doc();
    const data: PatientDoc = { name, phone, email, createdAt: now };
    tx.create(ref, data);
    return ref;
  });
  const [daniel, rosa, margaret, sam, priya, george] = patientRefs;

  function appt(
    patientRef: FirebaseFirestore.DocumentReference,
    patientName: string,
    patientPhone: string,
    practitionerRef: FirebaseFirestore.DocumentReference,
    practitionerName: string,
    serviceRef: FirebaseFirestore.DocumentReference,
    serviceName: string,
    start: Date,
    durationMinutes: number,
    status: AppointmentStatusValue,
  ) {
    const endsAt = new Date(start.getTime() + durationMinutes * 60_000);
    const data: AppointmentDoc = {
      clinicId: CLINIC_ID,
      patientId: patientRef.id,
      practitionerId: practitionerRef.id,
      serviceId: serviceRef.id,
      dateKey: dateKeyFor(start),
      startsAt: Timestamp.fromDate(start),
      endsAt: Timestamp.fromDate(endsAt),
      status,
      notes: null,
      reminderSentAt: null,
      nudgeSentAt: null,
      createdAt: now,
      updatedAt: now,
      patientName,
      patientPhone,
      patientEmail: null,
      practitionerName,
      serviceName,
      serviceDurationMinutes: durationMinutes,
    };
    tx.create(appointmentsCol.doc(), data);
  }

  appt(daniel, 'Daniel Okafor', '(555) 019-3321', ashaRaoRef, 'Dr. Asha Rao', followUpRef, 'Follow-up visit', at(9, 0), 10, 'completed');
  appt(rosa, 'Rosa Jiménez', '(555) 002-8810', kimLyRef, 'Nurse Kim Ly', bloodTestRef, 'Blood test', at(9, 30), 10, 'no_show');
  appt(margaret, 'Margaret Ellis', '(555) 014-2276', ashaRaoRef, 'Dr. Asha Rao', generalConsultRef, 'General consultation', at(10, 15), 15, 'booked');
  appt(sam, 'Sam Whitfield', '(555) 044-1189', tomWhelanRef, 'Dr. Tom Whelan', vaccinationRef, 'Vaccination', at(11, 0), 10, 'booked');
  appt(priya, 'Priya Nair', '(555) 071-5540', ashaRaoRef, 'Dr. Asha Rao', generalConsultRef, 'General consultation', at(11, 45), 15, 'booked');
  appt(george, 'George Tanaka', '(555) 090-2213', tomWhelanRef, 'Dr. Tom Whelan', followUpRef, 'Follow-up visit', at(14, 0), 10, 'booked');

  return { id: clinicRef.id, ...clinic };
}
