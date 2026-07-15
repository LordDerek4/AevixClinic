import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';
import { getDefaultClinic } from '../../../lib/clinic';
import { withErrorHandling } from '../../../lib/apiError';

export const GET = withErrorHandling(async () => {
  const clinic = await getDefaultClinic();
  const services = await prisma.service.findMany({
    where: { clinicId: clinic.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, durationMinutes: true },
  });
  return NextResponse.json({ services });
});
