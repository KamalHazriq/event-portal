# Deploying

The portal is hosted on **Firebase App Hosting**, with its data in a free
**Neon** Postgres database. Only people with the event code can open it.

The data sits with Google (Firebase) and Neon, outside TNB systems; the
organisers confirmed no IT/GRC clearance is needed for this event.

## What you need

- The Neon project (done): `power-summit`, ID `royal-bird-22499570`, in
  Singapore. The portal creates its own tables on first start.
- The Firebase project (done): `powersummit-7d255`. It must be on the
  **Blaze** plan, because App Hosting runs the portal's server on Google
  Cloud (Cloud Run, Cloud Build, Secret Manager), which needs billing. The
  free allowances should cover an event this size; set a budget alert
  (Google Cloud console, Billing, Budgets and alerts) at about RM20. An
  alert emails you; it does not stop charges.
- Nothing installed on your computer. Everything below is in a browser.

## One time setup

### 1. Upgrade Firebase to Blaze

Firebase console, project powersummit-7d255, bottom left: **Upgrade**,
choose Blaze, add a card. Then add the budget alert.

### 2. Copy the two database strings (Neon console)

Open the Neon project, click **Connect**, keep branch `production`,
database `neondb`, role `neondb_owner`.

- With **Connection pooling ON**, copy the string. This is the
  **pooled** one (its host has `-pooler` in it).
- Turn **Connection pooling OFF**, copy again. This is the **direct** one.

Keep them somewhere private for a few minutes. They contain the password;
never paste them into chat or email.

### 3. Save the four secrets (Google Cloud Shell)

Open console.cloud.google.com with project powersummit-7d255 selected and
click the `>_` button (top right). Run these one at a time; each asks for
the value:

```sh
firebase use powersummit-7d255
firebase apphosting:secrets:set portal-database-url           # the pooled string
firebase apphosting:secrets:set portal-database-url-unpooled  # the direct string
firebase apphosting:secrets:set portal-admin-pin              # the secretariat PIN
firebase apphosting:secrets:set portal-event-pass             # the event code
```

If it asks whether to grant a backend access, say no for now (step 4
covers it). **PIN:** 6 or more digits, not 123456. **Event code:** 8 or
more letters and numbers, easy to read out (no O/0 or I/1), for example
`PSUMMIT27X`. Write both down for the secretariat.

### 4. Create the App Hosting backend

1. Firebase console, **Build, App Hosting, Get started**.
2. Region: **asia-southeast1** (Singapore) if offered, else the nearest.
3. Connect GitHub and pick `kamalhazriq/event-portal`, branch `main`,
   root directory `/`, automatic rollouts on.
4. Backend name `portal`, then finish. The first build takes about 10
   minutes.
5. If it fails because it cannot read the secrets, run in Cloud Shell:

   ```sh
   firebase apphosting:secrets:grantaccess portal-database-url,portal-database-url-unpooled,portal-admin-pin,portal-event-pass --backend portal
   ```

   then start a new rollout from the App Hosting page.

### 5. Check it, and set the address

1. Open `https://<the address>/?pass=<event code>` on a phone: the agenda
   shows.
2. Open `/admin`, sign in with the PIN: the Storage card on the dashboard
   says Postgres is ready.
3. The address ends in `hosted.app`. Every QR code uses it, so it goes in
   `apphosting.yaml` as `PORTAL_URL` (uncomment the lines at the bottom)
   **before printing anything**.

### 6. Load the people

Sign in at `/admin` and upload the participant list on the Attendees
page.

### Optional: the photo bucket

Photos are kept in Postgres, which is plenty for one event. To use the
Neon bucket instead (`assets`, declared in `neon.ts`), get its values on a
computer with Node.js: `npm i -g neon@latest`, `neon login`, then
`neon env pull --project-id royal-bird-22499570 --branch production`. Save
`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and `AWS_ENDPOINT_URL_S3` as
`portal-s3-access-key-id`, `portal-s3-secret-access-key` and
`portal-s3-endpoint`, grant the backend access, and uncomment the bucket
lines in `apphosting.yaml`. New photos then go to the bucket; earlier ones
stay readable from Postgres.

## Dress rehearsal

Once the live address works, run this from the repository folder. It reads
only, so it is safe against the real database at any time:

```sh
REHEARSAL_PASS=<event code> npm run rehearsal -- https://<the portal address>
```

It checks the event pass, loads every attendee page, then sends 100 phones
at once through the first minute after scanning the welcome QR, and prints
response times. Run it the week before, and again on the morning of Day 1
with `minInstances: 1` set.

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
