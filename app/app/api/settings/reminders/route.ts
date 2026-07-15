import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '../../../../lib/db';
import { getDefaultClinic } from '../../../../lib/clinic';
import { ApiError } from '../../../../lib/apiError';
import { withStaffAuth } from '../../../../lib/requireStaffAuth';

export const PUT = withStaffAuth(async (req: NextRequest) => {
  const clinic = await getDefaultClinic();
  const body = await req.json().catch(() => null);
  if (!body) throw new ApiError('Invalid JSON body');

  const { hoursBefore, sameDayNudge } = body as Record<string, unknown>;
  if (typeof hoursBefore !== 'number' || hoursBefore < 1 || hoursBefore > 168) {
    throw new ApiError('hoursBefore must be a number between 1 and 168');
  }
  if (typeof sameDayNudge !== 'boolean') {
    throw new ApiError('sameDayNudge must be a boolean');
  }

  const settings = await prisma.reminderSettings.upsert({
    where: { clinicId: clinic.id },
    update: { hoursBefore, sameDayNudge },
    create: { clinicId: clinic.id, hoursBefore, sameDayNudge },
  });

  return NextResponse.json({
    reminderSettings: { hoursBefore: settings.hoursBefore, sameDayNudge: settings.sameDayNudge },
  });
});
