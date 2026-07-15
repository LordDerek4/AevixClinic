import { NextResponse } from 'next/server';
import { withStaffAuth } from '../../../../lib/requireStaffAuth';
import { sendDueReminders } from '../../../../lib/reminders';

/**
 * Manual trigger for the reminder job ("Send due reminders now" button in the
 * admin UI). In production this same `sendDueReminders()` call would be
 * invoked by a real scheduler (cron, Vercel Cron, etc.) instead of a button.
 */
export const POST = withStaffAuth(async () => {
  const result = await sendDueReminders();
  return NextResponse.json(result);
});
