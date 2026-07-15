import type { Timestamp } from 'firebase-admin/firestore';

export const CLINIC_ID = 'cedargrove'; // fixed doc ID: single-clinic MVP, doubles as the race-safety key for lazy seeding

export interface AvailabilityWindowDoc {
  weekday: number; // 0=Sunday .. 6=Saturday
  startMinutes: number;
  endMinutes: number;
  slotMinutes: number;
}

export interface ClinicDoc {
  name: string;
  phone: string;
  address: string;
  bookingSlug: string;
  reminderSettings: { hoursBefore: number; sameDayNudge: boolean };
  createdAt: Timestamp;
}

export interface PractitionerDoc {
  clinicId: string;
  name: string;
  role: string;
  email: string;
  firebaseUid: string | null;
  serviceIds: string[];
  availability: AvailabilityWindowDoc[];
  createdAt: Timestamp;
}

export interface ServiceDoc {
  clinicId: string;
  name: string;
  durationMinutes: number;
  createdAt: Timestamp;
}

export interface PatientDoc {
  name: string;
  phone: string;
  email: string | null;
  createdAt: Timestamp;
}

export type AppointmentStatusValue = 'booked' | 'completed' | 'no_show' | 'cancelled';

export interface AppointmentDoc {
  clinicId: string;
  patientId: string;
  practitionerId: string;
  serviceId: string;
  dateKey: string; // "YYYY-MM-DD", for cheap same-day lookups
  startsAt: Timestamp;
  endsAt: Timestamp;
  status: AppointmentStatusValue;
  notes: string | null;
  reminderSentAt: Timestamp | null;
  nudgeSentAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  // Denormalized for cheap list rendering (avoids N+1 lookups). Reflects values
  // at booking/edit time — historical appointments intentionally keep old names.
  patientName: string;
  patientPhone: string;
  patientEmail: string | null;
  practitionerName: string;
  serviceName: string;
  serviceDurationMinutes: number;
}
