# Plan from 10 Nov 2026

Written before starting, so the order survives if a session runs out.
Each step is committed and published on its own (fast-forward to `main`).

## 1. Logos and favicon

- The D logo (Digital & Information) becomes the favicon and home screen icon.
- The event wordmark ("Transforming your Digital & AI Experience") goes in the
  portal: the home page hero, the projector welcome screen, and printed assets.
  The white-lettered version is used on dark backgrounds.
- The full "digital & information" logo goes in the page footer and the guide.
- All logo paths stay in `config/event.json`, so another event swaps them there.
- Files are converted to small web formats (the originals are 2000 px wide).

## 2. Mobile first, responsive at every size

Check every page at phone (375), tablet (768), laptop (1366) and desktop
(1920), and fix anything that scrolls sideways, crowds or wastes space:
attendee pages, admin pages, the guide, the projector views.

## 3. Photo wall (GRC has cleared it)

- Attendees upload from their phone. Photos are shrunk in the browser to
  about 1600 px wide before upload. Up to 10 per phone.
- Every photo waits for admin approval.
- Approved photos play as a slideshow on the big screen.
- Admin downloads every approved photo as one zip after the event.
- Storage goes through the data adapter, so it can move to approved storage.

## 4. Backup Q&A and polls (Modules 2 and 3)

Only if Slido is unavailable. Built last, as the brief says.
