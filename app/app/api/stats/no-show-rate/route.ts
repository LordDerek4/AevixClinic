import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { getDefaultClinic } from '../../../../lib/clinic';
import { withStaffAuth } from '../../../../lib/requireStaffAuth';

async function rateForWindow(clinicId: string, from: Date, to: Date) {
  const [completed, noShow] = await Promise.all([
    prisma.appointment.count({ where: { clinicId, status: 'completed', startsAt: { gte: from, lt: to } } }),
    prisma.appointment.count({ where: { clinicId, status: 'no_show', startsAt: { gte: from, lt: to } } }),
  ]);
  const total = completed + noShow;
  return { total, noShow, rate: total > 0 ? (noShow / total) * 100 : null };
}

export const GET = withStaffAuth(async () => {
  const clinic = await getDefaultClinic();

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const [current, previous] = await Promise.all([
    rateForWindow(clinic.id, thirtyDaysAgo, now),
    rateForWindow(clinic.id, sixtyDaysAgo, thirtyDaysAgo),
  ]);

  return NextResponse.json({
    currentRate: current.rate,
    previousRate: previous.rate,
    sampleSize: current.total,
  });
});
