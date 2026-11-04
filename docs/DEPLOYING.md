# Deploying

**Hosting is not decided yet**, so nothing here is final. This records what the
decision needs to account for, so the choice can be made quickly.

## What the portal needs from a host

- Node.js 20.9 or newer, running `npm run build` then `npm run start`.
- A writable store. The SQLite file used locally is **not** suitable for most
  hosts: anything that runs more than one instance, or that resets the disk
  between deploys, will lose check ins. See "Storage" below.
- HTTPS, because the portal is opened by scanning a QR code and phones warn on
  plain HTTP.
- One stable URL. It goes on the back of every name tag, on table tents and in
  the calendar invite, so it has to be decided before printing.

It does **not** need websockets, a background worker, or any outbound internet
access. Live screens poll over ordinary HTTP, which is what makes the portal
workable behind a restricted corporate network.

## Storage

`config/attendees.csv` and the database hold personal data, so where they live
is a GRC question, not only a technical one.

Local development uses SQLite through Prisma. That is a development choice, not
a deployment one. Before going live, one of these has to happen:

- **TNB Microsoft 365 or Azure:** likely Azure App Service plus a managed
  database. Needs a new adapter in `src/data/`, perhaps a couple of days.
- **Vercel plus Supabase:** fastest to stand up, but the data sits outside TNB,
  which needs clearance first. Also needs a new adapter.

Either way the work is one file implementing `DataAdapter`. No page changes.
[ARCHITECTURE.md](ARCHITECTURE.md) has the steps.

## Before the event

- [ ] Decide hosting and get GRC clearance for where attendee data sits.
- [ ] Write the storage adapter and point `DATA_ADAPTER` at it.
- [ ] Set `ADMIN_PIN` to something that is not the example value.
- [ ] Confirm `ALLOW_TIME_OVERRIDE` is **not** set, or is false.
- [ ] Confirm `AUTH_MODE=none` is still the agreed position.
- [ ] Put the real Slido link and code in `config/event.json`.
- [ ] Replace the placeholder logo in `public/branding/`.
- [ ] Replace the placeholder speaker names and bios.
- [ ] Set `event.portalUrl` to the real URL before any QR code is printed.
- [ ] Load the real attendee list and check the count.
- [ ] Open the portal on the hotel Wi-Fi, on a real phone, before Day 1.
