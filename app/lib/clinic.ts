import { prisma } from './db';
import { ApiError } from './apiError';

/** MVP is single-clinic; this resolves the one seeded Clinic row. */
export async function getDefaultClinic() {
  const clinic = await prisma.clinic.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!clinic) {
    throw new ApiError('No clinic configured. Run `npm run db:seed` to create sample data.', 500);
  }
  return clinic;
}
