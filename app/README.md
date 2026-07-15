# Cedar Grove Clinic — booking & schedule

A clinic appointment booking and no-show reduction app. Patients book as guests
(no account); staff sign in to manage the schedule, mark appointments, set
availability, and configure reminders.

Full-stack Next.js (App Router) + TypeScript, Prisma + SQLite, Firebase Auth
for staff login. Designed to run entirely locally for testing.

## Data model

- **Clinic** — name, contact info (single clinic per deployment for this MVP)
- **Practitioner** — name, role, which services they offer, email (matched to a Firebase account)
- **Service** — name, duration
- **Availability** — recurring weekly time windows per practitioner (weekday + start/end + slot granularity)
- **Patient** — name, phone, email — created fresh per booking, no login
- **Appointment** — patient, practitioner, service, start/end time, status (`booked` / `completed` / `no_show` / `cancelled`)

## Setup

```bash
npm install
cp .env.example .env   # fill in Firebase credentials, see below
npm run db:migrate     # creates prisma/dev.db and applies the schema
npm run db:seed        # loads sample clinic/staff/services/appointments
npm run dev
```

Then:
- Patient booking flow: http://localhost:3000/book
- Staff dashboard: http://localhost:3000/staff/login

### Firebase Auth (staff login)

Staff sign-in is real Firebase Authentication, gated by both the client SDK
and a server-side `firebase-admin` token check on every staff API route.

1. Create a project at https://console.firebase.google.com
2. Add a Web App → copy its config into the `NEXT_PUBLIC_FIREBASE_*` vars in `.env`
3. Enable **Authentication → Sign-in method → Email/Password**
4. Generate a service account key (Project settings → Service accounts →
   Generate new private key) → copy `project_id` / `client_email` / `private_key`
   into the `FIREBASE_ADMIN_*` vars in `.env`
5. Create a staff user in Firebase (Authentication → Users → Add user) whose
   **email matches a seeded Practitioner's email** — e.g. `asha@cedargroveclinic.com`,
   `tom@cedargroveclinic.com`, or `kim@cedargroveclinic.com` (see `prisma/seed.ts`).
   On first login, that Firebase account is linked to the matching Practitioner row.

Without `.env` configured, staff pages stay open (unauthenticated) so the UI
can still be reviewed, and the login screen shows a setup notice. All staff
API routes return a clear 500 in that state rather than silently succeeding.

### Database

SQLite via Prisma (`prisma/schema.prisma`, generated client in
`prisma/generated/prisma`). To reset to a clean seeded state at any point:

```bash
rm -f dev.db && npm run db:migrate && npm run db:seed
```

`npm run db:studio` opens Prisma Studio to browse/edit data directly.

## Reminder system

`lib/reminders.ts` checks for booked appointments whose reminder lead time
(configurable per clinic in Settings, default 24h) has arrived and haven't
been reminded yet, and logs the message that would be sent (clinic name,
date/time, practitioner, and how to cancel/reschedule). Each appointment is
only ever reminded once, tracked via `reminderSentAt` (plus an optional
same-day `nudgeSentAt` 2 hours before, for morning bookings, if enabled).

Run it:
- On demand from the CLI: `npm run send-reminders`
- On demand from the admin dashboard: the "Send due reminders now" button
- Programmatically: `POST /api/reminders/run` (staff-authenticated)

The actual "send" is a `console.log` stub in `lib/smsProvider.ts`, with a
clearly marked spot to plug in Twilio or Africa's Talking once you have an
account and API key. In production, `sendDueReminders()` would be invoked by
a real scheduler (cron, Vercel Cron, etc.) instead of a button.

## Validation

- Can't book a slot that's already taken (double-booking checked server-side
  at write time, race-safe via a transaction)
- Can't book in the past
- Phone number format is validated (client + server)
- A practitioner must actually offer the selected service, and the requested
  time must fall within their configured availability window

## Out of scope (by design)

Patient health records, billing/insurance, multi-clinic support, and payment
processing are not implemented — this is a scheduling + reminder MVP only.
