# Cedar Grove Clinic — booking & schedule

A clinic appointment booking and no-show reduction app. Patients book as guests
(no account); staff sign in to manage the schedule, mark appointments, set
availability, and configure reminders.

Full-stack Next.js (App Router) + TypeScript, Prisma + Postgres, Firebase Auth
for staff login.

## Data model

- **Clinic** — name, contact info (single clinic per deployment for this MVP)
- **Practitioner** — name, role, which services they offer, email (matched to a Firebase account)
- **Service** — name, duration
- **Availability** — recurring weekly time windows per practitioner (weekday + start/end + slot granularity)
- **Patient** — name, phone, email — created fresh per booking, no login
- **Appointment** — patient, practitioner, service, start/end time, status (`booked` / `completed` / `no_show` / `cancelled`)

## Deploying (no terminal required)

The database self-seeds on first use (see `lib/clinic.ts`), and `npm run build`
runs migrations automatically (see `package.json`), so deploying is just
clicking through Vercel's website:

1. Go to https://vercel.com and sign up/log in with GitHub (free).
2. **Add New → Project**, pick this repo. Set **Root Directory** to `app`.
3. Before deploying, go to the **Storage** tab → **Create Database** → **Postgres**
   (Vercel's own, free tier is enough) → connect it to this project. That sets
   `DATABASE_URL` automatically.
4. In **Settings → Environment Variables**, add the Firebase variables from
   `.env.example` (see the Firebase Auth section below) — or skip this for now
   and add them later; the app runs fine without them, staff pages just show a
   setup notice instead of gating access.
5. Click **Deploy**. That's it — Vercel runs `npm run build` (migrations +
   Next.js build) and gives you a live URL, e.g. `https://your-project.vercel.app`.
   Patient booking is at `/book`, staff at `/staff/login`.

Every push to the connected GitHub branch redeploys automatically.

## Local setup (optional, for development)

```bash
npm install
cp .env.example .env   # point DATABASE_URL at a local Postgres, fill in Firebase creds
npm run db:migrate     # applies the schema
npm run dev
```

Then:
- Patient booking flow: http://localhost:3000/book
- Staff dashboard: http://localhost:3000/staff/login

(`npm run db:seed` forcibly resets to fresh sample data — useful locally, but
the app also seeds itself automatically the first time it's queried against an
empty database, so it's not required.)

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

Postgres via Prisma (`prisma/schema.prisma`, generated client in
`prisma/generated/prisma`). The app seeds sample data automatically the first
time it queries an empty database — no manual seed step needed after a fresh
deploy. `npm run db:studio` opens Prisma Studio to browse/edit data directly
(point `DATABASE_URL` at whichever database you want to inspect).

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
