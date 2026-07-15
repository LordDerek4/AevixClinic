export interface Service {
  id: string;
  name: string;
  durationMinutes: number;
}

export interface PractitionerSummary {
  id: string;
  name: string;
  role: string;
}

export interface AvailabilitySlot {
  time: string; // "HH:MM" 24-hour
  practitionerId: string;
}

export interface AvailabilityResponse {
  date: string;
  open: boolean;
  slots: AvailabilitySlot[];
  reason?: string;
}

export interface PatientInfo {
  id: string;
  name: string;
  phone: string;
  email: string | null;
}

export type AppointmentStatus = 'booked' | 'completed' | 'no_show' | 'cancelled';

export interface Appointment {
  id: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  notes: string | null;
  reminderSentAt: string | null;
  patient: PatientInfo;
  practitioner: PractitionerSummary;
  service: Service;
}
