import { NextResponse, type NextRequest } from 'next/server';
import { firestore } from '../../../../lib/db';
import { getDefaultClinic } from '../../../../lib/clinic';
import { ApiError } from '../../../../lib/apiError';
import { withStaffAuth } from '../../../../lib/requireStaffAuth';
import type { AvailabilityWindowDoc, PractitionerDoc } from '../../../../lib/firestoreModels';

interface DayInput {
  weekday: number;
  open: boolean;
  startMinutes?: number;
  endMinutes?: number;
  slotMinutes?: number;
}

export const PUT = withStaffAuth(async (req: NextRequest) => {
  await getDefaultClinic();
  const body = await req.json().catch(() => null);
  if (!body) throw new ApiError('Invalid JSON body');

  const { practitionerId, hours } = body as { practitionerId?: unknown; hours?: unknown };
  if (typeof practitionerId !== 'string') throw new ApiError('practitionerId is required');
  if (!Array.isArray(hours)) throw new ApiError('hours must be an array');

  const ref = firestore.collection('practitioners').doc(practitionerId);
  const snap = await ref.get();
  if (!snap.exists) throw new ApiError('Unknown practitioner', 404);

  const days = hours as DayInput[];
  for (const day of days) {
    if (typeof day.weekday !== 'number' || day.weekday < 0 || day.weekday > 6) {
      throw new ApiError('Each entry needs a weekday between 0 and 6');
    }
    if (day.open) {
      if (
        typeof day.startMinutes !== 'number' ||
        typeof day.endMinutes !== 'number' ||
        day.startMinutes < 0 ||
        day.endMinutes > 24 * 60 ||
        day.startMinutes >= day.endMinutes
      ) {
        throw new ApiError(`Invalid hours for weekday ${day.weekday}`);
      }
    }
  }

  const availability: AvailabilityWindowDoc[] = days
    .filter((d) => d.open)
    .map((d) => ({
      weekday: d.weekday,
      startMinutes: d.startMinutes!,
      endMinutes: d.endMinutes!,
      slotMinutes: d.slotMinutes && d.slotMinutes > 0 ? d.slotMinutes : 15,
    }));

  await ref.update({ availability } satisfies Partial<PractitionerDoc>);

  return NextResponse.json({ availability });
});
