# Cedar Grove Clinic — booking & schedule

A clinic appointment booking and no-show reduction app. Patients book as guests
(no account); staff sign in to manage the schedule, mark appointments, set
availability, and configure reminders.

Full-stack Next.js (App Router) + TypeScript, Firebase (Firestore + Auth).
One Firebase project covers both staff login and the database — no separate
database service to set up.

## Data model (Firestore collections)

- **clinics** — single fixed document (`cedargrove`) for this MVP: name, contact info, reminder settings
- **practitioners** — name, role, which service IDs they offer, email (matched to a Firebase Auth account), recurring weekly availability
- **services** — name, duration
- **patients** — name, phone, email — created fresh per booking, no login
- **appointments** — patient/practitioner/service (denormalized for cheap list rendering), start/end time, status (`booked` / `completed` / `no_show` / `cancelled`)

The client never talks to Firestore directly — every read/write goes through
this app's own `/api/*` routes using the Firebase Admin SDK, so nothing needs
Firestore security rules beyond "deny all" (see `firestore.rules`).

## Deploying (no terminal required)

The database self-seeds on first use (see `lib/clinic.ts`) — there's no
migration or seed command to run. Deploying is just clicking through two
websites:

**1. Firebase project (auth + database)**
1. Go to https://console.firebase.google.com → **Create a project** (free).
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable**.
3. **Build → Firestore Database → Create database** (any region, production mode is fine — the app never exposes it directly to the browser).
4. **Project settings (gear icon) → General** → under "Your apps", add a **Web app** → copy the config values into the `NEXT_PUBLIC_FIREBASE_*` variables (see `.env.example`).
5. **Project settings → Service accounts → Generate new private key** → downloads a JSON file. Open it and copy `project_id` / `client_email` / `private_key` into `FIREBASE_ADMIN_*`.
6. **Authentication → Users → Add user** for each staff member, using the emails from the sample data: `asha@cedargroveclinic.com`, `tom@cedargroveclinic.com`, `kim@cedargroveclinic.com` (see `lib/seedDatabase.ts`) — or your own, once you've updated the seed data.

**2. Vercel (hosting)**
1. Go to https://vercel.com → sign up/log in with GitHub (free).
2. **Add New → Project**, pick this repo. Set **Root Directory** to `app`.
3. In **Environment Variables**, paste in all the `NEXT_PUBLIC_FIREBASE_*` and `FIREBASE_ADMIN_*` values from step 1.
   (`FIREBASE_ADMIN_PRIVATE_KEY` includes literal `\n` sequences — paste it exactly as it appears in the downloaded JSON file, quotes and all.)
4. Click **Deploy**. You'll get a live URL, e.g. `https://your-project.vercel.app`.
   Patient booking is at `/book`, staff at `/staff/login`.

Every push to the connected GitHub branch redeploys automatically.

## Local setup (optional, for development)

```bash
npm install
cp .env.example .env   # fill in the Firebase values from the steps above
npm run dev
```

Then:
- Patient booking flow: http://localhost:3000/book
- Staff dashboard: http://localhost:3000/staff/login

### Testing against the Firestore emulator (no real Firebase project needed)

```bash
npx firebase-tools emulators:start --only firestore --project demo-aevixclinic
```

In another terminal, with `.env` containing just:
```
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_ADMIN_PROJECT_ID=demo-aevixclinic
```
(leave the other Firebase vars blank), run `npm run dev` — the app auto-seeds
against the emulator on first request. Staff-authenticated routes will show a
"not configured" message in this mode (the Auth emulator isn't wired up), but
the entire patient booking flow works end-to-end.

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
  at write time, race-safe via a Firestore transaction)
- Can't book in the past
- Phone number format is validated (client + server)
- A practitioner must actually offer the selected service, and the requested
  time must fall within their configured availability window

## Design note: no composite Firestore indexes

Every query filters on a single field (e.g. `practitionerId == X`) and does
any further filtering (date ranges, status, exclusions) in application code,
rather than combining multiple `where()` clauses that would require a
Firestore composite index. That trades a bit of read efficiency at very large
scale for zero manual index-management steps — appropriate for this MVP's
realistic data volume, and it means a fresh deploy works immediately with no
"click here to create an index" surprises.

## Out of scope (by design)

Patient health records, billing/insurance, multi-clinic support, and payment
processing are not implemented — this is a scheduling + reminder MVP only.
