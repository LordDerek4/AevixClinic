import { Timestamp } from 'firebase-admin/firestore';
import { getDb } from './db';
import { getDefaultClinic } from './clinic';
import { sendSms } from './smsProvider';
import type { AppointmentDoc } from './firestoreModels';

function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

function formatTime(d: Date): string {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(d);
}

export interface ReminderRunResult {
  remindersSent: number;
  nudgesSent: number;
}

/**
 * Finds appointments whose reminder (or same-day nudge) is due and sends them.
 * Designed to be safe to call repeatedly/on-demand: each appointment is only
 * ever reminded once per kind, tracked via `reminderSentAt` / `nudgeSentAt`.
 *
 * Queries `status == 'booked'` only (single-field equality, index-free) and
 * filters the timing window in memory — see lib/booking.ts for why this
 * project avoids composite Firestore queries entirely.
 */
export async function sendDueReminders(): Promise<ReminderRunResult> {
  const clinic = await getDefaultClinic();
  const { hoursBefore, sameDayNudge } = clinic.reminderSettings;

  const now = new Date();
  let remindersSent = 0;
  let nudgesSent = 0;

  const firestore = getDb();
  const bookedSnap = await firestore.collection('appointments').where('status', '==', 'booked').get();
  const bookedDocs = bookedSnap.docs.filter((doc) => (doc.data() as AppointmentDoc).clinicId === clinic.id);

  const reminderWindowEnd = new Date(now.getTime() + hoursBefore * 60 * 60 * 1000);
  for (const doc of bookedDocs) {
    const data = doc.data() as AppointmentDoc;
    if (data.reminderSentAt) continue;
    const startsAt = data.startsAt.toDate();
    if (!(startsAt > now && startsAt <= reminderWindowEnd)) continue;

    const message =
      `Hi ${data.patientName.split(' ')[0]} — reminder: your appointment at ${clinic.name} is ` +
      `${formatDateTime(startsAt)} with ${data.practitionerName}. ` +
      `Need to cancel or reschedule? Call ${clinic.phone}.`;
    await sendSms(data.patientPhone, message);
    await doc.ref.update({ reminderSentAt: Timestamp.now() });
    remindersSent++;
  }

  if (sameDayNudge) {
    const nudgeWindowEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    for (const doc of bookedDocs) {
      const data = doc.data() as AppointmentDoc;
      if (data.nudgeSentAt) continue;
      const startsAt = data.startsAt.toDate();
      if (!(startsAt > now && startsAt <= nudgeWindowEnd)) continue;
      if (startsAt.getHours() >= 12) continue; // nudge is for morning bookings only

      const message =
        `Hi ${data.patientName.split(' ')[0]} — just a reminder your appointment at ${clinic.name} ` +
        `is today at ${formatTime(startsAt)} with ${data.practitionerName}. ` +
        `Call ${clinic.phone} if you need to reschedule.`;
      await sendSms(data.patientPhone, message);
      await doc.ref.update({ nudgeSentAt: Timestamp.now() });
      nudgesSent++;
    }
  }

  return { remindersSent, nudgesSent };
}
