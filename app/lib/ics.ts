import type { Appointment } from './types';

function toIcsDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

export function buildIcsFile(appointment: Appointment, clinicName: string, clinicAddress: string): string {
  const start = toIcsDate(new Date(appointment.startsAt));
  const end = toIcsDate(new Date(appointment.endsAt));

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cedar Grove Clinic//Booking//EN',
    'BEGIN:VEVENT',
    `UID:${appointment.id}@cedargroveclinic.com`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${appointment.service.name} at ${clinicName}`,
    `LOCATION:${clinicAddress}`,
    `DESCRIPTION:Appointment with ${appointment.practitioner.name}.`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadIcs(appointment: Appointment, clinicName: string, clinicAddress: string) {
  const content = buildIcsFile(appointment, clinicName, clinicAddress);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'appointment.ics';
  link.click();
  URL.revokeObjectURL(url);
}
