import { prisma } from '../lib/db';
import { seedDatabase } from '../lib/seedDatabase';

async function main() {
  // Destructive reset — convenient for local dev (`npm run db:seed`), never run
  // automatically in production (see lib/clinic.ts's lazy, non-destructive seed).
  await prisma.appointment.deleteMany();
  await prisma.reminderSettings.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.practitionerService.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.service.deleteMany();
  await prisma.practitioner.deleteMany();
  await prisma.clinic.deleteMany();

  const result = await seedDatabase();
  console.log('Seed complete:', {
    clinic: result.clinic.name,
    practitioners: result.practitionerCount,
    services: result.serviceCount,
    patients: result.patientCount,
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
