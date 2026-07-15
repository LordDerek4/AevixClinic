import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '../../../lib/db';
import { getDefaultClinic } from '../../../lib/clinic';
import { withErrorHandling } from '../../../lib/apiError';

export const GET = withErrorHandling(async (req: NextRequest) => {
  const clinic = await getDefaultClinic();
  const serviceId = req.nextUrl.searchParams.get('serviceId');

  const practitioners = await prisma.practitioner.findMany({
    where: {
      clinicId: clinic.id,
      ...(serviceId ? { services: { some: { serviceId } } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, role: true },
  });

  return NextResponse.json({ practitioners });
});
