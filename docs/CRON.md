# Reminders that do not need a screen open (the cron secret)

Scheduled announcements (Announce page, "Later") and the feedback reminders
after each session are sent by one address, `/api/cron/reminders`. Anyone
could call it, so it only answers a request that carries a secret password,
`CRON_SECRET`. A Google Cloud Scheduler job calls it once a minute.

Without this, the same things are sent whenever the big screen or Live
control page is open. With it, they go out on time even if both are closed.

You need the Firebase CLI and the Google Cloud CLI (`gcloud`), signed in to the
project `powersummit-7d255`. Do the steps in this order: the secret must exist
before the file that uses it is deployed, or the rollout fails.

## 1. Make the secret

Pick a long random text. This makes one and prints it:

```
openssl rand -base64 32
```

Save it in the Firebase secret store (it asks for the value; paste the text):

```
firebase apphosting:secrets:set portal-cron-secret --project powersummit-7d255
```

When it asks whether to give the backend access, answer yes for the backend
`portal`. Keep the text somewhere safe: step 3 needs it once more.

## 2. Turn it on in the app

In `apphosting.yaml`, remove the `#` in front of these three lines, then commit
and push to `main` (the site rolls out by itself):

```
  - variable: CRON_SECRET
    secret: portal-cron-secret
    availability: [RUNTIME]
```

## 3. Make the scheduler job

Replace `PASTE_THE_SECRET` with the text from step 1:

```
gcloud scheduler jobs create http portal-reminders \
  --project powersummit-7d255 \
  --location asia-southeast1 \
  --schedule "* * * * *" \
  --time-zone "Asia/Kuala_Lumpur" \
  --uri "https://portal--powersummit-7d255.asia-southeast1.hosted.app/api/cron/reminders" \
  --http-method POST \
  --headers "Authorization=Bearer PASTE_THE_SECRET"
```

The first time, `gcloud` may ask to switch on the Cloud Scheduler service:
answer yes.

## 4. Check it works

Run the job once by hand and read the answer:

```
gcloud scheduler jobs run portal-reminders --project powersummit-7d255 --location asia-southeast1
```

In the Google Cloud console, Cloud Scheduler, the job should show "Success"
with status 200. A 401 means the secret in the job and the secret in the store
differ: update the job with `gcloud scheduler jobs update http portal-reminders ... --headers ...`.

## After the event

Pause the job so it stops calling the site:

```
gcloud scheduler jobs pause portal-reminders --project powersummit-7d255 --location asia-southeast1
```

The job costs nothing at one call a minute (the first three jobs in an account
are free).
