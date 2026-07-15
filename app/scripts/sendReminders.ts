import { prisma } from '../lib/db';
import { sendDueReminders } from '../lib/reminders';

sendDueReminders()
  .then((result) => {
    console.log(`Reminders sent: ${result.remindersSent}, nudges sent: ${result.nudgesSent}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
