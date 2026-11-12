# Deploying

The portal is hosted on **Firebase App Hosting**, with its data in a free
**Neon** Postgres database. Only people with the event code can open it.

Check with IT/GRC before loading real names: the data sits with Google
(Firebase) and Neon, outside TNB systems.

## What you need

- A Google account, and a Firebase project on the **Blaze** plan (pay as you
  go). App Hosting needs Blaze, so a card must be attached. At this size
  (about 100 people, 3 days) usage should stay within the free allowance.
  **Set a budget alert** (Google Cloud console, Billing, Budgets and alerts)
  at a small amount such as RM20. An alert emails you; it does not stop
  charges.
- A free Neon account (neon.tech).
- Access to this GitHub repository.

## One time setup

### 1. Create the database (Neon)

1. Create a project. Pick the region nearest Malaysia (Singapore).
2. Copy the connection string. Turn **connection pooling off** to get the
   direct one. It looks like
   `postgresql://user:password@ep-....aws.neon.tech/neondb?sslmode=require`.

The portal creates its own tables the first time it starts. There is no
migration to run.

### 2. Create the Firebase project

1. In the Firebase console, create a project, then upgrade it to Blaze.
2. Add the budget alert.

### 3. Save the three secrets

Open **Google Cloud Shell** (the `>_` button at the top of
console.cloud.google.com). It already has the Firebase tools. Run these one
at a time. Each asks you to paste the value:

```sh
firebase use YOUR-PROJECT-ID
firebase apphosting:secrets:set portal-database-url   # the Neon string
firebase apphosting:secrets:set portal-admin-pin      # the secretariat PIN
firebase apphosting:secrets:set portal-event-pass     # the event code
```

**Event code:** 8 or more letters and numbers, easy to read out (no O/0 or
I/1), for example `PSUMMIT27X`. It is printed inside every QR code and shown
to the secretariat on the QR assets page, for anyone whose camera will not
scan.

### 4. Create the App Hosting backend

1. Firebase console, **Build, App Hosting, Get started**.
2. Connect GitHub and pick `kamalhazriq/event-portal`, branch `main`, root
   directory `/`.
3. Pick a region near Malaysia, name the backend (for example `portal`), and
   finish.
4. If it says the backend cannot read the secrets, run in Cloud Shell:

   ```sh
   firebase apphosting:secrets:grantaccess portal-database-url,portal-admin-pin,portal-event-pass --backend portal
   ```

   then start a new rollout from the App Hosting page.

### 5. Set the address

Firebase shows the backend's address, ending in `hosted.app`. In
`apphosting.yaml`, uncomment `PORTAL_URL` and set it to that address. Every QR
code uses it, so do this **before printing anything**.

### 6. Load the people

Open the address with the event code (`https://...hosted.app/?pass=CODE`),
sign in at `/admin` with the PIN, and upload the participant list on the
Attendees page.

## After setup

- **Every push to `main` deploys by itself.** The App Hosting page shows each
  rollout.
- **Event days:** set `minInstances: 1` in `apphosting.yaml` so the first
  scan of the morning is not slow. Set it back to `0` afterwards.
- **After the event:** change the `portal-event-pass` secret and roll out, so
  nobody can open it any more. When the reports are downloaded, delete the
  Neon project and the Firebase backend.

## How the event code works

- The QR codes on the projector, posters and table tents carry the code, so
  scanning one lets people straight in. The phone remembers it for 60 days.
- Without it, every page shows a short "participants only" page where the
  code can be typed.
- Name tag QR codes are unchanged. The desk scans those.
- Local work and the tests run without a code. It only applies where
  `EVENT_PASS` is set.

## Before the event

- [ ] GRC clearance for where attendee data sits.
- [ ] Budget alert set.
- [ ] `ADMIN_PIN` is not the example value.
- [ ] `ALLOW_TIME_OVERRIDE` is not set.
- [ ] `PORTAL_URL` set before any QR code is printed.
- [ ] Real Slido link and code in `config/event.json`.
- [ ] Real attendee list loaded, count checked.
- [ ] Opened on the hotel Wi-Fi, on a real phone, before Day 1.

## Running the tests against Postgres

Both stores share one set of code (`src/data/prisma/store.ts`). To run the
browser tests against Postgres instead of SQLite, point the app at an empty
database and seed it:

```sh
export DATA_ADAPTER=postgres DATABASE_URL=postgresql://...
npm run db:seed && npm run build && npx playwright test
```

After any change to `prisma/schema.prisma`, run `npm run db:postgres` and
commit the two files it writes. A test fails if you forget.
