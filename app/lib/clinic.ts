import { prisma } from './db';
import { ApiError } from './apiError';
import { seedDatabase } from './seedDatabase';
import { Prisma } from '../prisma/generated/prisma/client';

/**
 * MVP is single-clinic. Resolves the one Clinic row, seeding the sample dataset
 * on first use if the database is empty (e.g. a fresh deploy with a blank
 * Postgres database and no way to run a one-off seed command). Safe under
 * concurrent cold starts: if two requests race to seed at once, the loser hits
 * the unique `bookingSlug` constraint and just re-reads the winner's row instead
 * of erroring.
 */
export async function getDefaultClinic() {
  const existing = await prisma.clinic.findFirst({ orderBy: { createdAt: 'asc' } });
  if (existing) return existing;

  try {
    const result = await seedDatabase();
    return result.clinic;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const clinic = await prisma.clinic.findFirst({ orderBy: { createdAt: 'asc' } });
      if (clinic) return clinic;
    }
    throw new ApiError('Failed to initialize clinic data.', 500);
  }
}
