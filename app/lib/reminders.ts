import { prisma } from './db';
import { getDefaultClinic } from './clinic';
import { sendSms } from './smsProvider';

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
 */
export async function sendDueReminders(): Promise<ReminderRunResult> {
  const clinic = await getDefaultClinic();
  const settings = await prisma.reminderSettings.findUnique({ where: { clinicId: clinic.id } });
  const hoursBefore = settings?.hoursBefore ?? 24;
  const sameDayNudge = settings?.sameDayNudge ?? false;

  const now = new Date();
  let remindersSent = 0;
  let nudgesSent = 0;

  const reminderDue = await prisma.appointment.findMany({
    where: {
      clinicId: clinic.id,
      status: 'booked',
      reminderSentAt: null,
      startsAt: { gt: now, lte: new Date(now.getTime() + hoursBefore * 60 * 60 * 1000) },
    },
    include: { patient: true, practitioner: true },
  });

  for (const appt of reminderDue) {
    const message =
      `Hi ${appt.patient.name.split(' ')[0]} — reminder: your appointment at ${clinic.name} is ` +
      `${formatDateTime(appt.startsAt)} with ${appt.practitioner.name}. ` +
      `Need to cancel or reschedule? Call ${clinic.phone}.`;
    await sendSms(appt.patient.phone, message);
    await prisma.appointment.update({ where: { id: appt.id }, data: { reminderSentAt: now } });
    remindersSent++;
  }

  if (sameDayNudge) {
    const nudgeDue = await prisma.appointment.findMany({
      where: {
        clinicId: clinic.id,
        status: 'booked',
        nudgeSentAt: null,
        startsAt: { gt: now, lte: new Date(now.getTime() + 2 * 60 * 60 * 1000) },
      },
      include: { patient: true, practitioner: true },
    });

    for (const appt of nudgeDue) {
      if (appt.startsAt.getHours() >= 12) continue; // nudge is for morning bookings only

      const message =
        `Hi ${appt.patient.name.split(' ')[0]} — just a reminder your appointment at ${clinic.name} ` +
        `is today at ${formatTime(appt.startsAt)} with ${appt.practitioner.name}. ` +
        `Call ${clinic.phone} if you need to reschedule.`;
      await sendSms(appt.patient.phone, message);
      await prisma.appointment.update({ where: { id: appt.id }, data: { nudgeSentAt: now } });
      nudgesSent++;
    }
  }

  return { remindersSent, nudgesSent };
}
